/**
 * Follow-Up / Reminder Controller
 * CRUD for follow-up reminders across enquiry, quotation, performa, workorder modules.
 * Also provides a "due now" endpoint for the notification bell.
 */

import { get, query, run } from '../config/database.js';

const VALID_ENTITY_TYPES = ['enquiry', 'quotation', 'performa', 'workorder'];

/**
 * POST /api/followups
 * Create a follow-up reminder
 * Body: { entity_type, entity_id, note, reminder_datetime }
 */
export function createFollowUp(req, res) {
  try {
    const { entity_type, entity_id, note, reminder_datetime } = req.body;
    const employee_id = req.user?.id;

    if (!entity_type || !VALID_ENTITY_TYPES.includes(entity_type)) {
      return res.status(400).json({ error: 'Validation error', message: `entity_type must be one of: ${VALID_ENTITY_TYPES.join(', ')}` });
    }
    if (!entity_id) {
      return res.status(400).json({ error: 'Validation error', message: 'entity_id is required' });
    }
    if (!reminder_datetime) {
      return res.status(400).json({ error: 'Validation error', message: 'reminder_datetime is required' });
    }
    if (!employee_id) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Must be logged in' });
    }

    const result = run(
      `INSERT INTO follow_ups (entity_type, entity_id, employee_id, note, reminder_datetime, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [entity_type, Number(entity_id), employee_id, note || null, reminder_datetime]
    );

    const followUp = get('SELECT * FROM follow_ups WHERE id = ?', [result.lastInsertRowid]);
    return res.status(201).json({ success: true, follow_up: followUp });
  } catch (error) {
    console.error('Create follow-up error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to create follow-up' });
  }
}

/**
 * GET /api/followups
 * List all follow-ups with optional filters: ?status=pending&entity_type=enquiry
 */
export function getAllFollowUps(req, res) {
  try {
    let sql = `
      SELECT
        f.*,
        u.name AS employee_name,
        CASE f.entity_type
          WHEN 'enquiry' THEN (SELECT ci.company_name FROM customer_inquiries ci WHERE ci.id = f.entity_id)
          WHEN 'quotation' THEN (SELECT ci.company_name FROM quotations q LEFT JOIN customer_inquiries ci ON q.inquiry_id = ci.id WHERE q.id = f.entity_id)
          WHEN 'performa' THEN (SELECT ci.company_name FROM performa_invoices p LEFT JOIN customer_inquiries ci ON p.inquiry_id = ci.id WHERE p.id = f.entity_id)
          WHEN 'workorder' THEN (SELECT ci.company_name FROM work_orders w LEFT JOIN customer_inquiries ci ON w.inquiry_id = ci.id WHERE w.id = f.entity_id)
        END AS customer_name,
        CASE f.entity_type
          WHEN 'enquiry' THEN (SELECT ci.inquiry_number FROM customer_inquiries ci WHERE ci.id = f.entity_id)
          WHEN 'quotation' THEN (SELECT q.quotation_number FROM quotations q WHERE q.id = f.entity_id)
          WHEN 'performa' THEN (SELECT p.performa_number FROM performa_invoices p WHERE p.id = f.entity_id)
          WHEN 'workorder' THEN (SELECT w.work_order_number FROM work_orders w WHERE w.id = f.entity_id)
        END AS entity_number
      FROM follow_ups f
      LEFT JOIN users u ON f.employee_id = u.id
    `;

    const conditions = [];
    const params = [];

    const statusFilter = req.query?.status;
    if (statusFilter && ['pending', 'completed', 'missed'].includes(statusFilter)) {
      conditions.push('f.status = ?');
      params.push(statusFilter);
    }

    const entityTypeFilter = req.query?.entity_type;
    if (entityTypeFilter && VALID_ENTITY_TYPES.includes(entityTypeFilter)) {
      conditions.push('f.entity_type = ?');
      params.push(entityTypeFilter);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY f.reminder_datetime ASC';

    const rows = query(sql, params);
    return res.status(200).json({ follow_ups: rows });
  } catch (error) {
    console.error('Get follow-ups error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to fetch follow-ups' });
  }
}

/**
 * GET /api/followups/entity/:entity_type/:entity_id
 * Get follow-ups for a specific entity
 */
export function getFollowUpsForEntity(req, res) {
  try {
    const { entity_type, entity_id } = req.params;

    if (!entity_type || !VALID_ENTITY_TYPES.includes(entity_type)) {
      return res.status(400).json({ error: 'Validation error', message: 'Invalid entity_type' });
    }

    const rows = query(
      `SELECT f.*, u.name AS employee_name
       FROM follow_ups f
       LEFT JOIN users u ON f.employee_id = u.id
       WHERE f.entity_type = ? AND f.entity_id = ?
       ORDER BY f.reminder_datetime ASC`,
      [entity_type, Number(entity_id)]
    );

    return res.status(200).json({ follow_ups: rows });
  } catch (error) {
    console.error('Get entity follow-ups error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to fetch follow-ups' });
  }
}

/**
 * PUT /api/followups/:id
 * Update a follow-up (status, note, reminder_datetime)
 */
export function updateFollowUp(req, res) {
  try {
    const id = Number(req.params?.id);
    if (!id) return res.status(400).json({ error: 'Validation error', message: 'Invalid follow-up id' });

    const existing = get('SELECT * FROM follow_ups WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Not found', message: 'Follow-up not found' });

    const { status, note, reminder_datetime } = req.body;
    const updates = [];
    const params = [];

    if (status !== undefined) {
      if (!['pending', 'completed', 'missed'].includes(status)) {
        return res.status(400).json({ error: 'Validation error', message: 'Invalid status' });
      }
      updates.push('status = ?');
      params.push(status);
    }
    if (note !== undefined) { updates.push('note = ?'); params.push(note); }
    if (reminder_datetime !== undefined) { updates.push('reminder_datetime = ?'); params.push(reminder_datetime); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Validation error', message: 'No fields to update' });
    }

    params.push(id);
    run(`UPDATE follow_ups SET ${updates.join(', ')} WHERE id = ?`, params);

    const updated = get('SELECT * FROM follow_ups WHERE id = ?', [id]);
    return res.status(200).json({ success: true, follow_up: updated });
  } catch (error) {
    console.error('Update follow-up error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to update follow-up' });
  }
}

/**
 * DELETE /api/followups/:id
 */
export function deleteFollowUp(req, res) {
  try {
    const id = Number(req.params?.id);
    if (!id) return res.status(400).json({ error: 'Validation error', message: 'Invalid follow-up id' });

    const existing = get('SELECT * FROM follow_ups WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Not found', message: 'Follow-up not found' });

    run('DELETE FROM follow_ups WHERE id = ?', [id]);
    return res.status(200).json({ success: true, message: 'Follow-up deleted' });
  } catch (error) {
    console.error('Delete follow-up error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to delete follow-up' });
  }
}

/**
 * GET /api/followups/due
 * Get follow-ups that are due (past reminder_datetime and still pending).
 * Also auto-marks overdue ones as 'missed' if more than 1 hour past due.
 */
export function getDueFollowUps(req, res) {
  try {
    const now = new Date().toISOString();
    const thirtyMinFromNow = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    // Auto-mark overdue (> 1 hour past) as missed
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    run(
      `UPDATE follow_ups SET status = 'missed'
       WHERE status = 'pending' AND reminder_datetime < ?`,
      [oneHourAgo]
    );

    // Get currently due (pending and reminder_datetime <= now)
    const due = query(
      `SELECT f.*, u.name AS employee_name
       FROM follow_ups f
       LEFT JOIN users u ON f.employee_id = u.id
       WHERE f.status = 'pending' AND f.reminder_datetime <= ?
       ORDER BY f.reminder_datetime ASC`,
      [now]
    );

    // Get upcoming (pending and reminder_datetime within next 30 minutes)
    const upcoming = query(
      `SELECT f.*, u.name AS employee_name
       FROM follow_ups f
       LEFT JOIN users u ON f.employee_id = u.id
       WHERE f.status = 'pending' AND f.reminder_datetime > ? AND f.reminder_datetime <= ?
       ORDER BY f.reminder_datetime ASC`,
      [now, thirtyMinFromNow]
    );

    return res.status(200).json({ follow_ups: due, upcoming, count: due.length + upcoming.length });
  } catch (error) {
    console.error('Get due follow-ups error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to fetch due follow-ups' });
  }
}
