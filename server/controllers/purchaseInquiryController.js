/**
 * Purchase Inquiry Controller
 * Manages purchase inquiries sent to vendors, vendor responses (price quotes),
 * and auto-generation of Purchase Orders based on lowest vendor price.
 */

import { get, query, run } from '../config/database.js';

// ─── Inquiries ───

/**
 * POST /api/purchase/inquiries
 * Send inquiry for a material to one or more vendors
 * Body: { bom_material_id, vendor_ids: [1,2,3], message? }
 */
export function createInquiry(req, res) {
  try {
    const { bom_material_id, vendor_ids, message } = req.body;

    if (!bom_material_id || !Array.isArray(vendor_ids) || vendor_ids.length === 0) {
      return res.status(400).json({ error: 'Validation error', message: 'bom_material_id and vendor_ids[] are required' });
    }

    const mat = get('SELECT * FROM bom_materials WHERE id = ?', [bom_material_id]);
    if (!mat) return res.status(404).json({ error: 'Not found', message: 'Material not found' });

    const created = [];
    for (const vendorId of vendor_ids) {
      const vendor = get('SELECT * FROM vendors WHERE id = ?', [vendorId]);
      if (!vendor) continue;

      // Check if inquiry already exists for this material+vendor
      const existing = get(
        'SELECT id FROM purchase_inquiries WHERE bom_material_id = ? AND vendor_id = ?',
        [bom_material_id, vendorId]
      );
      if (existing) continue;

      const result = run(
        `INSERT INTO purchase_inquiries (bom_material_id, vendor_id, message, sent_via, status)
         VALUES (?, ?, ?, 'whatsapp', 'sent')`,
        [bom_material_id, vendorId, message || null]
      );
      const inq = get('SELECT * FROM purchase_inquiries WHERE id = ?', [result.lastInsertRowid]);
      created.push(inq);
    }

    return res.status(201).json({ success: true, inquiries: created });
  } catch (error) {
    console.error('Create inquiry error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to create inquiry' });
  }
}

/**
 * GET /api/purchase/inquiries
 * List all inquiries with material and vendor info
 */
export function getAllInquiries(req, res) {
  try {
    const rows = query(`
      SELECT
        pi.id,
        pi.bom_material_id,
        pi.vendor_id,
        pi.message,
        pi.sent_via,
        pi.status,
        pi.created_at,
        bm.part_name,
        bm.part_number,
        bm.specification,
        bm.quantity,
        bm.unit,
        v.name AS vendor_name,
        v.phone AS vendor_phone,
        b.work_order_id,
        b.machine_id,
        b.machine_index,
        wo.work_order_number,
        mp.product_name AS machine_name,
        (SELECT ivr.unit_price FROM inquiry_vendor_responses ivr WHERE ivr.inquiry_id = pi.id ORDER BY ivr.id DESC LIMIT 1) AS latest_unit_price,
        (SELECT ivr.total_price FROM inquiry_vendor_responses ivr WHERE ivr.inquiry_id = pi.id ORDER BY ivr.id DESC LIMIT 1) AS latest_total_price,
        (SELECT ivr.remarks FROM inquiry_vendor_responses ivr WHERE ivr.inquiry_id = pi.id ORDER BY ivr.id DESC LIMIT 1) AS latest_remarks
      FROM purchase_inquiries pi
      JOIN bom_materials bm ON pi.bom_material_id = bm.id
      JOIN vendors v ON pi.vendor_id = v.id
      JOIN work_order_boms b ON bm.bom_id = b.id
      LEFT JOIN work_orders wo ON b.work_order_id = wo.id
      LEFT JOIN machine_products mp ON b.machine_id = mp.id
      ORDER BY pi.created_at DESC
    `);

    return res.status(200).json({ inquiries: rows });
  } catch (error) {
    console.error('Get inquiries error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to fetch inquiries' });
  }
}

// ─── Vendor Responses ───

/**
 * POST /api/purchase/inquiries/:id/response
 * Add or update a vendor's price response for an inquiry
 * Body: { unit_price, total_price?, remarks? }
 */
export function addResponse(req, res) {
  try {
    const inquiryId = Number(req.params?.id);
    if (!inquiryId) return res.status(400).json({ error: 'Validation error', message: 'Invalid inquiry id' });

    const inquiry = get('SELECT * FROM purchase_inquiries WHERE id = ?', [inquiryId]);
    if (!inquiry) return res.status(404).json({ error: 'Not found', message: 'Inquiry not found' });

    const { unit_price, total_price, remarks } = req.body;
    if (unit_price === undefined || unit_price === null || unit_price === '') {
      return res.status(400).json({ error: 'Validation error', message: 'unit_price is required' });
    }

    // Get quantity from the material to auto-compute total if not provided
    const mat = get('SELECT quantity FROM bom_materials WHERE id = ?', [inquiry.bom_material_id]);
    const computedTotal = total_price !== undefined && total_price !== null
      ? Number(total_price)
      : Number(unit_price) * (mat?.quantity || 1);

    // Delete any existing response for this inquiry (one response per inquiry)
    run('DELETE FROM inquiry_vendor_responses WHERE inquiry_id = ?', [inquiryId]);

    const result = run(
      `INSERT INTO inquiry_vendor_responses (inquiry_id, unit_price, total_price, remarks)
       VALUES (?, ?, ?, ?)`,
      [inquiryId, Number(unit_price), computedTotal, remarks || null]
    );

    // Mark inquiry as responded
    run('UPDATE purchase_inquiries SET status = ? WHERE id = ?', ['responded', inquiryId]);

    const response = get('SELECT * FROM inquiry_vendor_responses WHERE id = ?', [result.lastInsertRowid]);
    return res.status(201).json({ success: true, response });
  } catch (error) {
    console.error('Add response error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to add response' });
  }
}

/**
 * GET /api/purchase/inquiries/:id/responses
 * Get all responses for an inquiry
 */
export function getResponses(req, res) {
  try {
    const inquiryId = Number(req.params?.id);
    if (!inquiryId) return res.status(400).json({ error: 'Validation error', message: 'Invalid inquiry id' });

    const responses = query(
      'SELECT * FROM inquiry_vendor_responses WHERE inquiry_id = ? ORDER BY id DESC',
      [inquiryId]
    );

    return res.status(200).json({ responses });
  } catch (error) {
    console.error('Get responses error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to fetch responses' });
  }
}

// ─── Purchase Orders ───

/**
 * POST /api/purchase/orders/generate
 * Preview pending purchase orders (does NOT create them).
 * Returns grouped materials by vendor with lowest-price vendor selection.
 */
export function generatePurchaseOrders(req, res) {
  try {
    const materialsInPurchase = query(`
      SELECT DISTINCT bm.id AS bom_material_id, bm.part_name, bm.specification,
             bm.quantity, bm.unit, bm.bom_id
      FROM bom_materials bm
      WHERE bm.added_to_purchase = 1
    `);

    if (materialsInPurchase.length === 0) {
      return res.status(400).json({ error: 'No materials', message: 'No materials in purchase list.' });
    }

    const winners = [];

    for (const mat of materialsInPurchase) {
      const respondedInquiries = query(`
        SELECT
          pi.id AS inquiry_id,
          pi.vendor_id,
          ivr.unit_price,
          ivr.total_price
        FROM purchase_inquiries pi
        JOIN inquiry_vendor_responses ivr ON ivr.inquiry_id = pi.id
        WHERE pi.bom_material_id = ?
        ORDER BY ivr.unit_price ASC
      `, [mat.bom_material_id]);

      if (respondedInquiries.length === 0) continue;

      const totalInquiries = get(
        'SELECT COUNT(*) AS cnt FROM purchase_inquiries WHERE bom_material_id = ?',
        [mat.bom_material_id]
      );
      const respondedCount = get(
        `SELECT COUNT(*) AS cnt FROM purchase_inquiries pi
         JOIN inquiry_vendor_responses ivr ON ivr.inquiry_id = pi.id
         WHERE pi.bom_material_id = ?`,
        [mat.bom_material_id]
      );

      if (totalInquiries.cnt !== respondedCount.cnt) continue;

      const alreadyOrdered = get(
        'SELECT id FROM purchase_order_items WHERE bom_material_id = ?',
        [mat.bom_material_id]
      );
      if (alreadyOrdered) continue;

      const best = respondedInquiries[0];

      // Get work order number for this material
      const woInfo = get(`
        SELECT wo.work_order_number
        FROM work_order_boms wob
        LEFT JOIN work_orders wo ON wob.work_order_id = wo.id
        WHERE wob.id = (SELECT bom_id FROM bom_materials WHERE id = ?)
      `, [mat.bom_material_id]);

      winners.push({
        bom_material_id: mat.bom_material_id,
        vendor_id: best.vendor_id,
        inquiry_id: best.inquiry_id,
        unit_price: best.unit_price,
        total_price: best.total_price,
        part_name: mat.part_name,
        specification: mat.specification,
        quantity: mat.quantity,
        unit: mat.unit,
        work_order_number: woInfo?.work_order_number || null,
      });
    }

    if (winners.length === 0) {
      return res.status(400).json({
        error: 'Not ready',
        message: 'No purchase orders available to generate. Ensure all inquiries have vendor responses.',
      });
    }

    // Group winners by vendor
    const byVendor = {};
    for (const w of winners) {
      if (!byVendor[w.vendor_id]) byVendor[w.vendor_id] = [];
      byVendor[w.vendor_id].push(w);
    }

    // Build preview list (no DB writes)
    const pendingPOs = [];
    for (const [vendorId, items] of Object.entries(byVendor)) {
      const vendor = get('SELECT * FROM vendors WHERE id = ?', [Number(vendorId)]);
      const totalAmount = items.reduce((sum, it) => sum + (it.total_price || 0), 0);
      const workOrderNumbers = [...new Set(items.map(i => i.work_order_number).filter(Boolean))];

      pendingPOs.push({
        vendor_id: Number(vendorId),
        vendor_name: vendor?.name || 'Unknown',
        vendor_phone: vendor?.phone || null,
        vendor_email: vendor?.email || null,
        vendor_gst: vendor?.gst || null,
        total_amount: totalAmount,
        work_order_numbers: workOrderNumbers,
        items: items.map(i => ({
          bom_material_id: i.bom_material_id,
          inquiry_id: i.inquiry_id,
          part_name: i.part_name,
          specification: i.specification,
          quantity: i.quantity,
          unit: i.unit,
          unit_price: i.unit_price,
          total_price: i.total_price,
        })),
      });
    }

    return res.status(200).json({
      success: true,
      pending_purchase_orders: pendingPOs,
    });
  } catch (error) {
    console.error('Generate PO preview error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to preview purchase orders' });
  }
}

/**
 * POST /api/purchase/orders/confirm
 * Create a single purchase order from the preview data.
 * Body: { vendor_id, gst_amount, terms_conditions, items: [{ bom_material_id, inquiry_id, part_name, specification, quantity, unit, unit_price, total_price }] }
 */
export function confirmPurchaseOrder(req, res) {
  try {
    const { vendor_id, gst_amount, terms_conditions, items } = req.body;

    if (!vendor_id || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Validation error', message: 'vendor_id and items are required' });
    }

    // Generate PO number
    const lastPo = get("SELECT po_number FROM purchase_orders ORDER BY id DESC LIMIT 1");
    let nextNum = 1;
    if (lastPo && lastPo.po_number) {
      const match = lastPo.po_number.match(/(\d+)$/);
      if (match) nextNum = parseInt(match[1], 10) + 1;
    }

    const poNumber = `HP/PO/${String(nextNum).padStart(4, '0')}`;
    const subtotal = items.reduce((sum, it) => sum + (Number(it.total_price) || 0), 0);
    const gst = Number(gst_amount) || 0;
    const totalAmount = subtotal + gst;

    const poResult = run(
      `INSERT INTO purchase_orders (po_number, vendor_id, status, total_amount, gst_amount, terms_conditions)
       VALUES (?, ?, 'draft', ?, ?, ?)`,
      [poNumber, Number(vendor_id), totalAmount, gst, terms_conditions || null]
    );

    const poId = poResult.lastInsertRowid;

    for (const item of items) {
      run(
        `INSERT INTO purchase_order_items (purchase_order_id, bom_material_id, inquiry_id, part_name, specification, quantity, unit, unit_price, total_price)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [poId, item.bom_material_id, item.inquiry_id, item.part_name, item.specification, item.quantity, item.unit, item.unit_price, item.total_price]
      );

      // Close all inquiries for this material
      run('UPDATE purchase_inquiries SET status = ? WHERE bom_material_id = ?', ['closed', item.bom_material_id]);
    }

    const vendor = get('SELECT name FROM vendors WHERE id = ?', [Number(vendor_id)]);

    return res.status(201).json({
      success: true,
      message: `Purchase order ${poNumber} created`,
      purchase_order: {
        id: poId,
        po_number: poNumber,
        vendor_id: Number(vendor_id),
        vendor_name: vendor?.name || 'Unknown',
        total_amount: totalAmount,
        gst_amount: gst,
        item_count: items.length,
      },
    });
  } catch (error) {
    console.error('Confirm PO error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to create purchase order' });
  }
}

/**
 * GET /api/purchase/orders
 * List all purchase orders
 */
export function getAllPurchaseOrders(req, res) {
  try {
    const pos = query(`
      SELECT
        po.*,
        v.name AS vendor_name,
        v.phone AS vendor_phone,
        (SELECT COUNT(*) FROM purchase_order_items poi WHERE poi.purchase_order_id = po.id) AS item_count,
        (SELECT wo.work_order_number
         FROM purchase_order_items poi2
         JOIN bom_materials bm ON poi2.bom_material_id = bm.id
         JOIN work_order_boms wob ON bm.bom_id = wob.id
         LEFT JOIN work_orders wo ON wob.work_order_id = wo.id
         WHERE poi2.purchase_order_id = po.id
         LIMIT 1
        ) AS work_order_number
      FROM purchase_orders po
      JOIN vendors v ON po.vendor_id = v.id
      ORDER BY po.id DESC
    `);

    return res.status(200).json({ purchase_orders: pos });
  } catch (error) {
    console.error('Get POs error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to fetch purchase orders' });
  }
}

/**
 * GET /api/purchase/orders/:id
 * Get single PO with line items
 */
export function getPurchaseOrderById(req, res) {
  try {
    const id = Number(req.params?.id);
    if (!id) return res.status(400).json({ error: 'Validation error', message: 'Invalid PO id' });

    const po = get(`
      SELECT po.*, v.name AS vendor_name, v.phone AS vendor_phone, v.email AS vendor_email, v.address AS vendor_address, v.gst AS vendor_gst,
        (SELECT wo.work_order_number
         FROM purchase_order_items poi2
         JOIN bom_materials bm ON poi2.bom_material_id = bm.id
         JOIN work_order_boms wob ON bm.bom_id = wob.id
         LEFT JOIN work_orders wo ON wob.work_order_id = wo.id
         WHERE poi2.purchase_order_id = po.id
         LIMIT 1
        ) AS work_order_number
      FROM purchase_orders po
      JOIN vendors v ON po.vendor_id = v.id
      WHERE po.id = ?
    `, [id]);

    if (!po) return res.status(404).json({ error: 'Not found', message: 'Purchase order not found' });

    const items = query(`
      SELECT poi.*, v.name AS vendor_name
      FROM purchase_order_items poi
      LEFT JOIN purchase_inquiries pi ON poi.inquiry_id = pi.id
      LEFT JOIN vendors v ON pi.vendor_id = v.id
      WHERE poi.purchase_order_id = ?
      ORDER BY poi.id ASC
    `, [id]);

    return res.status(200).json({ purchase_order: po, items });
  } catch (error) {
    console.error('Get PO error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to fetch purchase order' });
  }
}

/**
 * PUT /api/purchase/orders/:id
 * Update PO status
 * Body: { status }
 */
export function updatePurchaseOrder(req, res) {
  try {
    const id = Number(req.params?.id);
    if (!id) return res.status(400).json({ error: 'Validation error', message: 'Invalid PO id' });

    const { status, notes } = req.body;
    const updates = [];
    const params = [];

    if (status) {
      if (!['draft', 'sent', 'acknowledged', 'completed', 'cancelled'].includes(status)) {
        return res.status(400).json({ error: 'Validation error', message: 'Invalid status' });
      }
      updates.push('status = ?');
      params.push(status);
    }
    if (notes !== undefined) { updates.push('notes = ?'); params.push(notes); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Validation error', message: 'No fields to update' });
    }

    params.push(id);
    run(`UPDATE purchase_orders SET ${updates.join(', ')} WHERE id = ?`, params);

    const updated = get('SELECT * FROM purchase_orders WHERE id = ?', [id]);
    return res.status(200).json({ success: true, purchase_order: updated });
  } catch (error) {
    console.error('Update PO error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to update purchase order' });
  }
}
