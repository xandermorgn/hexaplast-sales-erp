/**
 * Sub-Category Controller
 * CRUD for product_subcategories and subcategory_products (bundle management)
 */
import { get, query, run } from '../config/database.js';

export function listSubcategories(req, res) {
  try {
    const subs = query(`
      SELECT s.*, c.category_name,
        (SELECT COUNT(*) FROM subcategory_products sp WHERE sp.subcategory_id = s.id) AS product_count
      FROM product_subcategories s
      LEFT JOIN product_categories c ON c.id = s.category_id
      ORDER BY s.name ASC
    `);
    return res.status(200).json({ subcategories: subs });
  } catch (error) {
    console.error('List subcategories error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to fetch subcategories' });
  }
}

export function getSubcategory(req, res) {
  try {
    const { id } = req.params;
    const sub = get(`
      SELECT s.*, c.category_name
      FROM product_subcategories s
      LEFT JOIN product_categories c ON c.id = s.category_id
      WHERE s.id = ?
    `, [id]);

    if (!sub) {
      return res.status(404).json({ error: 'Not found', message: 'Subcategory not found' });
    }

    // Get products in this subcategory
    const products = query(`
      SELECT sp.id AS relation_id, sp.product_id, sp.product_type,
        CASE
          WHEN sp.product_type = 'machine' THEN mp.product_name
          WHEN sp.product_type = 'spare' THEN sprod.product_name
        END AS product_name,
        CASE
          WHEN sp.product_type = 'machine' THEN mp.product_code
          WHEN sp.product_type = 'spare' THEN sprod.product_code
        END AS product_code,
        CASE
          WHEN sp.product_type = 'machine' THEN mp.sales_price
          WHEN sp.product_type = 'spare' THEN sprod.sales_price
        END AS sales_price,
        CASE
          WHEN sp.product_type = 'machine' THEN mp.gst_percent
          WHEN sp.product_type = 'spare' THEN sprod.gst_percent
        END AS gst_percent
      FROM subcategory_products sp
      LEFT JOIN machine_products mp ON sp.product_type = 'machine' AND sp.product_id = mp.id
      LEFT JOIN spare_products sprod ON sp.product_type = 'spare' AND sp.product_id = sprod.id
      WHERE sp.subcategory_id = ?
    `, [id]);

    return res.status(200).json({ subcategory: sub, products });
  } catch (error) {
    console.error('Get subcategory error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to fetch subcategory' });
  }
}

export function createSubcategory(req, res) {
  try {
    const name = String(req.body?.name || '').trim();
    const category_id = req.body?.category_id || null;

    if (!name) {
      return res.status(400).json({ error: 'Validation error', message: 'name is required' });
    }

    const result = run(
      'INSERT INTO product_subcategories (name, category_id) VALUES (?, ?)',
      [name, category_id]
    );

    const created = get('SELECT * FROM product_subcategories WHERE id = ?', [result.lastInsertRowid]);

    // Insert products if provided
    const products = req.body?.products || [];
    const insertProduct = (subcatId, prod) => {
      run(
        'INSERT INTO subcategory_products (subcategory_id, product_id, product_type) VALUES (?, ?, ?)',
        [subcatId, prod.product_id, prod.product_type || 'machine']
      );
    };

    for (const prod of products) {
      if (prod.product_id) insertProduct(created.id, prod);
    }

    return res.status(201).json({ success: true, subcategory: created });
  } catch (error) {
    console.error('Create subcategory error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to create subcategory' });
  }
}

export function updateSubcategory(req, res) {
  try {
    const { id } = req.params;
    const name = String(req.body?.name || '').trim();
    const category_id = req.body?.category_id ?? null;

    if (!name) {
      return res.status(400).json({ error: 'Validation error', message: 'name is required' });
    }

    const existing = get('SELECT * FROM product_subcategories WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Not found', message: 'Subcategory not found' });
    }

    run(
      'UPDATE product_subcategories SET name = ?, category_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name, category_id, id]
    );

    // Replace products
    if (Array.isArray(req.body?.products)) {
      run('DELETE FROM subcategory_products WHERE subcategory_id = ?', [id]);
      for (const prod of req.body.products) {
        if (prod.product_id) {
          run(
            'INSERT INTO subcategory_products (subcategory_id, product_id, product_type) VALUES (?, ?, ?)',
            [id, prod.product_id, prod.product_type || 'machine']
          );
        }
      }
    }

    const updated = get('SELECT * FROM product_subcategories WHERE id = ?', [id]);
    return res.status(200).json({ success: true, subcategory: updated });
  } catch (error) {
    console.error('Update subcategory error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to update subcategory' });
  }
}

export function deleteSubcategory(req, res) {
  try {
    const { id } = req.params;
    const existing = get('SELECT * FROM product_subcategories WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Not found', message: 'Subcategory not found' });
    }

    run('DELETE FROM subcategory_products WHERE subcategory_id = ?', [id]);
    run('DELETE FROM product_subcategories WHERE id = ?', [id]);

    return res.status(200).json({ success: true, message: 'Subcategory deleted' });
  } catch (error) {
    console.error('Delete subcategory error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to delete subcategory' });
  }
}
