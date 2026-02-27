import { get, query, run } from '../config/database.js';
import { generateNextWorkOrderNumber } from '../utils/numberGenerator.js';
import { logAudit, AUDIT_ACTIONS, ENTITY_TYPES } from '../utils/auditLogger.js';
import { emitSalesUpdate } from '../realtime/socket.js';

function toNullableInt(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function toNumber(value, fallback = 0) {
  const parsed = Number.parseFloat(String(value));
  return Number.isNaN(parsed) ? fallback : parsed;
}

function calculateFromItems(items) {
  let subtotal = 0;
  let total_discount = 0;
  let total_gst = 0;
  let total_amount = 0;

  const normalized = items.map((raw) => {
    const quantity = Math.max(1, toNumber(raw.quantity, 1));
    const price = toNumber(raw.price, 0);
    const base = quantity * price;

    let discount_percent = toNumber(raw.discount_percent, 0);
    let discount_amount = toNumber(raw.discount_amount, 0);

    if (discount_percent > 0) {
      discount_amount = (base * discount_percent) / 100;
    } else if (discount_amount > 0 && base > 0) {
      discount_percent = (discount_amount / base) * 100;
    }

    if (discount_amount > base) {
      discount_amount = base;
      discount_percent = base > 0 ? 100 : 0;
    }

    const taxable = Math.max(0, base - discount_amount);
    const gst_percent = toNumber(raw.gst_percent, 0);
    const gst_amount = (taxable * gst_percent) / 100;
    const total = taxable + gst_amount;

    subtotal += base;
    total_discount += discount_amount;
    total_gst += gst_amount;
    total_amount += total;

    return {
      product_type: raw.product_type,
      product_id: raw.product_id,
      quantity,
      price,
      discount_percent,
      discount_amount,
      gst_percent,
      total,
    };
  });

  return {
    items: normalized,
    subtotal,
    total_discount,
    total_gst,
    total_amount,
  };
}

function getPerformaSnapshot(performaId) {
  const performa = get('SELECT * FROM performa_invoices WHERE id = ?', [performaId]);
  if (!performa) return null;

  const items = query(
    `SELECT product_type, product_id, quantity, price, discount_percent, discount_amount, gst_percent, total
     FROM performa_items WHERE performa_id = ? ORDER BY id ASC`,
    [performaId],
  );

  return { performa, items };
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
    WHERE wo.id = ?`,
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

  return {
    ...workOrder,
    items,
  };
}

function insertWorkOrder({ performa_id = null, inquiry_id, created_by, prepared_by, checked_by, approved_by, status = 'generated', items }) {
  const totals = calculateFromItems(items);
  const work_order_number = generateNextWorkOrderNumber();

  const insert = run(
    `INSERT INTO work_orders (
      work_order_number,
      performa_id,
      inquiry_id,
      created_by,
      prepared_by,
      checked_by,
      approved_by,
      subtotal,
      total_discount,
      total_gst,
      total_amount,
      status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      work_order_number,
      performa_id,
      inquiry_id,
      created_by,
      prepared_by,
      checked_by,
      approved_by,
      totals.subtotal,
      totals.total_discount,
      totals.total_gst,
      totals.total_amount,
      status,
    ],
  );

  const workOrderId = insert.lastInsertRowid;

  for (const item of totals.items) {
    run(
      `INSERT INTO work_order_items (
        work_order_id,
        product_type,
        product_id,
        quantity,
        price,
        discount_percent,
        discount_amount,
        gst_percent,
        total
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        workOrderId,
        item.product_type,
        item.product_id,
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
    totals,
  };
}

export function createWorkOrder(req, res) {
  try {
    const inquiry_id = toNullableInt(req.body?.inquiry_id);
    if (!inquiry_id) {
      return res.status(400).json({ error: 'Validation error', message: 'inquiry_id is required' });
    }

    const inquiry = get('SELECT id FROM customer_inquiries WHERE id = ?', [inquiry_id]);
    if (!inquiry) {
      return res.status(400).json({ error: 'Validation error', message: 'Invalid inquiry_id' });
    }

    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (items.length === 0) {
      return res.status(400).json({ error: 'Validation error', message: 'At least one work order item is required' });
    }

    const { workOrderId, work_order_number, totals } = insertWorkOrder({
      performa_id: toNullableInt(req.body?.performa_id),
      inquiry_id,
      created_by: req.user?.id || null,
      prepared_by: toNullableInt(req.body?.prepared_by),
      checked_by: toNullableInt(req.body?.checked_by),
      approved_by: toNullableInt(req.body?.approved_by),
      status: req.body?.status || 'generated',
      items,
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

    emitSalesUpdate({ module: 'work_orders', action: 'created', work_order_id: workOrderId, work_order_number });

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

    if (snapshot.items.length === 0) {
      return res.status(400).json({ error: 'Validation error', message: 'Performa has no items' });
    }

    const { workOrderId, work_order_number, totals } = insertWorkOrder({
      performa_id: performaId,
      inquiry_id: snapshot.performa.inquiry_id,
      created_by: req.user?.id || null,
      prepared_by: toNullableInt(req.body?.prepared_by),
      checked_by: toNullableInt(req.body?.checked_by),
      approved_by: toNullableInt(req.body?.approved_by),
      status: req.body?.status || 'generated',
      items: snapshot.items,
    });

    const workOrder = getWorkOrderByIdWithRelations(workOrderId);

    logAudit({
      entity_type: ENTITY_TYPES.WORK_ORDER,
      entity_id: workOrderId,
      action: AUDIT_ACTIONS.CREATE,
      old_value: { source_performa_id: performaId },
      new_value: workOrder,
      req,
    });

    emitSalesUpdate({ module: 'work_orders', action: 'created_from_performa', work_order_id: workOrderId, performa_id: performaId, work_order_number });

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
    const workOrders = query(
      `SELECT
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
      ORDER BY wo.created_at DESC, wo.id DESC`,
    );

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

    const existing = get('SELECT * FROM work_orders WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Not found', message: 'Work order not found' });
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

      const calculated = calculateFromItems(items);
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
            work_order_id, product_type, product_id, quantity, price,
            discount_percent, discount_amount, gst_percent, total
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            item.product_type,
            item.product_id,
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

    run(
      `UPDATE work_orders
       SET performa_id = ?,
           inquiry_id = ?,
           prepared_by = ?,
           checked_by = ?,
           approved_by = ?,
           subtotal = ?,
           total_discount = ?,
           total_gst = ?,
           total_amount = ?,
           status = ?
       WHERE id = ?`,
      [
        Object.prototype.hasOwnProperty.call(req.body || {}, 'performa_id') ? toNullableInt(req.body.performa_id) : existing.performa_id,
        Object.prototype.hasOwnProperty.call(req.body || {}, 'inquiry_id') ? toNullableInt(req.body.inquiry_id) : existing.inquiry_id,
        Object.prototype.hasOwnProperty.call(req.body || {}, 'prepared_by') ? toNullableInt(req.body.prepared_by) : existing.prepared_by,
        Object.prototype.hasOwnProperty.call(req.body || {}, 'checked_by') ? toNullableInt(req.body.checked_by) : existing.checked_by,
        Object.prototype.hasOwnProperty.call(req.body || {}, 'approved_by') ? toNullableInt(req.body.approved_by) : existing.approved_by,
        totals.subtotal,
        totals.total_discount,
        totals.total_gst,
        totals.total_amount,
        Object.prototype.hasOwnProperty.call(req.body || {}, 'status') ? (req.body.status || 'generated') : existing.status,
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

    emitSalesUpdate({ module: 'work_orders', action: 'updated', work_order_id: id, work_order_number: workOrder?.work_order_number });

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

export function sendWorkOrderToProduction(req, res) {
  try {
    const id = toNullableInt(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'Validation error', message: 'Invalid work order id' });
    }

    const workOrder = getWorkOrderByIdWithRelations(id);
    if (!workOrder) {
      return res.status(404).json({ error: 'Not found', message: 'Work order not found' });
    }

    // Placeholder endpoint for Production ERP integration.
    // Future implementation can push this payload to an external queue/API.
    const payload = {
      work_order_number: workOrder.work_order_number,
      inquiry: {
        id: workOrder.inquiry_id,
        inquiry_number: workOrder.inquiry_number,
        company_name: workOrder.company_name,
        authorized_person: workOrder.authorized_person,
      },
      amounts: {
        subtotal: workOrder.subtotal,
        total_discount: workOrder.total_discount,
        total_gst: workOrder.total_gst,
        total_amount: workOrder.total_amount,
      },
      approvals: {
        prepared_by: workOrder.prepared_by,
        checked_by: workOrder.checked_by,
        approved_by: workOrder.approved_by,
      },
      items: workOrder.items,
    };

    emitSalesUpdate({ module: 'work_orders', action: 'sent_to_production', work_order_id: id, work_order_number: workOrder.work_order_number });

    return res.status(202).json({
      success: true,
      message: 'Placeholder: Work order prepared for Production ERP handoff',
      payload,
    });
  } catch (error) {
    console.error('Send work order to production error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to send work order to production' });
  }
}
