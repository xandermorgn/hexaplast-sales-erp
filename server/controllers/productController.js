import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { get, query, run } from '../config/database.js';
import { logAudit, AUDIT_ACTIONS, ENTITY_TYPES } from '../utils/auditLogger.js';
import { buildDateFilter } from '../utils/filtering.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PRODUCT_IMAGES_DIR = path.join(__dirname, '..', 'uploads', 'product_images');

function ensureProductImageDir() {
  if (!fs.existsSync(PRODUCT_IMAGES_DIR)) {
    fs.mkdirSync(PRODUCT_IMAGES_DIR, { recursive: true });
  }
}

export function deleteProduct(req, res) {
  try {
    const { tableName, entityType } = getProductConfig(req.productType);
    const id = toNullableInt(req.params.id);

    if (id === null) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Invalid product id',
      });
    }

    const existing = get(`SELECT * FROM ${tableName} WHERE id = ? AND is_deleted = 0`, [id]);
    if (!existing) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Product not found',
      });
    }

    run(`UPDATE ${tableName} SET is_deleted = 1 WHERE id = ? AND is_deleted = 0`, [id]);

    logAudit({
      entity_type: entityType,
      entity_id: id,
      action: AUDIT_ACTIONS.DELETE,
      old_value: existing,
      new_value: { is_deleted: 1 },
      req,
    });

    return res.status(200).json({
      success: true,
      message: 'Product deleted',
    });
  } catch (error) {
    console.error('Delete product error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete product',
    });
  }
}

ensureProductImageDir();

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const productImageStorage = multer.diskStorage({
  destination(req, file, cb) {
    ensureProductImageDir();
    cb(null, PRODUCT_IMAGES_DIR);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const productType = req.productType === 'spare' ? 'spare' : 'machine';
    const filename = `${productType}_${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, filename);
  },
});

const upload = multer({
  storage: productImageStorage,
  fileFilter(req, file, cb) {
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      cb(new Error('Invalid file type. Only JPG and PNG are allowed.'), false);
      return;
    }
    cb(null, true);
  },
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
}).single('image');

export function uploadProductImage(req, res, next) {
  upload(req, res, (err) => {
    if (!err) {
      next();
      return;
    }

    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large',
        message: 'Product image must be less than 5MB',
      });
    }

    return res.status(400).json({
      error: 'Upload failed',
      message: err.message || 'Failed to upload image',
    });
  });
}

function toNullableInt(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function toNullableFloat(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number.parseFloat(String(value));
  return Number.isNaN(parsed) ? null : parsed;
}

function getProductConfig(productType) {
  if (productType === 'spare') {
    return {
      tableName: 'spare_products',
      entityType: ENTITY_TYPES.SPARE_PRODUCT || ENTITY_TYPES.PART,
      codePrefix: 'SP-',
    };
  }

  return {
    tableName: 'machine_products',
    entityType: ENTITY_TYPES.MACHINE,
    codePrefix: 'MC-',
  };
}

function getNextProductCode(tableName, codePrefix) {
  const row = get(
    `SELECT product_code
     FROM ${tableName}
     WHERE product_code LIKE ?
     ORDER BY CAST(SUBSTR(product_code, ?) AS INTEGER) DESC
     LIMIT 1`,
    [`${codePrefix}%`, codePrefix.length + 1],
  );

  if (!row?.product_code) {
    return `${codePrefix}0001`;
  }

  const numericPart = String(row.product_code).slice(codePrefix.length);
  const parsed = Number.parseInt(numericPart, 10);
  const next = Number.isNaN(parsed) ? 1 : parsed + 1;
  return `${codePrefix}${String(next).padStart(4, '0')}`;
}

function getProductById(tableName, id) {
  return get(
    `SELECT p.*, c.category_name
     FROM ${tableName} p
     LEFT JOIN product_categories c ON c.id = p.category_id
     WHERE p.id = ?`,
    [id],
  );
}

function validateCategory(categoryId) {
  if (!categoryId) return null;
  const category = get('SELECT id FROM product_categories WHERE id = ?', [categoryId]);
  return category ? category.id : null;
}

export function createCategory(req, res) {
  try {
    if (!["master_admin", "employee"].includes(req.user?.role)) {
      return res.status(403).json({
        error: "Forbidden",
        message: "Access denied",
      });
    }

    const category_name = String(req.body?.category_name || '').trim();

    if (!category_name) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'category_name is required',
      });
    }

    run('INSERT INTO product_categories (category_name) VALUES (?)', [category_name]);

    const category = get('SELECT * FROM product_categories WHERE category_name = ?', [category_name]);

    if (category) {
      logAudit({
        entity_type: ENTITY_TYPES.PRODUCT_CATEGORY || 'product_category',
        entity_id: category.id,
        action: AUDIT_ACTIONS.CREATE,
        old_value: null,
        new_value: category,
        req,
      });

    }

    return res.status(201).json({
      success: true,
      category,
    });
  } catch (error) {
    if (String(error?.message || '').toLowerCase().includes('unique')) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'Category already exists',
      });
    }

    console.error('Create category error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create category',
    });
  }
}

export function getCategories(req, res) {
  try {
    const categories = query('SELECT * FROM product_categories ORDER BY category_name ASC');
    return res.status(200).json({
      count: categories.length,
      categories,
    });
  } catch (error) {
    console.error('Get categories error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch categories',
    });
  }
}

export function createProduct(req, res) {
  try {
    if (!["master_admin", "employee"].includes(req.user?.role)) {
      return res.status(403).json({
        error: "Forbidden",
        message: "Access denied",
      });
    }

    const { tableName, entityType, codePrefix } = getProductConfig(req.productType);

    const category_id = toNullableInt(req.body?.category_id);
    const categoryExists = validateCategory(category_id);

    if (!categoryExists) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Valid category_id is required',
      });
    }

    const product_code = getNextProductCode(tableName, codePrefix);
    const image_path = req.file ? `/uploads/product_images/${req.file.filename}` : null;

    run(
      `INSERT INTO ${tableName} (
        category_id,
        created_by,
        product_name,
        model_number,
        product_code,
        sales_price,
        purchase_price,
        hsn_code,
        sac_code,
        gst_percent,
        quantity,
        currency,
        description,
        specifications,
        image_path
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        categoryExists,
        req.user?.id || null,
        req.body?.product_name || null,
        req.body?.model_number || null,
        product_code,
        toNullableFloat(req.body?.sales_price),
        toNullableFloat(req.body?.purchase_price),
        req.body?.hsn_code || null,
        req.body?.sac_code || null,
        toNullableFloat(req.body?.gst_percent),
        toNullableFloat(req.body?.quantity),
        req.body?.currency || 'INR',
        req.body?.description || null,
        req.body?.specifications || null,
        image_path,
      ],
    );

    const created = get(
      `SELECT id FROM ${tableName} WHERE product_code = ? ORDER BY id DESC LIMIT 1`,
      [product_code],
    );

    const product = created ? getProductById(tableName, created.id) : null;

    if (product) {
      logAudit({
        entity_type: entityType,
        entity_id: product.id,
        action: AUDIT_ACTIONS.CREATE,
        old_value: null,
        new_value: product,
        req,
      });

    }

    return res.status(201).json({
      success: true,
      product,
    });
  } catch (error) {
    console.error('Create product error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create product',
    });
  }
}

export function getProducts(req, res) {
  try {
    const { tableName } = getProductConfig(req.productType);

    let sql = `SELECT p.*, c.category_name
       FROM ${tableName} p
       LEFT JOIN product_categories c ON c.id = p.category_id
       WHERE p.is_deleted = 0`;

    const filter = buildDateFilter(req.query || {}, 'p.created_at', 'p.created_by');
    const params = [...filter.params];
    sql += filter.clause;
    sql += ' ORDER BY p.created_at DESC, p.id DESC';

    const products = query(sql, params);

    return res.status(200).json({
      count: products.length,
      products,
    });
  } catch (error) {
    console.error('Get products error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch products',
    });
  }
}

export function updateProduct(req, res) {
  try {
    const { tableName, entityType } = getProductConfig(req.productType);
    const id = toNullableInt(req.params.id);

    if (id === null) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Invalid product id',
      });
    }

    const existing = get(`SELECT * FROM ${tableName} WHERE id = ? AND is_deleted = 0`, [id]);
    if (!existing) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Product not found',
      });
    }

    const updates = [];
    const params = [];

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'category_id')) {
      const categoryId = toNullableInt(req.body.category_id);
      const categoryExists = validateCategory(categoryId);

      if (!categoryExists) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Valid category_id is required',
        });
      }

      updates.push('category_id = ?');
      params.push(categoryExists);
    }

    const textFields = [
      'product_name',
      'model_number',
      'hsn_code',
      'sac_code',
      'currency',
      'description',
      'specifications',
    ];

    for (const field of textFields) {
      if (Object.prototype.hasOwnProperty.call(req.body || {}, field)) {
        updates.push(`${field} = ?`);
        params.push(req.body[field] || null);
      }
    }

    const numberFields = ['sales_price', 'purchase_price', 'gst_percent', 'quantity'];

    for (const field of numberFields) {
      if (Object.prototype.hasOwnProperty.call(req.body || {}, field)) {
        updates.push(`${field} = ?`);
        params.push(toNullableFloat(req.body[field]));
      }
    }

    if (req.file) {
      updates.push('image_path = ?');
      params.push(`/uploads/product_images/${req.file.filename}`);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'No fields provided to update',
      });
    }

    params.push(id);
    run(`UPDATE ${tableName} SET ${updates.join(', ')} WHERE id = ? AND is_deleted = 0`, params);

    const product = getProductById(tableName, id);

    logAudit({
      entity_type: entityType,
      entity_id: id,
      action: AUDIT_ACTIONS.UPDATE,
      old_value: existing,
      new_value: product,
      req,
    });

    return res.status(200).json({
      success: true,
      product,
    });
  } catch (error) {
    console.error('Update product error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update product',
    });
  }
}
