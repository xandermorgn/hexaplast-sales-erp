import { get, query, run } from '../config/database.js';
import { generateNextPerformaNumber } from '../utils/numberGenerator.js';
import { logAudit, AUDIT_ACTIONS, ENTITY_TYPES } from '../utils/auditLogger.js';
import { buildDateFilter, buildVisibilityFilter } from '../utils/filtering.js';
import { calculateLineItemTotals } from '../utils/calculateTotals.js';
import { assertValidStatus, assertValidTransition } from '../utils/statusFlow.js';
import { emitSalesModuleUpdate } from '../utils/salesSocketEmitter.js';
import { getDefaultDocumentSettings } from '../utils/systemSettings.js';

function toNullableInt(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function toNumber(value, fallback = 0) {
  const parsed = Number.parseFloat(String(value));
  return Number.isNaN(parsed) ? fallback : parsed;
}

function normalizeProductType(value) {
  const parsed = String(value || '').toLowerCase();
  if (parsed === 'machine' || parsed === 'spare') return parsed;
  return null;
}

function getProductDetails(productType, productId) {
  if (productType === 'machine') {
    return get('SELECT id, sales_price, gst_percent FROM machine_products WHERE id = ? AND is_deleted = 0', [productId]);
  }

  if (productType === 'spare') {
    return get('SELECT id, sales_price, gst_percent FROM spare_products WHERE id = ? AND is_deleted = 0', [productId]);
  }

  return null;
}

function getPerformaRecord(id) {
  return get('SELECT * FROM performa_invoices WHERE id = ? AND is_deleted = 0', [id]);
}

function calculateItems(items) {
  const normalized = items.map((rawItem) => {
    const product_type = normalizeProductType(rawItem?.product_type);
    const product_id = toNullableInt(rawItem?.product_id);

    if (!product_type || !product_id) {
      const error = new Error('Each item requires valid product_type and product_id');
      error.statusCode = 400;
      throw error;
    }

    const product = getProductDetails(product_type, product_id);
    if (!product) {
      const error = new Error(`Product not found for ${product_type}:${product_id}`);
      error.statusCode = 400;
      throw error;
    }

    const quantity = Math.max(1, toNumber(rawItem?.quantity, 1));
    const price = toNumber(rawItem?.price, toNumber(product.sales_price, 0));
    const gst_percent = toNumber(rawItem?.gst_percent, toNumber(product.gst_percent, 0));
    const discount_percent = Math.max(0, toNumber(rawItem?.discount_percent, 0));

    const totals = calculateLineItemTotals({ quantity, price, discount_percent, gst_percent });

    return {
      product_type,
      product_id,
      category_name: rawItem?.category_name || null,
      sub_category: rawItem?.sub_category || null,
      product_name: rawItem?.product_name || null,
      model_number: rawItem?.model_number || null,
      hsn_sac_code: rawItem?.hsn_sac_code || null,
      unit: rawItem?.unit || null,
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

function getPerformaByIdWithRelations(id) {
  const performa = get(
    `SELECT
      p.*,
      q.quotation_number,
      ci.inquiry_number,
      ci.company_name,
      ci.authorized_person,
      ci.authorized_phone,
      ci.email,
      ci.address,
      COALESCE(cup.display_name, cu.name, '-') AS created_by_name
    FROM performa_invoices p
    LEFT JOIN quotations q ON q.id = p.quotation_id
    JOIN customer_inquiries ci ON ci.id = p.inquiry_id
    LEFT JOIN users cu ON cu.id = p.created_by
    LEFT JOIN user_profiles cup ON cup.user_id = p.created_by
    WHERE p.id = ? AND p.is_deleted = 0`,
    [id],
  );

  if (!performa) return null;

  const items = query(
    `SELECT pi.*,
            CASE WHEN pi.product_type = 'machine' THEN mp.product_name ELSE sp.product_name END AS product_name,
            CASE WHEN pi.product_type = 'machine' THEN mp.product_code ELSE sp.product_code END AS product_code
     FROM performa_items pi
     LEFT JOIN machine_products mp ON pi.product_type = 'machine' AND mp.id = pi.product_id
     LEFT JOIN spare_products sp ON pi.product_type = 'spare' AND sp.id = pi.product_id
     WHERE pi.performa_id = ?
     ORDER BY pi.id ASC`,
    [id],
  );

  return { ...performa, items };
}

function insertPerforma({ inquiry_id, quotation_id = null, created_by, status, next_followup, terms_conditions, attention, declaration, special_notes, currency = 'INR', items }) {
  const calculated = calculateItems(items);
  const performa_number = generateNextPerformaNumber();

  const insert = run(
    `INSERT INTO performa_invoices (
      performa_number,
      quotation_id,
      inquiry_id,
      created_by,
      total_amount,
      total_discount,
      total_gst,
      subtotal,
      status,
      next_followup,
      terms_conditions,
      attention,
      declaration,
      special_notes,
      currency,
      is_deleted
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      performa_number,
      quotation_id,
      inquiry_id,
      created_by,
      calculated.total_amount,
      calculated.total_discount,
      calculated.total_gst,
      calculated.subtotal,
      status,
      next_followup || null,
      terms_conditions || null,
      attention || null,
      declaration || null,
      special_notes || null,
      currency,
    ],
  );

  const performaId = insert.lastInsertRowid;
  for (const item of calculated.items) {
    run(
      `INSERT INTO performa_items (
        performa_id, product_type, product_id,
        category_name, sub_category, product_name, model_number, hsn_sac_code, unit,
        quantity, price, discount_percent, discount_amount, gst_percent, total
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        performaId,
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
    performaId,
    performa_number,
    totals: {
      subtotal: calculated.subtotal,
      total_discount: calculated.total_discount,
      total_gst: calculated.total_gst,
      total_amount: calculated.total_amount,
    },
  };
}

export function createPerforma(req, res) {
  try {
    const inquiry_id = toNullableInt(req.body?.inquiry_id);
    if (!inquiry_id) {
      return res.status(400).json({ error: 'Validation error', message: 'inquiry_id is required' });
    }

    const inquiry = get('SELECT id FROM customer_inquiries WHERE id = ? AND is_deleted = 0', [inquiry_id]);
    if (!inquiry) {
      return res.status(400).json({ error: 'Validation error', message: 'Cannot create performa without valid inquiry' });
    }

    const status = req.body?.status || 'draft';
    assertValidStatus('performa', status, 'Invalid performa status');

    const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];
    if (rawItems.length === 0) {
      return res.status(400).json({ error: 'Validation error', message: 'At least one performa item is required' });
    }

    const defaults = getDefaultDocumentSettings();
    const hasTerms = Object.prototype.hasOwnProperty.call(req.body || {}, 'terms_conditions');
    const hasAttention = Object.prototype.hasOwnProperty.call(req.body || {}, 'attention');
    const hasDeclaration = Object.prototype.hasOwnProperty.call(req.body || {}, 'declaration');
    const hasSpecialNotes = Object.prototype.hasOwnProperty.call(req.body || {}, 'special_notes');

    const { performaId, performa_number, totals } = insertPerforma({
      inquiry_id,
      quotation_id: toNullableInt(req.body?.quotation_id),
      created_by: req.user?.id || null,
      status,
      next_followup: req.body?.next_followup,
      terms_conditions: hasTerms ? req.body.terms_conditions : defaults.terms_conditions,
      attention: hasAttention ? req.body.attention : defaults.attention,
      declaration: hasDeclaration ? req.body.declaration : defaults.declaration,
      special_notes: hasSpecialNotes ? req.body.special_notes : defaults.special_notes,
      currency: req.body?.currency || 'INR',
      items: rawItems,
    });

    const performa = getPerformaByIdWithRelations(performaId);

    logAudit({
      entity_type: ENTITY_TYPES.PERFORMA_INVOICE,
      entity_id: performaId,
      action: AUDIT_ACTIONS.CREATE,
      old_value: null,
      new_value: performa,
      req,
    });

    emitSalesModuleUpdate({ module: 'performa', action: status === 'converted' ? 'convert' : 'create', id: performaId });

    return res.status(201).json({ success: true, performa, totals });
  } catch (error) {
    const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
    console.error('Create performa error:', error);
    return res.status(statusCode).json({
      error: statusCode === 500 ? 'Internal server error' : 'Validation error',
      message: error.message || 'Failed to create performa',
    });
  }
}

export function createPerformaFromQuotation(req, res) {
  try {
    const quotationId = toNullableInt(req.params.quotation_id);
    if (!quotationId) {
      return res.status(400).json({ error: 'Validation error', message: 'Invalid quotation id' });
    }

    const quotation = get('SELECT * FROM quotations WHERE id = ? AND is_deleted = 0', [quotationId]);
    if (!quotation) {
      return res.status(404).json({ error: 'Not found', message: 'Quotation not found' });
    }

    if (quotation.status === 'converted') {
      return res.status(400).json({ error: 'Validation error', message: 'Quotation already converted' });
    }

    const quotationItems = query(
      `SELECT product_type, product_id, quantity, price, discount_percent, gst_percent
       FROM quotation_items WHERE quotation_id = ? ORDER BY id ASC`,
      [quotationId],
    );

    if (quotationItems.length === 0) {
      return res.status(400).json({ error: 'Validation error', message: 'Quotation has no items' });
    }

    const defaults = getDefaultDocumentSettings();

    const status = req.body?.status || 'draft';
    assertValidStatus('performa', status, 'Invalid performa status');

    const { performaId, performa_number, totals } = insertPerforma({
      inquiry_id: quotation.inquiry_id,
      quotation_id: quotationId,
      created_by: req.user?.id || null,
      status,
      next_followup: Object.prototype.hasOwnProperty.call(req.body || {}, 'next_followup') ? req.body.next_followup : quotation.next_followup,
      terms_conditions: Object.prototype.hasOwnProperty.call(req.body || {}, 'terms_conditions')
        ? req.body.terms_conditions
        : (quotation.terms_conditions || defaults.terms_conditions),
      attention: Object.prototype.hasOwnProperty.call(req.body || {}, 'attention')
        ? req.body.attention
        : (quotation.attention || defaults.attention),
      declaration: Object.prototype.hasOwnProperty.call(req.body || {}, 'declaration')
        ? req.body.declaration
        : (quotation.declaration || defaults.declaration),
      special_notes: Object.prototype.hasOwnProperty.call(req.body || {}, 'special_notes')
        ? req.body.special_notes
        : (quotation.special_notes || defaults.special_notes),
      currency: req.body?.currency || quotation.currency || 'INR',
      items: quotationItems,
    });

    run('UPDATE quotations SET status = ? WHERE id = ? AND is_deleted = 0', ['converted', quotationId]);

    const performa = getPerformaByIdWithRelations(performaId);

    logAudit({
      entity_type: ENTITY_TYPES.PERFORMA_INVOICE,
      entity_id: performaId,
      action: AUDIT_ACTIONS.CREATE,
      old_value: { source_quotation_id: quotationId },
      new_value: performa,
      req,
    });

    emitSalesModuleUpdate({ module: 'quotation', action: 'convert', id: quotationId });
    emitSalesModuleUpdate({ module: 'performa', action: 'create', id: performaId });

    return res.status(201).json({ success: true, performa, totals });
  } catch (error) {
    const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
    console.error('Create performa from quotation error:', error);
    return res.status(statusCode).json({
      error: statusCode === 500 ? 'Internal server error' : 'Validation error',
      message: error.message || 'Failed to create performa from quotation',
    });
  }
}

export function getPerformas(req, res) {
  try {
    let sql = `SELECT
      p.*,
      q.quotation_number,
      ci.inquiry_number,
      ci.company_name,
      ci.authorized_person,
      COALESCE(cup.display_name, cu.name, '-') AS created_by_name
    FROM performa_invoices p
    LEFT JOIN quotations q ON q.id = p.quotation_id
    JOIN customer_inquiries ci ON ci.id = p.inquiry_id
    LEFT JOIN users cu ON cu.id = p.created_by
    LEFT JOIN user_profiles cup ON cup.user_id = p.created_by
    WHERE p.is_deleted = 0`;

    const filter = buildDateFilter(req.query || {}, 'p.created_at', 'p.created_by');
    const params = [...filter.params];
    sql += filter.clause;

    // Data visibility: sub employees see only their own data
    const vis = buildVisibilityFilter(req, 'p.created_by');
    sql += vis.clause;
    params.push(...vis.params);

    sql += ' ORDER BY p.created_at DESC, p.id DESC';

    const performas = query(sql, params);
    return res.status(200).json({ count: performas.length, performas });
  } catch (error) {
    console.error('Get performas error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to fetch performas' });
  }
}

export function getPerformaById(req, res) {
  try {
    const id = toNullableInt(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'Validation error', message: 'Invalid performa id' });
    }

    const performa = getPerformaByIdWithRelations(id);
    if (!performa) {
      return res.status(404).json({ error: 'Not found', message: 'Performa not found' });
    }

    return res.status(200).json({ performa });
  } catch (error) {
    console.error('Get performa by id error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to fetch performa' });
  }
}

export function updatePerforma(req, res) {
  try {
    const id = toNullableInt(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'Validation error', message: 'Invalid performa id' });
    }

    const existing = getPerformaRecord(id);
    if (!existing) {
      return res.status(404).json({ error: 'Not found', message: 'Performa not found' });
    }

    if (existing.status === 'converted') {
      return res.status(400).json({ error: 'Validation error', message: 'Converted performa cannot be edited' });
    }

    const inquiry_id = toNullableInt(req.body?.inquiry_id) || existing.inquiry_id;
    const inquiry = get('SELECT id FROM customer_inquiries WHERE id = ? AND is_deleted = 0', [inquiry_id]);
    if (!inquiry) {
      return res.status(400).json({ error: 'Validation error', message: 'Cannot update performa without valid inquiry' });
    }

    const nextStatus = Object.prototype.hasOwnProperty.call(req.body || {}, 'status')
      ? (req.body.status || existing.status)
      : existing.status;
    assertValidStatus('performa', nextStatus, 'Invalid performa status');
    assertValidTransition('performa', existing.status, nextStatus);

    const rawItems = Array.isArray(req.body?.items) ? req.body.items : null;
    let totals = {
      subtotal: existing.subtotal,
      total_discount: existing.total_discount,
      total_gst: existing.total_gst || 0,
      total_amount: existing.total_amount,
    };

    if (rawItems) {
      if (rawItems.length === 0) {
        return res.status(400).json({ error: 'Validation error', message: 'At least one performa item is required' });
      }

      const calculated = calculateItems(rawItems);
      totals = {
        subtotal: calculated.subtotal,
        total_discount: calculated.total_discount,
        total_gst: calculated.total_gst,
        total_amount: calculated.total_amount,
      };

      run('DELETE FROM performa_items WHERE performa_id = ?', [id]);
      for (const item of calculated.items) {
        run(
          `INSERT INTO performa_items (
            performa_id, product_type, product_id,
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

    const updatedCurrency = req.body?.currency || existing.currency || 'INR';

    run(
      `UPDATE performa_invoices
       SET inquiry_id = ?,
           quotation_id = ?,
           subtotal = ?,
           total_discount = ?,
           total_gst = ?,
           total_amount = ?,
           status = ?,
           next_followup = ?,
           terms_conditions = ?,
           attention = ?,
           declaration = ?,
           special_notes = ?,
           currency = ?
       WHERE id = ? AND is_deleted = 0`,
      [
        inquiry_id,
        Object.prototype.hasOwnProperty.call(req.body || {}, 'quotation_id') ? toNullableInt(req.body.quotation_id) : existing.quotation_id,
        totals.subtotal,
        totals.total_discount,
        totals.total_gst,
        totals.total_amount,
        nextStatus,
        Object.prototype.hasOwnProperty.call(req.body || {}, 'next_followup') ? (req.body.next_followup || null) : existing.next_followup,
        Object.prototype.hasOwnProperty.call(req.body || {}, 'terms_conditions') ? (req.body.terms_conditions || null) : existing.terms_conditions,
        Object.prototype.hasOwnProperty.call(req.body || {}, 'attention') ? (req.body.attention || null) : existing.attention,
        Object.prototype.hasOwnProperty.call(req.body || {}, 'declaration') ? (req.body.declaration || null) : existing.declaration,
        Object.prototype.hasOwnProperty.call(req.body || {}, 'special_notes') ? (req.body.special_notes || null) : existing.special_notes,
        updatedCurrency,
        id,
      ],
    );

    const performa = getPerformaByIdWithRelations(id);

    logAudit({
      entity_type: ENTITY_TYPES.PERFORMA_INVOICE,
      entity_id: id,
      action: AUDIT_ACTIONS.UPDATE,
      old_value: existing,
      new_value: performa,
      req,
    });

    emitSalesModuleUpdate({
      module: 'performa',
      action: nextStatus === 'converted' && existing.status !== 'converted' ? 'convert' : 'update',
      id,
    });

    return res.status(200).json({ success: true, performa, totals });
  } catch (error) {
    const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
    console.error('Update performa error:', error);
    return res.status(statusCode).json({
      error: statusCode === 500 ? 'Internal server error' : 'Validation error',
      message: error.message || 'Failed to update performa',
    });
  }
}

export function deletePerforma(req, res) {
  try {
    const id = toNullableInt(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'Validation error', message: 'Invalid performa id' });
    }

    const existing = getPerformaRecord(id);
    if (!existing) {
      return res.status(404).json({ error: 'Not found', message: 'Performa not found' });
    }

    run('UPDATE performa_invoices SET is_deleted = 1 WHERE id = ? AND is_deleted = 0', [id]);

    logAudit({
      entity_type: ENTITY_TYPES.PERFORMA_INVOICE,
      entity_id: id,
      action: AUDIT_ACTIONS.DELETE,
      old_value: existing,
      new_value: { is_deleted: 1 },
      req,
    });

    emitSalesModuleUpdate({ module: 'performa', action: 'delete', id });

    return res.status(200).json({ success: true, message: 'Performa deleted' });
  } catch (error) {
    console.error('Delete performa error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to delete performa' });
  }
}
