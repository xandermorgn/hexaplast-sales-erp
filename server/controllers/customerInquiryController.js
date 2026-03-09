import { get, query, run } from '../config/database.js';
import { generateNextInquiryNumber } from '../utils/numberGenerator.js';
import { logAudit, AUDIT_ACTIONS, ENTITY_TYPES } from '../utils/auditLogger.js';
import { buildDateFilter } from '../utils/filtering.js';
import { assertValidStatus } from '../utils/statusFlow.js';
import { emitSalesModuleUpdate } from '../utils/salesSocketEmitter.js';

const INQUIRY_SELECT = `
  SELECT
    ci.*,
    COALESCE(cup.display_name, cu.name, '-') AS created_by_name,
    cu.login_id AS created_by_login,
    COALESCE(aup.display_name, au.name, '-') AS assigned_to_name,
    au.login_id AS assigned_to_login
  FROM customer_inquiries ci
  LEFT JOIN users cu ON cu.id = ci.created_by
  LEFT JOIN user_profiles cup ON cup.user_id = ci.created_by
  LEFT JOIN users au ON au.id = ci.assigned_to
  LEFT JOIN user_profiles aup ON aup.user_id = ci.assigned_to
`;

function toNullableInt(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function getInquiryRecord(id) {
  return get('SELECT * FROM customer_inquiries WHERE id = ? AND is_deleted = 0', [id]);
}

export function createInquiry(req, res) {
  try {
    const inquiry_number = generateNextInquiryNumber();
    const created_by = req.user?.id && req.user.id > 0 ? req.user.id : null;
    // Auto-assign to the currently logged-in user
    const assigned_to = created_by;
    const inputStatus = req.body?.status || 'open';
    assertValidStatus('inquiry', inputStatus, 'Invalid inquiry status');

    const result = run(
      `INSERT INTO customer_inquiries (
        inquiry_number,
        created_by,
        company_name,
        authorized_person,
        authorized_phone,
        email,
        alternate_email,
        designation,
        gst_number,
        address,
        assigned_to,
        enquiry_source,
        category,
        industry,
        region,
        country,
        state,
        city,
        remarks,
        followup,
        status,
        is_deleted
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        inquiry_number,
        created_by,
        req.body?.company_name || null,
        req.body?.authorized_person || null,
        req.body?.authorized_phone || null,
        req.body?.email || null,
        req.body?.alternate_email || null,
        req.body?.designation || null,
        req.body?.gst_number || null,
        req.body?.address || null,
        assigned_to,
        req.body?.enquiry_source || null,
        req.body?.category || null,
        req.body?.industry || null,
        req.body?.region || null,
        req.body?.country || null,
        req.body?.state || null,
        req.body?.city || null,
        req.body?.remarks || null,
        req.body?.followup || null,
        inputStatus,
      ],
    );

    const inquiry = get(`${INQUIRY_SELECT} WHERE ci.id = ? AND ci.is_deleted = 0`, [result.lastInsertRowid]);

    logAudit({
      entity_type: ENTITY_TYPES.CUSTOMER_INQUIRY,
      entity_id: inquiry.id,
      action: AUDIT_ACTIONS.CREATE,
      old_value: null,
      new_value: inquiry,
      req,
    });

    emitSalesModuleUpdate({
      module: 'inquiry',
      action: inputStatus === 'converted' ? 'convert' : 'create',
      id: inquiry.id,
    });

    return res.status(201).json({ success: true, inquiry });
  } catch (error) {
    const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
    console.error('Create inquiry error:', error);
    return res.status(statusCode).json({
      error: statusCode === 500 ? 'Internal server error' : 'Validation error',
      message: error.message || 'Failed to create inquiry',
    });
  }
}

export function getInquiries(req, res) {
  try {
    let sql = `${INQUIRY_SELECT} WHERE ci.is_deleted = 0`;
    const params = [];

    const dateFilter = buildDateFilter(req.query || {}, 'ci.created_at', 'ci.created_by');
    sql += dateFilter.clause;
    params.push(...dateFilter.params);

    if (req.query?.assigned_to !== undefined && req.query?.assigned_to !== null && req.query?.assigned_to !== '') {
      const assignedToId = toNullableInt(req.query.assigned_to);
      if (assignedToId !== null) {
        sql += ' AND ci.assigned_to = ?';
        params.push(assignedToId);
      }
    }

    sql += ' ORDER BY ci.created_at DESC, ci.id DESC';

    const inquiries = query(sql, params);
    return res.status(200).json({ count: inquiries.length, inquiries });
  } catch (error) {
    console.error('Get inquiries error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to fetch inquiries' });
  }
}

export function getInquiryById(req, res) {
  try {
    const id = toNullableInt(req.params.id);
    if (id === null) {
      return res.status(400).json({ error: 'Validation error', message: 'Invalid inquiry id' });
    }

    const inquiry = get(`${INQUIRY_SELECT} WHERE ci.id = ? AND ci.is_deleted = 0`, [id]);
    if (!inquiry) {
      return res.status(404).json({ error: 'Not found', message: 'Inquiry not found' });
    }

    return res.status(200).json({ inquiry });
  } catch (error) {
    console.error('Get inquiry by id error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to fetch inquiry' });
  }
}

export function updateInquiry(req, res) {
  try {
    const id = toNullableInt(req.params.id);
    if (id === null) {
      return res.status(400).json({ error: 'Validation error', message: 'Invalid inquiry id' });
    }

    const existing = getInquiryRecord(id);
    if (!existing) {
      return res.status(404).json({ error: 'Not found', message: 'Inquiry not found' });
    }

    const nextStatus = Object.prototype.hasOwnProperty.call(req.body || {}, 'status')
      ? (req.body.status || 'open')
      : existing.status;
    assertValidStatus('inquiry', nextStatus, 'Invalid inquiry status');

    if ((existing.status === 'converted' || existing.status === 'closed') && nextStatus === existing.status) {
      const editableKeys = new Set(['status']);
      const changingOtherFields = Object.keys(req.body || {}).some((key) => !editableKeys.has(key));
      if (changingOtherFields) {
        return res.status(400).json({
          error: 'Validation error',
          message: `Inquiry is ${existing.status} and cannot be edited`,
        });
      }
    }

    const updates = [];
    const params = [];

    const textFields = [
      'company_name',
      'authorized_person',
      'authorized_phone',
      'email',
      'alternate_email',
      'designation',
      'gst_number',
      'address',
      'enquiry_source',
      'category',
      'industry',
      'region',
      'country',
      'state',
      'city',
      'remarks',
      'followup',
    ];

    for (const field of textFields) {
      if (Object.prototype.hasOwnProperty.call(req.body || {}, field)) {
        updates.push(`${field} = ?`);
        params.push(req.body[field] || null);
      }
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'assigned_to')) {
      updates.push('assigned_to = ?');
      params.push(toNullableInt(req.body.assigned_to));
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'status')) {
      updates.push('status = ?');
      params.push(nextStatus);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Validation error', message: 'No fields provided to update' });
    }

    params.push(id);
    run(`UPDATE customer_inquiries SET ${updates.join(', ')} WHERE id = ? AND is_deleted = 0`, params);

    const inquiry = get(`${INQUIRY_SELECT} WHERE ci.id = ? AND ci.is_deleted = 0`, [id]);

    logAudit({
      entity_type: ENTITY_TYPES.CUSTOMER_INQUIRY,
      entity_id: id,
      action: AUDIT_ACTIONS.UPDATE,
      old_value: existing,
      new_value: inquiry,
      req,
    });

    emitSalesModuleUpdate({
      module: 'inquiry',
      action: nextStatus === 'converted' && existing.status !== 'converted' ? 'convert' : 'update',
      id,
    });

    return res.status(200).json({ success: true, inquiry });
  } catch (error) {
    const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
    console.error('Update inquiry error:', error);
    return res.status(statusCode).json({
      error: statusCode === 500 ? 'Internal server error' : 'Validation error',
      message: error.message || 'Failed to update inquiry',
    });
  }
}

export function deleteInquiry(req, res) {
  try {
    const id = toNullableInt(req.params.id);
    if (id === null) {
      return res.status(400).json({ error: 'Validation error', message: 'Invalid inquiry id' });
    }

    const existing = getInquiryRecord(id);
    if (!existing) {
      return res.status(404).json({ error: 'Not found', message: 'Inquiry not found' });
    }

    run('UPDATE customer_inquiries SET is_deleted = 1 WHERE id = ? AND is_deleted = 0', [id]);

    logAudit({
      entity_type: ENTITY_TYPES.CUSTOMER_INQUIRY,
      entity_id: id,
      action: AUDIT_ACTIONS.DELETE,
      old_value: existing,
      new_value: { is_deleted: 1 },
      req,
    });

    emitSalesModuleUpdate({ module: 'inquiry', action: 'delete', id });

    return res.status(200).json({ success: true, message: 'Inquiry deleted' });
  } catch (error) {
    console.error('Delete inquiry error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to delete inquiry' });
  }
}
