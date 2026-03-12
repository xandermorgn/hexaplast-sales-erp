/**
 * Vendor Controller
 * CRUD operations for vendor management
 */

import { get, query, run } from '../config/database.js';
import { logAudit, AUDIT_ACTIONS, ENTITY_TYPES } from '../utils/auditLogger.js';

/**
 * GET /api/vendors
 */
export function getAllVendors(req, res) {
  try {
    const vendors = query('SELECT * FROM vendors ORDER BY id DESC');
    return res.status(200).json({ count: vendors.length, vendors });
  } catch (error) {
    console.error('Get vendors error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to fetch vendors' });
  }
}

/**
 * GET /api/vendors/:id
 */
export function getVendorById(req, res) {
  try {
    const id = Number(req.params?.id);
    if (!id) return res.status(400).json({ error: 'Validation error', message: 'Invalid vendor id' });

    const vendor = get('SELECT * FROM vendors WHERE id = ?', [id]);
    if (!vendor) return res.status(404).json({ error: 'Not found', message: 'Vendor not found' });

    return res.status(200).json({ vendor });
  } catch (error) {
    console.error('Get vendor error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to fetch vendor' });
  }
}

/**
 * POST /api/vendors
 */
export function createVendor(req, res) {
  try {
    const { name, phone, email, address, gst } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Validation error', message: 'Vendor name is required' });
    }

    const result = run(
      `INSERT INTO vendors (name, phone, email, address, gst) VALUES (?, ?, ?, ?, ?)`,
      [name.trim(), phone || null, email || null, address || null, gst || null],
    );

    const vendor = get('SELECT * FROM vendors WHERE id = ?', [result.lastInsertRowid]);

    logAudit({
      entity_type: 'vendor',
      entity_id: vendor.id,
      action: AUDIT_ACTIONS.CREATE,
      old_value: null,
      new_value: vendor,
      req,
    });

    return res.status(201).json({ success: true, vendor });
  } catch (error) {
    console.error('Create vendor error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to create vendor' });
  }
}

/**
 * PUT /api/vendors/:id
 */
export function updateVendor(req, res) {
  try {
    const id = Number(req.params?.id);
    if (!id) return res.status(400).json({ error: 'Validation error', message: 'Invalid vendor id' });

    const existing = get('SELECT * FROM vendors WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Not found', message: 'Vendor not found' });

    const { name, phone, email, address, gst } = req.body;

    const updates = [];
    const params = [];

    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }
    if (email !== undefined) { updates.push('email = ?'); params.push(email); }
    if (address !== undefined) { updates.push('address = ?'); params.push(address); }
    if (gst !== undefined) { updates.push('gst = ?'); params.push(gst); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Validation error', message: 'No fields to update' });
    }

    params.push(id);
    run(`UPDATE vendors SET ${updates.join(', ')} WHERE id = ?`, params);

    const updated = get('SELECT * FROM vendors WHERE id = ?', [id]);

    logAudit({
      entity_type: 'vendor',
      entity_id: id,
      action: AUDIT_ACTIONS.UPDATE,
      old_value: existing,
      new_value: updated,
      req,
    });

    return res.status(200).json({ success: true, vendor: updated });
  } catch (error) {
    console.error('Update vendor error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to update vendor' });
  }
}

/**
 * POST /api/vendors/bulk-import
 * Import multiple vendors from parsed Excel/CSV data
 * Body: { vendors: [{ name, phone, email, gst, address }] }
 * Duplicate check: name + phone
 */
export function bulkImportVendors(req, res) {
  try {
    const { vendors: vendorList } = req.body;

    if (!Array.isArray(vendorList) || vendorList.length === 0) {
      return res.status(400).json({ error: 'Validation error', message: 'vendors array is required and must not be empty' });
    }

    let imported = 0;
    let skipped = 0;

    for (const v of vendorList) {
      const name = (v.name || '').trim();
      if (!name) { skipped++; continue; }

      const phone = (v.phone || '').trim() || null;

      // Duplicate check: same name AND same phone
      const existing = get(
        'SELECT id FROM vendors WHERE LOWER(name) = LOWER(?) AND (phone = ? OR (phone IS NULL AND ? IS NULL))',
        [name, phone, phone]
      );
      if (existing) { skipped++; continue; }

      run(
        'INSERT INTO vendors (name, phone, email, address, gst) VALUES (?, ?, ?, ?, ?)',
        [name, phone, (v.email || '').trim() || null, (v.address || '').trim() || null, (v.gst || '').trim() || null]
      );
      imported++;
    }

    return res.status(201).json({ success: true, imported, skipped });
  } catch (error) {
    console.error('Bulk import vendors error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to import vendors' });
  }
}

/**
 * DELETE /api/vendors/:id
 */
export function deleteVendor(req, res) {
  try {
    const id = Number(req.params?.id);
    if (!id) return res.status(400).json({ error: 'Validation error', message: 'Invalid vendor id' });

    const existing = get('SELECT * FROM vendors WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Not found', message: 'Vendor not found' });

    logAudit({
      entity_type: 'vendor',
      entity_id: id,
      action: AUDIT_ACTIONS.DELETE,
      old_value: existing,
      new_value: null,
      req,
    });

    run('DELETE FROM vendors WHERE id = ?', [id]);

    return res.status(200).json({ success: true, message: 'Vendor deleted' });
  } catch (error) {
    console.error('Delete vendor error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to delete vendor' });
  }
}
