/**
 * BOM Controller
 * Manages Bill of Materials generation from work orders
 */

import { get, query, run } from '../config/database.js';
import { logAudit, AUDIT_ACTIONS } from '../utils/auditLogger.js';

/**
 * GET /api/purchase/pending-work-orders
 * Work orders that don't have BOMs yet
 */
export function getPendingWorkOrders(req, res) {
  try {
    const rows = query(`
      SELECT
        wo.id,
        wo.work_order_number,
        wo.work_order_date,
        wo.status,
        wo.created_at,
        ci.company_name,
        ci.authorized_person
      FROM work_orders wo
      LEFT JOIN customer_inquiries ci ON wo.inquiry_id = ci.id
      WHERE wo.is_deleted = 0
        AND wo.id NOT IN (SELECT DISTINCT work_order_id FROM work_order_boms)
      ORDER BY wo.id DESC
    `);

    // For each work order, get machine items
    const result = rows.map((wo) => {
      const items = query(`
        SELECT
          woi.product_id,
          woi.product_name,
          woi.quantity,
          woi.product_type
        FROM work_order_items woi
        WHERE woi.work_order_id = ? AND woi.product_type = 'machine'
      `, [wo.id]);

      return { ...wo, machine_items: items };
    });

    return res.status(200).json({ work_orders: result });
  } catch (error) {
    console.error('Get pending work orders error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to fetch pending work orders' });
  }
}

/**
 * POST /api/purchase/bom/create
 * Create BOMs for a work order
 * Body: { work_order_id }
 *
 * For each machine item in the work order, creates N BOMs (one per quantity unit).
 * Each BOM is auto-populated with materials from machine_parts.
 */
export function createBomFromWorkOrder(req, res) {
  try {
    const { work_order_id } = req.body;
    if (!work_order_id) {
      return res.status(400).json({ error: 'Validation error', message: 'work_order_id is required' });
    }

    // Check work order exists
    const wo = get('SELECT * FROM work_orders WHERE id = ? AND is_deleted = 0', [work_order_id]);
    if (!wo) {
      return res.status(404).json({ error: 'Not found', message: 'Work order not found' });
    }

    // Check no existing BOMs
    const existingBom = get('SELECT id FROM work_order_boms WHERE work_order_id = ? LIMIT 1', [work_order_id]);
    if (existingBom) {
      return res.status(409).json({ error: 'Conflict', message: 'BOM already exists for this work order' });
    }

    // Get machine items
    const machineItems = query(
      `SELECT product_id, product_name, quantity FROM work_order_items
       WHERE work_order_id = ? AND product_type = 'machine'`,
      [work_order_id],
    );

    if (machineItems.length === 0) {
      return res.status(400).json({ error: 'Validation error', message: 'No machine products found in this work order' });
    }

    const createdBoms = [];

    for (const item of machineItems) {
      const machineId = item.product_id;
      const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));

      // Get machine parts
      const parts = query('SELECT * FROM machine_parts WHERE machine_id = ?', [machineId]);

      for (let idx = 1; idx <= qty; idx++) {
        // Create BOM record
        const bomResult = run(
          `INSERT INTO work_order_boms (work_order_id, machine_id, machine_index, status)
           VALUES (?, ?, ?, 'draft')`,
          [work_order_id, machineId, idx],
        );

        const bomId = bomResult.lastInsertRowid;

        // Auto-populate BOM materials from machine parts
        for (const part of parts) {
          run(
            `INSERT INTO bom_materials (bom_id, part_id, part_number, part_name, specification, quantity, unit)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [bomId, part.id, part.part_number, part.part_name, part.specification, part.default_quantity, part.unit],
          );
        }

        const bom = get('SELECT * FROM work_order_boms WHERE id = ?', [bomId]);
        createdBoms.push(bom);
      }
    }

    logAudit({
      entity_type: 'work_order_bom',
      entity_id: work_order_id,
      action: AUDIT_ACTIONS.CREATE,
      old_value: null,
      new_value: { work_order_id, bom_count: createdBoms.length },
      req,
    });

    return res.status(201).json({
      success: true,
      message: `Created ${createdBoms.length} BOM(s)`,
      boms: createdBoms,
    });
  } catch (error) {
    console.error('Create BOM error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to create BOM' });
  }
}

/**
 * GET /api/purchase/bom
 * List all BOMs
 */
export function getAllBoms(req, res) {
  try {
    const boms = query(`
      SELECT
        b.id,
        b.work_order_id,
        b.machine_id,
        b.machine_index,
        b.status,
        b.created_at,
        wo.work_order_number,
        mp.product_name AS machine_name,
        (SELECT COUNT(*) FROM bom_materials bm WHERE bm.bom_id = b.id) AS material_count
      FROM work_order_boms b
      LEFT JOIN work_orders wo ON b.work_order_id = wo.id
      LEFT JOIN machine_products mp ON b.machine_id = mp.id
      ORDER BY b.id DESC
    `);

    return res.status(200).json({ boms });
  } catch (error) {
    console.error('Get all BOMs error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to fetch BOMs' });
  }
}

/**
 * GET /api/purchase/bom/:id
 * Get single BOM with materials
 */
export function getBomById(req, res) {
  try {
    const id = Number(req.params?.id);
    if (!id) return res.status(400).json({ error: 'Validation error', message: 'Invalid BOM id' });

    const bom = get(`
      SELECT
        b.*,
        wo.work_order_number,
        mp.product_name AS machine_name
      FROM work_order_boms b
      LEFT JOIN work_orders wo ON b.work_order_id = wo.id
      LEFT JOIN machine_products mp ON b.machine_id = mp.id
      WHERE b.id = ?
    `, [id]);

    if (!bom) return res.status(404).json({ error: 'Not found', message: 'BOM not found' });

    // Auto-sync: check machine_parts for any new parts not yet in this BOM
    const machineParts = query('SELECT * FROM machine_parts WHERE machine_id = ?', [bom.machine_id]);
    const existingPartIds = new Set(
      query('SELECT part_id FROM bom_materials WHERE bom_id = ? AND part_id IS NOT NULL', [id])
        .map(row => row.part_id)
    );

    for (const part of machineParts) {
      if (!existingPartIds.has(part.id)) {
        run(
          `INSERT INTO bom_materials (bom_id, part_id, part_number, part_name, specification, quantity, unit)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [id, part.id, part.part_number, part.part_name, part.specification, part.default_quantity || 1, part.unit || 'Nos']
        );
      }
    }

    const materials = query(`
      SELECT bm.*, v.name AS vendor_name
      FROM bom_materials bm
      LEFT JOIN vendors v ON bm.vendor_id = v.id
      WHERE bm.bom_id = ?
      ORDER BY bm.id ASC
    `, [id]);

    return res.status(200).json({ bom, materials });
  } catch (error) {
    console.error('Get BOM error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to fetch BOM' });
  }
}

/**
 * PUT /api/purchase/bom/:id/material/:materialId
 * Update a BOM material (quantity, notes, vendor, add_to_purchase)
 */
export function updateBomMaterial(req, res) {
  try {
    const materialId = Number(req.params?.materialId);
    if (!materialId) return res.status(400).json({ error: 'Validation error', message: 'Invalid material id' });

    const existing = get('SELECT * FROM bom_materials WHERE id = ?', [materialId]);
    if (!existing) return res.status(404).json({ error: 'Not found', message: 'Material not found' });

    const { quantity, notes, vendor_id, added_to_purchase } = req.body;
    const updates = [];
    const params = [];

    if (quantity !== undefined) { updates.push('quantity = ?'); params.push(Number(quantity)); }
    if (notes !== undefined) { updates.push('notes = ?'); params.push(notes); }
    if (vendor_id !== undefined) { updates.push('vendor_id = ?'); params.push(vendor_id || null); }
    if (added_to_purchase !== undefined) { updates.push('added_to_purchase = ?'); params.push(added_to_purchase ? 1 : 0); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Validation error', message: 'No fields to update' });
    }

    params.push(materialId);
    run(`UPDATE bom_materials SET ${updates.join(', ')} WHERE id = ?`, params);

    const updated = get(`
      SELECT bm.*, v.name AS vendor_name
      FROM bom_materials bm
      LEFT JOIN vendors v ON bm.vendor_id = v.id
      WHERE bm.id = ?
    `, [materialId]);

    return res.status(200).json({ success: true, material: updated });
  } catch (error) {
    console.error('Update BOM material error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to update material' });
  }
}

/**
 * POST /api/purchase/bom/:id/material
 * Add a custom material to BOM
 */
export function addBomMaterial(req, res) {
  try {
    const bomId = Number(req.params?.id);
    if (!bomId) return res.status(400).json({ error: 'Validation error', message: 'Invalid BOM id' });

    const bom = get('SELECT * FROM work_order_boms WHERE id = ?', [bomId]);
    if (!bom) return res.status(404).json({ error: 'Not found', message: 'BOM not found' });

    const { part_number, part_name, specification, quantity, unit, notes } = req.body;

    if (!part_name || !part_name.trim()) {
      return res.status(400).json({ error: 'Validation error', message: 'Part name is required' });
    }

    const result = run(
      `INSERT INTO bom_materials (bom_id, part_number, part_name, specification, quantity, unit, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [bomId, part_number || null, part_name.trim(), specification || null, Number(quantity) || 1, unit || 'Nos', notes || null],
    );

    const material = get('SELECT * FROM bom_materials WHERE id = ?', [result.lastInsertRowid]);

    return res.status(201).json({ success: true, material });
  } catch (error) {
    console.error('Add BOM material error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to add material' });
  }
}

/**
 * PUT /api/purchase/bom/:id/status
 * Update BOM status
 */
export function updateBomStatus(req, res) {
  try {
    const id = Number(req.params?.id);
    if (!id) return res.status(400).json({ error: 'Validation error', message: 'Invalid BOM id' });

    const { status } = req.body;
    if (!['draft', 'in_progress', 'completed'].includes(status)) {
      return res.status(400).json({ error: 'Validation error', message: 'Invalid status' });
    }

    run('UPDATE work_order_boms SET status = ? WHERE id = ?', [status, id]);
    const updated = get('SELECT * FROM work_order_boms WHERE id = ?', [id]);

    return res.status(200).json({ success: true, bom: updated });
  } catch (error) {
    console.error('Update BOM status error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to update BOM status' });
  }
}

/**
 * GET /api/purchase/materials
 * Get all materials marked for purchase
 */
export function getPurchaseMaterials(req, res) {
  try {
    const materials = query(`
      SELECT
        bm.*,
        b.work_order_id,
        b.machine_id,
        b.machine_index,
        wo.work_order_number,
        mp.product_name AS machine_name,
        v.name AS vendor_name,
        v.phone AS vendor_phone,
        v.email AS vendor_email
      FROM bom_materials bm
      JOIN work_order_boms b ON bm.bom_id = b.id
      LEFT JOIN work_orders wo ON b.work_order_id = wo.id
      LEFT JOIN machine_products mp ON b.machine_id = mp.id
      LEFT JOIN vendors v ON bm.vendor_id = v.id
      WHERE bm.added_to_purchase = 1
      ORDER BY wo.work_order_number, mp.product_name, bm.part_name
    `);

    return res.status(200).json({ materials });
  } catch (error) {
    console.error('Get purchase materials error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to fetch purchase materials' });
  }
}
