/**
 * Machine Parts Controller
 * CRUD operations for default parts list per machine product
 */

import { get, query, run } from '../config/database.js';
import { logAudit, AUDIT_ACTIONS, ENTITY_TYPES } from '../utils/auditLogger.js';

/**
 * Generate a part number from name + specification.
 * Format: PARTNAME-SPEC (uppercase, no spaces, no special chars except hyphen)
 */
function generatePartNumber(name, spec) {
  const cleanName = (name || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const cleanSpec = (spec || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!cleanName) return '';
  return cleanSpec ? `${cleanName}-${cleanSpec}` : cleanName;
}

/**
 * GET /api/products/machines/:machineId/parts
 * List all parts for a machine
 */
export function getPartsForMachine(req, res) {
  try {
    const machineId = Number(req.params?.machineId || req.params?.id);
    if (!machineId) {
      return res.status(400).json({ error: 'Validation error', message: 'Invalid machine id' });
    }

    const parts = query(
      'SELECT * FROM machine_parts WHERE machine_id = ? ORDER BY id ASC',
      [machineId],
    );

    return res.status(200).json({ parts });
  } catch (error) {
    console.error('Get machine parts error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to fetch machine parts' });
  }
}

/**
 * POST /api/products/machines/:machineId/parts
 * Add a part to a machine
 */
export function addPart(req, res) {
  try {
    const machineId = Number(req.params?.machineId || req.params?.id);
    if (!machineId) {
      return res.status(400).json({ error: 'Validation error', message: 'Invalid machine id' });
    }

    const { part_number, part_name, specification, unit, default_quantity } = req.body;

    if (!part_name || !part_name.trim()) {
      return res.status(400).json({ error: 'Validation error', message: 'Part name is required' });
    }

    // Duplicate protection: check name + specification + machine_id
    const existing = get(
      `SELECT id FROM machine_parts WHERE machine_id = ? AND LOWER(TRIM(part_name)) = ? AND LOWER(TRIM(COALESCE(specification, ''))) = ?`,
      [machineId, part_name.trim().toLowerCase(), (specification || '').trim().toLowerCase()]
    );
    if (existing) {
      return res.status(409).json({ error: 'Duplicate', message: 'This part already exists for this machine.' });
    }

    const finalPartNumber = part_number || generatePartNumber(part_name, specification);

    const result = run(
      `INSERT INTO machine_parts (machine_id, part_number, part_name, specification, unit, default_quantity)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        machineId,
        finalPartNumber || null,
        part_name.trim(),
        specification || null,
        unit || 'Nos',
        Number(default_quantity) || 1,
      ],
    );

    const newPart = get('SELECT * FROM machine_parts WHERE id = ?', [result.lastInsertRowid]);

    logAudit({
      entity_type: 'machine_part',
      entity_id: newPart.id,
      action: AUDIT_ACTIONS.CREATE,
      old_value: null,
      new_value: newPart,
      req,
    });

    return res.status(201).json({ success: true, part: newPart });
  } catch (error) {
    console.error('Add machine part error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to add part' });
  }
}

/**
 * PUT /api/products/machines/:machineId/parts/:partId
 * Update a part
 */
export function updatePart(req, res) {
  try {
    const partId = Number(req.params?.partId);
    if (!partId) {
      return res.status(400).json({ error: 'Validation error', message: 'Invalid part id' });
    }

    const existing = get('SELECT * FROM machine_parts WHERE id = ?', [partId]);
    if (!existing) {
      return res.status(404).json({ error: 'Not found', message: 'Part not found' });
    }

    const { part_number, part_name, specification, unit, default_quantity } = req.body;

    run(
      `UPDATE machine_parts SET
        part_number = COALESCE(?, part_number),
        part_name = COALESCE(?, part_name),
        specification = COALESCE(?, specification),
        unit = COALESCE(?, unit),
        default_quantity = COALESCE(?, default_quantity)
       WHERE id = ?`,
      [
        part_number !== undefined ? part_number : null,
        part_name !== undefined ? part_name : null,
        specification !== undefined ? specification : null,
        unit !== undefined ? unit : null,
        default_quantity !== undefined ? Number(default_quantity) : null,
        partId,
      ],
    );

    const updated = get('SELECT * FROM machine_parts WHERE id = ?', [partId]);

    logAudit({
      entity_type: 'machine_part',
      entity_id: partId,
      action: AUDIT_ACTIONS.UPDATE,
      old_value: existing,
      new_value: updated,
      req,
    });

    return res.status(200).json({ success: true, part: updated });
  } catch (error) {
    console.error('Update machine part error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to update part' });
  }
}

/**
 * DELETE /api/products/machines/:machineId/parts/:partId
 * Delete a part
 */
export function deletePart(req, res) {
  try {
    const partId = Number(req.params?.partId);
    if (!partId) {
      return res.status(400).json({ error: 'Validation error', message: 'Invalid part id' });
    }

    const existing = get('SELECT * FROM machine_parts WHERE id = ?', [partId]);
    if (!existing) {
      return res.status(404).json({ error: 'Not found', message: 'Part not found' });
    }

    logAudit({
      entity_type: 'machine_part',
      entity_id: partId,
      action: AUDIT_ACTIONS.DELETE,
      old_value: existing,
      new_value: null,
      req,
    });

    run('DELETE FROM machine_parts WHERE id = ?', [partId]);

    return res.status(200).json({ success: true, message: 'Part deleted' });
  } catch (error) {
    console.error('Delete machine part error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to delete part' });
  }
}

/**
 * PUT /api/products/machines/:machineId/parts/bulk
 * Replace all parts for a machine (bulk save)
 */
export function bulkSaveParts(req, res) {
  try {
    const machineId = Number(req.params?.machineId || req.params?.id);
    if (!machineId) {
      return res.status(400).json({ error: 'Validation error', message: 'Invalid machine id' });
    }

    const { parts } = req.body;
    if (!Array.isArray(parts)) {
      return res.status(400).json({ error: 'Validation error', message: 'parts must be an array' });
    }

    // Server-side duplicate detection within the submitted list
    const seen = new Set();
    for (const part of parts) {
      if (!part.part_name || !part.part_name.trim()) continue;
      const key = `${part.part_name.trim().toLowerCase()}|${(part.specification || '').trim().toLowerCase()}`;
      if (seen.has(key)) {
        return res.status(409).json({
          error: 'Duplicate',
          message: `This part already exists for this machine: "${part.part_name}" with specification "${part.specification || '-'}".`
        });
      }
      seen.add(key);
    }

    // Delete existing parts
    run('DELETE FROM machine_parts WHERE machine_id = ?', [machineId]);

    // Insert new parts with auto-generated part numbers
    const inserted = [];
    for (const part of parts) {
      if (!part.part_name || !part.part_name.trim()) continue;

      const finalPartNumber = part.part_number || generatePartNumber(part.part_name, part.specification);

      const result = run(
        `INSERT INTO machine_parts (machine_id, part_number, part_name, specification, unit, default_quantity)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          machineId,
          finalPartNumber || null,
          part.part_name.trim(),
          part.specification || null,
          part.unit || 'Nos',
          Number(part.default_quantity) || 1,
        ],
      );

      inserted.push(get('SELECT * FROM machine_parts WHERE id = ?', [result.lastInsertRowid]));
    }

    return res.status(200).json({ success: true, parts: inserted });
  } catch (error) {
    console.error('Bulk save machine parts error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to save parts' });
  }
}
