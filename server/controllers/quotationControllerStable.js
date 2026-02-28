import { get, query, run } from '../config/database.js';
import { generateNextQuotationNumber } from '../utils/numberGenerator.js';
import { logAudit, AUDIT_ACTIONS, ENTITY_TYPES } from '../utils/auditLogger.js';
import { buildDateFilter } from '../utils/filtering.js';
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

function getQuotationRecord(id) {
  return get('SELECT * FROM quotations WHERE id = ? AND is_deleted = 0', [id]);
}

function calculateQuotation(items) {
  const normalizedItems = items.map((rawItem) => {
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
    items: normalizedItems,
    subtotal: normalizedItems.reduce((sum, item) => sum + item.base_amount, 0),
    total_discount: normalizedItems.reduce((sum, item) => sum + item.discount_amount, 0),
    total_gst: normalizedItems.reduce((sum, item) => sum + item.gst_amount, 0),
    total_amount: normalizedItems.reduce((sum, item) => sum + item.total, 0),
  };
}

function getQuotationByIdWithRelations(id) {
  const quotation = get(
    `SELECT
      q.*,
      ci.inquiry_number,
      ci.company_name,
      ci.authorized_person,
      ci.authorized_phone,
      ci.email,
      ci.address,
      COALESCE(cup.display_name, cu.name, '-') AS created_by_name
    FROM quotations q
    JOIN customer_inquiries ci ON ci.id = q.inquiry_id
    LEFT JOIN users cu ON cu.id = q.created_by
    LEFT JOIN user_profiles cup ON cup.user_id = q.created_by
    WHERE q.id = ? AND q.is_deleted = 0`,
    [id],
  );

  if (!quotation) return null;

  const items = query(
    `SELECT
      qi.*,
      CASE WHEN qi.product_type = 'machine' THEN mp.product_name ELSE sp.product_name END AS product_name,
      CASE WHEN qi.product_type = 'machine' THEN mp.product_code ELSE sp.product_code END AS product_code
    FROM quotation_items qi
    LEFT JOIN machine_products mp ON qi.product_type = 'machine' AND mp.id = qi.product_id
    LEFT JOIN spare_products sp ON qi.product_type = 'spare' AND sp.id = qi.product_id
    WHERE qi.quotation_id = ?
    ORDER BY qi.id ASC`,
    [id],
  );

  return { ...quotation, items };
}

export function createQuotation(req, res) {
  try {
    const inquiry_id = toNullableInt(req.body?.inquiry_id);
    if (!inquiry_id) {
      return res.status(400).json({ error: 'Validation error', message: 'inquiry_id is required' });
    }

    const inquiry = get('SELECT id FROM customer_inquiries WHERE id = ? AND is_deleted = 0', [inquiry_id]);
    if (!inquiry) {
      return res.status(400).json({ error: 'Validation error', message: 'Cannot create quotation without valid inquiry' });
    }

    const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];
    if (rawItems.length === 0) {
      return res.status(400).json({ error: 'Validation error', message: 'At least one quotation item is required' });
    }

    const status = req.body?.status || 'draft';
    assertValidStatus('quotation', status, 'Invalid quotation status');

    const calculated = calculateQuotation(rawItems);
    const quotation_number = generateNextQuotationNumber();
    const defaults = getDefaultDocumentSettings();
    const hasTerms = Object.prototype.hasOwnProperty.call(req.body || {}, 'terms_conditions');
    const hasAttention = Object.prototype.hasOwnProperty.call(req.body || {}, 'attention');
    const hasDeclaration = Object.prototype.hasOwnProperty.call(req.body || {}, 'declaration');
    const hasSpecialNotes = Object.prototype.hasOwnProperty.call(req.body || {}, 'special_notes');

    const insert = run(
      `INSERT INTO quotations (
        quotation_number,
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
        is_deleted
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        quotation_number,
        inquiry_id,
        req.user?.id || null,
        calculated.total_amount,
        calculated.total_discount,
        calculated.total_gst,
        calculated.subtotal,
        status,
        req.body?.next_followup || null,
        hasTerms ? req.body.terms_conditions : (defaults.terms_conditions || null),
        hasAttention ? req.body.attention : (defaults.attention || null),
        hasDeclaration ? req.body.declaration : (defaults.declaration || null),
        hasSpecialNotes ? req.body.special_notes : (defaults.special_notes || null),
      ],
    );

    const quotationId = insert.lastInsertRowid;

    for (const item of calculated.items) {
      run(
        `INSERT INTO quotation_items (
          quotation_id,
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
          quotationId,
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

    const quotation = getQuotationByIdWithRelations(quotationId);

    logAudit({
      entity_type: ENTITY_TYPES.QUOTATION,
      entity_id: quotationId,
      action: AUDIT_ACTIONS.CREATE,
      old_value: null,
      new_value: quotation,
      req,
    });

    emitSalesModuleUpdate({ module: 'quotation', action: status === 'converted' ? 'convert' : 'create', id: quotationId });

    return res.status(201).json({ success: true, quotation, totals: calculated });
  } catch (error) {
    const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
    console.error('Create quotation error:', error);
    return res.status(statusCode).json({
      error: statusCode === 500 ? 'Internal server error' : 'Validation error',
      message: error.message || 'Failed to create quotation',
    });
  }
}

export function getQuotations(req, res) {
  try {
    let sql = `SELECT
      q.*,
      ci.inquiry_number,
      ci.company_name,
      ci.authorized_person,
      ci.email,
      COALESCE(cup.display_name, cu.name, '-') AS created_by_name
    FROM quotations q
    JOIN customer_inquiries ci ON ci.id = q.inquiry_id
    LEFT JOIN users cu ON cu.id = q.created_by
    LEFT JOIN user_profiles cup ON cup.user_id = q.created_by
    WHERE q.is_deleted = 0`;

    const filter = buildDateFilter(req.query || {}, 'q.created_at', 'q.created_by');
    const params = [...filter.params];
    sql += filter.clause;
    sql += ' ORDER BY q.created_at DESC, q.id DESC';

    const quotations = query(sql, params);
    return res.status(200).json({ count: quotations.length, quotations });
  } catch (error) {
    console.error('Get quotations error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to fetch quotations' });
  }
}

export function getQuotationById(req, res) {
  try {
    const id = toNullableInt(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'Validation error', message: 'Invalid quotation id' });
    }

    const quotation = getQuotationByIdWithRelations(id);
    if (!quotation) {
      return res.status(404).json({ error: 'Not found', message: 'Quotation not found' });
    }

    return res.status(200).json({ quotation });
  } catch (error) {
    console.error('Get quotation by id error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to fetch quotation' });
  }
}

export function updateQuotation(req, res) {
  try {
    const id = toNullableInt(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'Validation error', message: 'Invalid quotation id' });
    }

    const existing = getQuotationRecord(id);
    if (!existing) {
      return res.status(404).json({ error: 'Not found', message: 'Quotation not found' });
    }

    if (existing.status === 'converted') {
      return res.status(400).json({ error: 'Validation error', message: 'Converted quotation cannot be edited' });
    }

    const inquiry_id = toNullableInt(req.body?.inquiry_id) || existing.inquiry_id;
    const inquiry = get('SELECT id FROM customer_inquiries WHERE id = ? AND is_deleted = 0', [inquiry_id]);
    if (!inquiry) {
      return res.status(400).json({ error: 'Validation error', message: 'Cannot update quotation without valid inquiry' });
    }

    const nextStatus = Object.prototype.hasOwnProperty.call(req.body || {}, 'status')
      ? (req.body.status || existing.status)
      : existing.status;
    assertValidStatus('quotation', nextStatus, 'Invalid quotation status');
    assertValidTransition('quotation', existing.status, nextStatus);

    const rawItems = Array.isArray(req.body?.items) ? req.body.items : null;
    let totals = {
      subtotal: existing.subtotal,
      total_discount: existing.total_discount,
      total_gst: existing.total_gst || 0,
      total_amount: existing.total_amount,
    };

    if (rawItems) {
      if (rawItems.length === 0) {
        return res.status(400).json({ error: 'Validation error', message: 'At least one quotation item is required' });
      }

      const calculated = calculateQuotation(rawItems);
      totals = {
        subtotal: calculated.subtotal,
        total_discount: calculated.total_discount,
        total_gst: calculated.total_gst,
        total_amount: calculated.total_amount,
      };

      run('DELETE FROM quotation_items WHERE quotation_id = ?', [id]);
      for (const item of calculated.items) {
        run(
          `INSERT INTO quotation_items (
            quotation_id,
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
      `UPDATE quotations
       SET inquiry_id = ?,
           subtotal = ?,
           total_discount = ?,
           total_gst = ?,
           total_amount = ?,
           status = ?,
           next_followup = ?,
           terms_conditions = ?,
           attention = ?,
           declaration = ?,
           special_notes = ?
       WHERE id = ? AND is_deleted = 0`,
      [
        inquiry_id,
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
        id,
      ],
    );

    const quotation = getQuotationByIdWithRelations(id);

    logAudit({
      entity_type: ENTITY_TYPES.QUOTATION,
      entity_id: id,
      action: AUDIT_ACTIONS.UPDATE,
      old_value: existing,
      new_value: quotation,
      req,
    });

    emitSalesModuleUpdate({
      module: 'quotation',
      action: nextStatus === 'converted' && existing.status !== 'converted' ? 'convert' : 'update',
      id,
    });

    return res.status(200).json({ success: true, quotation, totals });
  } catch (error) {
    const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
    console.error('Update quotation error:', error);
    return res.status(statusCode).json({
      error: statusCode === 500 ? 'Internal server error' : 'Validation error',
      message: error.message || 'Failed to update quotation',
    });
  }
}

export function deleteQuotation(req, res) {
  try {
    const id = toNullableInt(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'Validation error', message: 'Invalid quotation id' });
    }

    const existing = getQuotationRecord(id);
    if (!existing) {
      return res.status(404).json({ error: 'Not found', message: 'Quotation not found' });
    }

    run('UPDATE quotations SET is_deleted = 1 WHERE id = ? AND is_deleted = 0', [id]);

    logAudit({
      entity_type: ENTITY_TYPES.QUOTATION,
      entity_id: id,
      action: AUDIT_ACTIONS.DELETE,
      old_value: existing,
      new_value: { is_deleted: 1 },
      req,
    });

    emitSalesModuleUpdate({ module: 'quotation', action: 'delete', id });

    return res.status(200).json({ success: true, message: 'Quotation deleted' });
  } catch (error) {
    console.error('Delete quotation error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to delete quotation' });
  }
}
