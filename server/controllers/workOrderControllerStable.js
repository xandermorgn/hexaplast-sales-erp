import { get, query, run } from '../config/database.js';
import { generateNextWorkOrderNumber } from '../utils/numberGenerator.js';
import { logAudit, AUDIT_ACTIONS, ENTITY_TYPES } from '../utils/auditLogger.js';
import { buildDateFilter, buildVisibilityFilter } from '../utils/filtering.js';
import { calculateLineItemTotals } from '../utils/calculateTotals.js';
import { assertValidStatus, assertValidTransition } from '../utils/statusFlow.js';
import { emitSalesModuleUpdate } from '../utils/salesSocketEmitter.js';

const PRODUCTION_ERP_URL = (process.env.PRODUCTION_ERP_URL || 'http://localhost:3001').replace(/\/$/, '');
const PRODUCTION_API_SECRET = process.env.PRODUCTION_API_SECRET || '';

function toNullableInt(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function toNumber(value, fallback = 0) {
  const parsed = Number.parseFloat(String(value));
  return Number.isNaN(parsed) ? fallback : parsed;
}

function getWorkOrderRecord(id) {
  return get('SELECT * FROM work_orders WHERE id = ? AND is_deleted = 0', [id]);
}

function getPerformaSnapshot(performaId) {
  const performa = get('SELECT * FROM performa_invoices WHERE id = ? AND is_deleted = 0', [performaId]);
  if (!performa) return null;

  const items = query(
    `SELECT product_type, product_id, quantity, price, discount_percent, gst_percent
     FROM performa_items
     WHERE performa_id = ?
     ORDER BY id ASC`,
    [performaId],
  );

  return { performa, items };
}

function calculateItems(items) {
  const normalized = items.map((raw) => {
    const quantity = Math.max(1, toNumber(raw.quantity, 1));
    const price = Math.max(0, toNumber(raw.price, 0));
    const discount_percent = Math.max(0, toNumber(raw.discount_percent, 0));
    const gst_percent = Math.max(0, toNumber(raw.gst_percent, 0));

    const totals = calculateLineItemTotals({ quantity, price, discount_percent, gst_percent });

    return {
      product_type: raw.product_type,
      product_id: toNullableInt(raw.product_id),
      category_name: raw.category_name || null,
      sub_category: raw.sub_category || null,
      product_name: raw.product_name || null,
      model_number: raw.model_number || null,
      hsn_sac_code: raw.hsn_sac_code || null,
      unit: raw.unit || null,
      quantity,
      price,
      discount_percent,
      discount_amount: totals.discount_amount,
      gst_percent,
      total: totals.total,
      base_amount: totals.base,
      gst_amount: totals.gst_amount,
    };
  });

  return {
    items: normalized,
    subtotal: normalized.reduce((sum, item) => sum + item.base_amount, 0),
    total_discount: normalized.reduce((sum, item) => sum + item.discount_amount, 0),
    total_gst: normalized.reduce((sum, item) => sum + item.gst_amount, 0),
    total_amount: normalized.reduce((sum, item) => sum + item.total, 0),
  };
}

function getWorkOrderByIdWithRelations(id) {
  const workOrder = get(
    `SELECT
      wo.*,
      p.performa_number,
      p.id AS performa_id,
      ci.inquiry_number,
      ci.company_name,
      ci.authorized_person,
      ci.authorized_phone,
      ci.email,
      ci.address,
      COALESCE(cbp.display_name, cb.name, '-') AS created_by_name,
      COALESCE(pp.display_name, pu.name, '-') AS prepared_by_name,
      COALESCE(chp.display_name, chu.name, '-') AS checked_by_name,
      COALESCE(ap.display_name, au.name, '-') AS approved_by_name
    FROM work_orders wo
    LEFT JOIN performa_invoices p ON p.id = wo.performa_id
    LEFT JOIN customer_inquiries ci ON ci.id = wo.inquiry_id
    LEFT JOIN users cb ON cb.id = wo.created_by
    LEFT JOIN user_profiles cbp ON cbp.user_id = wo.created_by
    LEFT JOIN users pu ON pu.id = wo.prepared_by
    LEFT JOIN user_profiles pp ON pp.user_id = wo.prepared_by
    LEFT JOIN users chu ON chu.id = wo.checked_by
    LEFT JOIN user_profiles chp ON chp.user_id = wo.checked_by
    LEFT JOIN users au ON au.id = wo.approved_by
    LEFT JOIN user_profiles ap ON ap.user_id = wo.approved_by
    WHERE wo.id = ? AND wo.is_deleted = 0`,
    [id],
  );

  if (!workOrder) return null;

  const items = query(
    `SELECT
      woi.*,
      CASE WHEN woi.product_type = 'machine' THEN mp.product_name ELSE sp.product_name END AS product_name,
      CASE WHEN woi.product_type = 'machine' THEN mp.product_code ELSE sp.product_code END AS product_code
    FROM work_order_items woi
    LEFT JOIN machine_products mp ON woi.product_type = 'machine' AND mp.id = woi.product_id
    LEFT JOIN spare_products sp ON woi.product_type = 'spare' AND sp.id = woi.product_id
    WHERE woi.work_order_id = ?
    ORDER BY woi.id ASC`,
    [id],
  );

  return { ...workOrder, items };
}

function toIsoNow() {
  return new Date().toISOString();
}

function canOverrideStatuses(req) {
  return req.user?.role === 'server_admin';
}

function isMasterAdmin(req) {
  return req.user?.role === 'master_admin';
}

function canManageApproval(req) {
  return isMasterAdmin(req);
}

function buildProductionPayload(workOrder) {
  return {
    work_order_number: workOrder.work_order_number,
    inquiry_details: {
      id: workOrder.inquiry_id,
      inquiry_number: workOrder.inquiry_number,
      company_name: workOrder.company_name,
      authorized_person: workOrder.authorized_person,
      authorized_phone: workOrder.authorized_phone,
      email: workOrder.email,
      address: workOrder.address,
    },
    products: Array.isArray(workOrder.items)
      ? workOrder.items.map((item) => ({
          product_type: item.product_type,
          product_id: item.product_id,
          product_name: item.product_name,
          product_code: item.product_code,
          quantity: item.quantity,
          price: item.price,
          discount_percent: item.discount_percent,
          discount_amount: item.discount_amount,
          gst_percent: item.gst_percent,
          total: item.total,
        }))
      : [],
    totals: {
      subtotal: workOrder.subtotal,
      total_discount: workOrder.total_discount,
      total_gst: workOrder.total_gst,
      total_amount: workOrder.total_amount,
    },
  };
}

async function pushWorkOrderToProduction(workOrder) {
  if (!PRODUCTION_API_SECRET) {
    const error = new Error('Production bridge is not configured (missing PRODUCTION_API_SECRET)');
    error.statusCode = 500;
    throw error;
  }

  const response = await fetch(`${PRODUCTION_ERP_URL}/api/external/work-orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-secret': PRODUCTION_API_SECRET,
    },
    body: JSON.stringify(buildProductionPayload(workOrder)),
  });

  let responseData = null;
  try {
    responseData = await response.json();
  } catch {
    responseData = null;
  }

  if (!response.ok) {
    const message = responseData?.message || `Production ERP push failed with status ${response.status}`;
    const error = new Error(message);
    error.statusCode = 502;
    throw error;
  }

  return responseData;
}

function insertWorkOrder({ performa_id = null, quotation_id = null, inquiry_id, created_by, prepared_by, checked_by, approved_by, status, work_order_date, calibration_nabl, packing, delivery_date, remarks, apply_gst, extra_charge_gst_percent, extra_charge_1, extra_charge_2, advance_display, advance_date, advance_description, advance_amount, currency = 'INR', rawItems }) {
  const calculated = calculateItems(rawItems);
  const work_order_number = generateNextWorkOrderNumber();

  const insert = run(
    `INSERT INTO work_orders (
      work_order_number,
      performa_id,
      quotation_id,
      inquiry_id,
      created_by,
      prepared_by,
      checked_by,
      approved_by,
      subtotal,
      total_discount,
      total_gst,
      total_amount,
      status,
      work_order_date,
      calibration_nabl,
      packing,
      delivery_date,
      remarks,
      apply_gst,
      extra_charge_gst_percent,
      extra_charge_1,
      extra_charge_2,
      advance_display,
      advance_date,
      advance_description,
      advance_amount,
      currency,
      is_deleted
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      work_order_number,
      performa_id,
      quotation_id,
      inquiry_id,
      created_by,
      prepared_by,
      checked_by,
      approved_by,
      calculated.subtotal,
      calculated.total_discount,
      calculated.total_gst,
      calculated.total_amount,
      status,
      work_order_date || null,
      calibration_nabl || null,
      packing || null,
      delivery_date || null,
      remarks || null,
      apply_gst !== undefined ? (apply_gst ? 1 : 0) : 1,
      toNumber(extra_charge_gst_percent, 0),
      toNumber(extra_charge_1, 0),
      toNumber(extra_charge_2, 0),
      advance_display ? 1 : 0,
      advance_date || null,
      advance_description || null,
      toNumber(advance_amount, 0),
      currency,
    ],
  );

  const workOrderId = insert.lastInsertRowid;

  for (const item of calculated.items) {
    run(
      `INSERT INTO work_order_items (
        work_order_id,
        product_type,
        product_id,
        category_name,
        sub_category,
        product_name,
        model_number,
        hsn_sac_code,
        unit,
        quantity,
        price,
        discount_percent,
        discount_amount,
        gst_percent,
        total
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        workOrderId,
        item.product_type,
        item.product_id,
        item.category_name || null,
        item.sub_category || null,
        item.product_name || null,
        item.model_number || null,
        item.hsn_sac_code || null,
        item.unit || null,
        item.quantity,
        item.price,
        item.discount_percent,
        item.discount_amount,
        item.gst_percent,
        item.total,
      ],
    );
  }

  return {
    workOrderId,
    work_order_number,
    totals: {
      subtotal: calculated.subtotal,
      total_discount: calculated.total_discount,
      total_gst: calculated.total_gst,
      total_amount: calculated.total_amount,
    },
  };
}

export function createWorkOrder(req, res) {
  try {
    const inquiry_id = toNullableInt(req.body?.inquiry_id);
    if (!inquiry_id) {
      return res.status(400).json({ error: 'Validation error', message: 'inquiry_id is required' });
    }

    const inquiry = get('SELECT id FROM customer_inquiries WHERE id = ? AND is_deleted = 0', [inquiry_id]);
    if (!inquiry) {
      return res.status(400).json({ error: 'Validation error', message: 'Invalid inquiry_id' });
    }

    const status = req.body?.status || 'generated';
    assertValidStatus('work_order', status, 'Invalid work order status');

    if (status !== 'generated' && !canOverrideStatuses(req)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only server_admin can create work orders in non-generated state',
      });
    }

    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (items.length === 0) {
      return res.status(400).json({ error: 'Validation error', message: 'At least one work order item is required' });
    }

    const { workOrderId, work_order_number, totals } = insertWorkOrder({
      performa_id: toNullableInt(req.body?.performa_id),
      quotation_id: toNullableInt(req.body?.quotation_id),
      inquiry_id,
      created_by: req.user?.id || null,
      prepared_by: toNullableInt(req.body?.prepared_by),
      checked_by: toNullableInt(req.body?.checked_by),
      approved_by: toNullableInt(req.body?.approved_by),
      status,
      work_order_date: req.body?.work_order_date,
      calibration_nabl: req.body?.calibration_nabl,
      packing: req.body?.packing,
      delivery_date: req.body?.delivery_date,
      remarks: req.body?.remarks,
      apply_gst: req.body?.apply_gst,
      extra_charge_gst_percent: req.body?.extra_charge_gst_percent,
      extra_charge_1: req.body?.extra_charge_1,
      extra_charge_2: req.body?.extra_charge_2,
      advance_display: req.body?.advance_display,
      advance_date: req.body?.advance_date,
      advance_description: req.body?.advance_description,
      advance_amount: req.body?.advance_amount,
      currency: req.body?.currency || 'INR',
      rawItems: items,
    });

    const workOrder = getWorkOrderByIdWithRelations(workOrderId);

    logAudit({
      entity_type: ENTITY_TYPES.WORK_ORDER,
      entity_id: workOrderId,
      action: AUDIT_ACTIONS.CREATE,
      old_value: null,
      new_value: workOrder,
      req,
    });

    emitSalesModuleUpdate({ module: 'work_order', action: status === 'sent_to_production' || status === 'completed' ? 'convert' : 'create', id: workOrderId });

    return res.status(201).json({ success: true, work_order: workOrder, totals });
  } catch (error) {
    const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
    console.error('Create work order error:', error);
    return res.status(statusCode).json({
      error: statusCode === 500 ? 'Internal server error' : 'Validation error',
      message: error.message || 'Failed to create work order',
    });
  }
}

export function createWorkOrderFromPerforma(req, res) {
  try {
    const performaId = toNullableInt(req.params.performa_id);
    if (!performaId) {
      return res.status(400).json({ error: 'Validation error', message: 'Invalid performa id' });
    }

    const snapshot = getPerformaSnapshot(performaId);
    if (!snapshot) {
      return res.status(404).json({ error: 'Not found', message: 'Performa not found' });
    }

    if (snapshot.performa.status === 'converted') {
      return res.status(400).json({ error: 'Validation error', message: 'Performa already converted' });
    }

    if (snapshot.items.length === 0) {
      return res.status(400).json({ error: 'Validation error', message: 'Performa has no items' });
    }

    const status = req.body?.status || 'generated';
    assertValidStatus('work_order', status, 'Invalid work order status');

    if (status !== 'generated' && !canOverrideStatuses(req)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only server_admin can create work orders in non-generated state',
      });
    }

    const { workOrderId, work_order_number, totals } = insertWorkOrder({
      performa_id: performaId,
      inquiry_id: snapshot.performa.inquiry_id,
      created_by: req.user?.id || null,
      prepared_by: toNullableInt(req.body?.prepared_by),
      checked_by: toNullableInt(req.body?.checked_by),
      approved_by: toNullableInt(req.body?.approved_by),
      status,
      currency: req.body?.currency || snapshot.performa.currency || 'INR',
      rawItems: snapshot.items,
    });

    run('UPDATE performa_invoices SET status = ? WHERE id = ? AND is_deleted = 0', ['converted', performaId]);

    const workOrder = getWorkOrderByIdWithRelations(workOrderId);

    logAudit({
      entity_type: ENTITY_TYPES.WORK_ORDER,
      entity_id: workOrderId,
      action: AUDIT_ACTIONS.CREATE,
      old_value: { source_performa_id: performaId },
      new_value: workOrder,
      req,
    });

    emitSalesModuleUpdate({ module: 'performa', action: 'convert', id: performaId });
    emitSalesModuleUpdate({ module: 'work_order', action: 'create', id: workOrderId });

    return res.status(201).json({ success: true, work_order: workOrder, totals });
  } catch (error) {
    const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
    console.error('Create work order from performa error:', error);
    return res.status(statusCode).json({
      error: statusCode === 500 ? 'Internal server error' : 'Validation error',
      message: error.message || 'Failed to create work order from performa',
    });
  }
}

export function getWorkOrders(req, res) {
  try {
    let sql = `SELECT
      wo.*,
      p.performa_number,
      ci.inquiry_number,
      ci.company_name,
      ci.authorized_person,
      COALESCE(cbp.display_name, cb.name, '-') AS created_by_name,
      COALESCE(pp.display_name, pu.name, '-') AS prepared_by_name,
      COALESCE(chp.display_name, chu.name, '-') AS checked_by_name,
      COALESCE(ap.display_name, au.name, '-') AS approved_by_name
    FROM work_orders wo
    LEFT JOIN performa_invoices p ON p.id = wo.performa_id
    LEFT JOIN customer_inquiries ci ON ci.id = wo.inquiry_id
    LEFT JOIN users cb ON cb.id = wo.created_by
    LEFT JOIN user_profiles cbp ON cbp.user_id = wo.created_by
    LEFT JOIN users pu ON pu.id = wo.prepared_by
    LEFT JOIN user_profiles pp ON pp.user_id = wo.prepared_by
    LEFT JOIN users chu ON chu.id = wo.checked_by
    LEFT JOIN user_profiles chp ON chp.user_id = wo.checked_by
    LEFT JOIN users au ON au.id = wo.approved_by
    LEFT JOIN user_profiles ap ON ap.user_id = wo.approved_by
    WHERE wo.is_deleted = 0`;

    const filter = buildDateFilter(req.query || {}, 'wo.created_at', 'wo.created_by');
    const params = [...filter.params];
    sql += filter.clause;

    // Data visibility: sub employees see only their own data
    const vis = buildVisibilityFilter(req, 'wo.created_by');
    sql += vis.clause;
    params.push(...vis.params);

    if (req.query?.status) {
      sql += ' AND wo.status = ?';
      params.push(String(req.query.status));
    }

    sql += ' ORDER BY wo.created_at DESC, wo.id DESC';

    const workOrders = query(sql, params);
    return res.status(200).json({ count: workOrders.length, work_orders: workOrders });
  } catch (error) {
    console.error('Get work orders error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to fetch work orders' });
  }
}

export function getWorkOrderById(req, res) {
  try {
    const id = toNullableInt(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'Validation error', message: 'Invalid work order id' });
    }

    const workOrder = getWorkOrderByIdWithRelations(id);
    if (!workOrder) {
      return res.status(404).json({ error: 'Not found', message: 'Work order not found' });
    }

    return res.status(200).json({ work_order: workOrder });
  } catch (error) {
    console.error('Get work order by id error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to fetch work order' });
  }
}

export function updateWorkOrder(req, res) {
  try {
    const id = toNullableInt(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'Validation error', message: 'Invalid work order id' });
    }

    const existing = getWorkOrderRecord(id);
    if (!existing) {
      return res.status(404).json({ error: 'Not found', message: 'Work order not found' });
    }

    if (!canOverrideStatuses(req) && ['approved', 'sent_to_production', 'completed', 'rejected'].includes(existing.status)) {
      return res.status(400).json({
        error: 'Validation error',
        message: `Work order in ${existing.status} state cannot be edited`,
      });
    }

    const nextStatus = Object.prototype.hasOwnProperty.call(req.body || {}, 'status')
      ? (req.body.status || existing.status)
      : existing.status;
    assertValidStatus('work_order', nextStatus, 'Invalid work order status');
    if (!canOverrideStatuses(req)) {
      assertValidTransition('work_order', existing.status, nextStatus);
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'approved_by') && !canOverrideStatuses(req)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'approved_by cannot be edited directly',
      });
    }

    const protectedStatusChanges = new Set(['approved', 'rejected', 'sent_to_production']);
    if (!canOverrideStatuses(req) && nextStatus !== existing.status && protectedStatusChanges.has(nextStatus)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Status transition requires approval workflow',
      });
    }

    const hasItems = Array.isArray(req.body?.items);
    let totals = {
      subtotal: existing.subtotal || 0,
      total_discount: existing.total_discount || 0,
      total_gst: existing.total_gst || 0,
      total_amount: existing.total_amount || 0,
    };

    if (hasItems) {
      const items = req.body.items;
      if (items.length === 0) {
        return res.status(400).json({ error: 'Validation error', message: 'At least one work order item is required' });
      }

      const calculated = calculateItems(items);
      totals = {
        subtotal: calculated.subtotal,
        total_discount: calculated.total_discount,
        total_gst: calculated.total_gst,
        total_amount: calculated.total_amount,
      };

      run('DELETE FROM work_order_items WHERE work_order_id = ?', [id]);
      for (const item of calculated.items) {
        run(
          `INSERT INTO work_order_items (
            work_order_id, product_type, product_id,
            category_name, sub_category, product_name, model_number, hsn_sac_code, unit,
            quantity, price, discount_percent, discount_amount, gst_percent, total
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            item.product_type,
            item.product_id,
            item.category_name || null,
            item.sub_category || null,
            item.product_name || null,
            item.model_number || null,
            item.hsn_sac_code || null,
            item.unit || null,
            item.quantity,
            item.price,
            item.discount_percent,
            item.discount_amount,
            item.gst_percent,
            item.total,
          ],
        );
      }
    }

    const hasProp = (key) => Object.prototype.hasOwnProperty.call(req.body || {}, key);

    run(
      `UPDATE work_orders
       SET performa_id = ?,
           quotation_id = ?,
           inquiry_id = ?,
           prepared_by = ?,
           checked_by = ?,
           approved_by = ?,
           subtotal = ?,
           total_discount = ?,
           total_gst = ?,
           total_amount = ?,
           status = ?,
           work_order_date = ?,
           calibration_nabl = ?,
           packing = ?,
           delivery_date = ?,
           remarks = ?,
           apply_gst = ?,
           extra_charge_gst_percent = ?,
           extra_charge_1 = ?,
           extra_charge_2 = ?,
           advance_display = ?,
           advance_date = ?,
           advance_description = ?,
           advance_amount = ?,
           currency = ?
       WHERE id = ? AND is_deleted = 0`,
      [
        hasProp('performa_id') ? toNullableInt(req.body.performa_id) : existing.performa_id,
        hasProp('quotation_id') ? toNullableInt(req.body.quotation_id) : (existing.quotation_id || null),
        hasProp('inquiry_id') ? toNullableInt(req.body.inquiry_id) : existing.inquiry_id,
        hasProp('prepared_by') ? toNullableInt(req.body.prepared_by) : existing.prepared_by,
        hasProp('checked_by') ? toNullableInt(req.body.checked_by) : existing.checked_by,
        hasProp('approved_by') ? toNullableInt(req.body.approved_by) : existing.approved_by,
        totals.subtotal,
        totals.total_discount,
        totals.total_gst,
        totals.total_amount,
        nextStatus,
        hasProp('work_order_date') ? (req.body.work_order_date || null) : (existing.work_order_date || null),
        hasProp('calibration_nabl') ? (req.body.calibration_nabl || null) : (existing.calibration_nabl || null),
        hasProp('packing') ? (req.body.packing || null) : (existing.packing || null),
        hasProp('delivery_date') ? (req.body.delivery_date || null) : (existing.delivery_date || null),
        hasProp('remarks') ? (req.body.remarks || null) : (existing.remarks || null),
        hasProp('apply_gst') ? (req.body.apply_gst ? 1 : 0) : (existing.apply_gst ?? 1),
        hasProp('extra_charge_gst_percent') ? toNumber(req.body.extra_charge_gst_percent, 0) : (existing.extra_charge_gst_percent || 0),
        hasProp('extra_charge_1') ? toNumber(req.body.extra_charge_1, 0) : (existing.extra_charge_1 || 0),
        hasProp('extra_charge_2') ? toNumber(req.body.extra_charge_2, 0) : (existing.extra_charge_2 || 0),
        hasProp('advance_display') ? (req.body.advance_display ? 1 : 0) : (existing.advance_display || 0),
        hasProp('advance_date') ? (req.body.advance_date || null) : (existing.advance_date || null),
        hasProp('advance_description') ? (req.body.advance_description || null) : (existing.advance_description || null),
        hasProp('advance_amount') ? toNumber(req.body.advance_amount, 0) : (existing.advance_amount || 0),
        req.body?.currency || existing.currency || 'INR',
        id,
      ],
    );

    const workOrder = getWorkOrderByIdWithRelations(id);

    logAudit({
      entity_type: ENTITY_TYPES.WORK_ORDER,
      entity_id: id,
      action: AUDIT_ACTIONS.UPDATE,
      old_value: existing,
      new_value: workOrder,
      req,
    });

    let action = 'update';
    if (nextStatus !== existing.status) {
      if (nextStatus === 'approved') action = 'approve';
      else if (nextStatus === 'rejected') action = 'reject';
      else if (nextStatus === 'sent_to_production') action = 'convert';
    }

    emitSalesModuleUpdate({ module: 'work_order', action, id });

    return res.status(200).json({ success: true, work_order: workOrder, totals });
  } catch (error) {
    const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
    console.error('Update work order error:', error);
    return res.status(statusCode).json({
      error: statusCode === 500 ? 'Internal server error' : 'Validation error',
      message: error.message || 'Failed to update work order',
    });
  }
}

export function deleteWorkOrder(req, res) {
  try {
    const id = toNullableInt(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'Validation error', message: 'Invalid work order id' });
    }

    const existing = getWorkOrderRecord(id);
    if (!existing) {
      return res.status(404).json({ error: 'Not found', message: 'Work order not found' });
    }

    run('UPDATE work_orders SET is_deleted = 1 WHERE id = ? AND is_deleted = 0', [id]);

    logAudit({
      entity_type: ENTITY_TYPES.WORK_ORDER,
      entity_id: id,
      action: AUDIT_ACTIONS.DELETE,
      old_value: existing,
      new_value: { is_deleted: 1 },
      req,
    });

    emitSalesModuleUpdate({ module: 'work_order', action: 'delete', id });

    return res.status(200).json({ success: true, message: 'Work order deleted' });
  } catch (error) {
    console.error('Delete work order error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to delete work order' });
  }
}

export async function approveWorkOrder(req, res) {
  try {
    const id = toNullableInt(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'Validation error', message: 'Invalid work order id' });
    }

    if (!canManageApproval(req)) {
      return res.status(403).json({ error: 'Forbidden', message: 'Access denied. Master Admin privileges required.' });
    }

    const existing = getWorkOrderRecord(id);
    if (!existing) {
      return res.status(404).json({ error: 'Not found', message: 'Work order not found' });
    }

    assertValidTransition('work_order', existing.status, 'approved');

    run(
      `UPDATE work_orders
       SET status = ?,
           approved_by = ?,
           approved_at = ?,
           rejection_reason = NULL,
           error_log = NULL
       WHERE id = ? AND is_deleted = 0`,
      ['approved', req.user?.id || null, toIsoNow(), id],
    );

    const approvedSnapshot = getWorkOrderByIdWithRelations(id);

    logAudit({
      entity_type: ENTITY_TYPES.WORK_ORDER,
      entity_id: id,
      action: AUDIT_ACTIONS.APPROVE,
      old_value: existing,
      new_value: approvedSnapshot,
      req,
    });

    try {
      await pushWorkOrderToProduction(approvedSnapshot);

      run(
        `UPDATE work_orders
         SET status = ?,
             sent_to_production_at = ?,
             error_log = NULL
         WHERE id = ? AND is_deleted = 0`,
        ['sent_to_production', toIsoNow(), id],
      );

      const finalWorkOrder = getWorkOrderByIdWithRelations(id);

      logAudit({
        entity_type: ENTITY_TYPES.WORK_ORDER,
        entity_id: id,
        action: AUDIT_ACTIONS.PRODUCTION_PUSH,
        old_value: approvedSnapshot,
        new_value: finalWorkOrder,
        req,
      });

      emitSalesModuleUpdate({ module: 'work_order', action: 'approve', id });

      return res.status(200).json({
        success: true,
        message: 'Work order approved and sent to production',
        work_order: finalWorkOrder,
      });
    } catch (pushError) {
      const errorMessage = pushError?.message || 'Failed to push work order to production';
      run('UPDATE work_orders SET error_log = ? WHERE id = ? AND is_deleted = 0', [errorMessage, id]);

      const failedWorkOrder = getWorkOrderByIdWithRelations(id);

      logAudit({
        entity_type: ENTITY_TYPES.WORK_ORDER,
        entity_id: id,
        action: AUDIT_ACTIONS.PRODUCTION_PUSH,
        old_value: approvedSnapshot,
        new_value: { id, status: 'approved', error_log: errorMessage },
        req,
      });

      emitSalesModuleUpdate({ module: 'work_order', action: 'approve', id });

      return res.status(202).json({
        success: false,
        message: 'Work order approved, but Production ERP push failed',
        requires_retry: true,
        error_log: errorMessage,
        work_order: failedWorkOrder,
      });
    }
  } catch (error) {
    const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
    console.error('Approve work order error:', error);
    return res.status(statusCode).json({
      error: statusCode === 500 ? 'Internal server error' : 'Validation error',
      message: error.message || 'Failed to approve work order',
    });
  }
}

export function rejectWorkOrder(req, res) {
  try {
    const id = toNullableInt(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'Validation error', message: 'Invalid work order id' });
    }

    if (!canManageApproval(req)) {
      return res.status(403).json({ error: 'Forbidden', message: 'Access denied. Master Admin privileges required.' });
    }

    const rejection_reason = String(req.body?.rejection_reason || '').trim();
    if (!rejection_reason) {
      return res.status(400).json({ error: 'Validation error', message: 'rejection_reason is required' });
    }

    const existing = getWorkOrderRecord(id);
    if (!existing) {
      return res.status(404).json({ error: 'Not found', message: 'Work order not found' });
    }

    assertValidTransition('work_order', existing.status, 'rejected');

    run(
      `UPDATE work_orders
       SET status = ?,
           rejection_reason = ?,
           error_log = NULL
       WHERE id = ? AND is_deleted = 0`,
      ['rejected', rejection_reason, id],
    );

    const rejectedWorkOrder = getWorkOrderByIdWithRelations(id);

    logAudit({
      entity_type: ENTITY_TYPES.WORK_ORDER,
      entity_id: id,
      action: AUDIT_ACTIONS.REJECT,
      old_value: existing,
      new_value: rejectedWorkOrder,
      req,
    });

    emitSalesModuleUpdate({ module: 'work_order', action: 'reject', id });

    return res.status(200).json({
      success: true,
      message: 'Work order rejected',
      work_order: rejectedWorkOrder,
    });
  } catch (error) {
    const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
    console.error('Reject work order error:', error);
    return res.status(statusCode).json({
      error: statusCode === 500 ? 'Internal server error' : 'Validation error',
      message: error.message || 'Failed to reject work order',
    });
  }
}

export async function retryWorkOrderProductionPush(req, res) {
  try {
    const id = toNullableInt(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'Validation error', message: 'Invalid work order id' });
    }

    if (!canManageApproval(req)) {
      return res.status(403).json({ error: 'Forbidden', message: 'Access denied. Master Admin privileges required.' });
    }

    const existing = getWorkOrderRecord(id);
    if (!existing) {
      return res.status(404).json({ error: 'Not found', message: 'Work order not found' });
    }

    if (existing.status !== 'approved') {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Only approved work orders can be retried for production push',
      });
    }

    const snapshot = getWorkOrderByIdWithRelations(id);
    try {
      await pushWorkOrderToProduction(snapshot);
    } catch (pushError) {
      const errorMessage = pushError?.message || 'Failed to retry production push';
      run('UPDATE work_orders SET error_log = ? WHERE id = ? AND is_deleted = 0', [errorMessage, id]);

      logAudit({
        entity_type: ENTITY_TYPES.WORK_ORDER,
        entity_id: id,
        action: AUDIT_ACTIONS.PRODUCTION_PUSH,
        old_value: existing,
        new_value: { id, status: 'approved', error_log: errorMessage },
        req,
      });

      return res.status(502).json({
        error: 'Validation error',
        message: errorMessage,
        requires_retry: true,
      });
    }

    run(
      `UPDATE work_orders
       SET status = ?,
           sent_to_production_at = ?,
           error_log = NULL
       WHERE id = ? AND is_deleted = 0`,
      ['sent_to_production', toIsoNow(), id],
    );

    const finalWorkOrder = getWorkOrderByIdWithRelations(id);

    logAudit({
      entity_type: ENTITY_TYPES.WORK_ORDER,
      entity_id: id,
      action: AUDIT_ACTIONS.PRODUCTION_PUSH,
      old_value: existing,
      new_value: finalWorkOrder,
      req,
    });

    emitSalesModuleUpdate({ module: 'work_order', action: 'update', id });

    return res.status(200).json({
      success: true,
      message: 'Work order sent to production successfully',
      work_order: finalWorkOrder,
    });
  } catch (error) {
    const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
    console.error('Retry work order production push error:', error);
    return res.status(statusCode).json({
      error: statusCode === 500 ? 'Internal server error' : 'Validation error',
      message: error.message || 'Failed to retry production push',
    });
  }
}

export async function sendWorkOrderToProduction(req, res) {
  try {
    const id = toNullableInt(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'Validation error', message: 'Invalid work order id' });
    }

    const existing = getWorkOrderRecord(id);
    if (!existing) {
      return res.status(404).json({ error: 'Not found', message: 'Work order not found' });
    }

    if (!canManageApproval(req)) {
      return res.status(403).json({ error: 'Forbidden', message: 'Access denied. Master Admin privileges required.' });
    }

    if (existing.status !== 'approved') {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Work order must be approved before production push',
      });
    }

    assertValidTransition('work_order', existing.status, 'sent_to_production');

    const snapshot = getWorkOrderByIdWithRelations(id);
    try {
      await pushWorkOrderToProduction(snapshot);
    } catch (pushError) {
      const errorMessage = pushError?.message || 'Failed to push work order to production';
      run('UPDATE work_orders SET error_log = ? WHERE id = ? AND is_deleted = 0', [errorMessage, id]);

      logAudit({
        entity_type: ENTITY_TYPES.WORK_ORDER,
        entity_id: id,
        action: AUDIT_ACTIONS.PRODUCTION_PUSH,
        old_value: existing,
        new_value: { id, status: 'approved', error_log: errorMessage },
        req,
      });

      return res.status(502).json({
        error: 'Validation error',
        message: errorMessage,
        requires_retry: true,
      });
    }

    run(
      `UPDATE work_orders
       SET status = ?,
           sent_to_production_at = ?,
           error_log = NULL
       WHERE id = ? AND is_deleted = 0`,
      ['sent_to_production', toIsoNow(), id],
    );

    const workOrder = getWorkOrderByIdWithRelations(id);

    logAudit({
      entity_type: ENTITY_TYPES.WORK_ORDER,
      entity_id: id,
      action: AUDIT_ACTIONS.PRODUCTION_PUSH,
      old_value: existing,
      new_value: workOrder,
      req,
    });

    emitSalesModuleUpdate({ module: 'work_order', action: 'update', id });

    return res.status(200).json({
      success: true,
      message: 'Work order sent to production',
      work_order: workOrder,
    });
  } catch (error) {
    const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
    console.error('Send work order to production error:', error);
    return res.status(statusCode).json({
      error: statusCode === 500 ? 'Internal server error' : 'Validation error',
      message: error.message || 'Failed to send work order to production',
    });
  }
}
