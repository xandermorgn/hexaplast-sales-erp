/**
 * Terms & Conditions Controller
 * CRUD for centralized terms_conditions_templates table
 */

import { get, query, run } from '../config/database.js';

/**
 * GET /api/terms-conditions
 * List all terms templates. Optionally filter by document_type and is_active.
 * Query: ?document_type=quotation&active=1
 */
export function listTerms(req, res) {
  try {
    const { document_type, active } = req.query || {};
    let sql = 'SELECT * FROM terms_conditions_templates WHERE 1=1';
    const params = [];

    if (document_type) {
      sql += ' AND document_type = ?';
      params.push(document_type);
    }
    if (active !== undefined) {
      sql += ' AND is_active = ?';
      params.push(Number(active));
    }

    sql += ' ORDER BY document_type, title';
    const rows = query(sql, params);
    return res.status(200).json({ terms: rows });
  } catch (error) {
    console.error('List terms error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to fetch terms' });
  }
}

/**
 * GET /api/terms-conditions/:id
 * Get a single terms template
 */
export function getTermById(req, res) {
  try {
    const { id } = req.params;
    const row = get('SELECT * FROM terms_conditions_templates WHERE id = ?', [id]);
    if (!row) return res.status(404).json({ error: 'Not found', message: 'Terms template not found' });
    return res.status(200).json({ term: row });
  } catch (error) {
    console.error('Get term error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to fetch term' });
  }
}

/**
 * POST /api/terms-conditions
 * Create a new terms template
 * Body: { document_type, title, content, is_active? }
 */
export function createTerm(req, res) {
  try {
    const { document_type, title, content, is_active } = req.body;

    if (!document_type || !title) {
      return res.status(400).json({ error: 'Validation error', message: 'document_type and title are required' });
    }

    const validTypes = ['quotation', 'proforma_invoice', 'purchase_order'];
    if (!validTypes.includes(document_type)) {
      return res.status(400).json({ error: 'Validation error', message: `document_type must be one of: ${validTypes.join(', ')}` });
    }

    const result = run(
      `INSERT INTO terms_conditions_templates (document_type, title, content, is_active)
       VALUES (?, ?, ?, ?)`,
      [document_type, title.trim(), content || '', is_active !== undefined ? Number(is_active) : 1]
    );

    const created = get('SELECT * FROM terms_conditions_templates WHERE id = ?', [result.lastInsertRowid]);
    return res.status(201).json({ success: true, term: created });
  } catch (error) {
    console.error('Create term error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to create term' });
  }
}

/**
 * PUT /api/terms-conditions/:id
 * Update an existing terms template
 * Body: { document_type?, title?, content?, is_active? }
 */
export function updateTerm(req, res) {
  try {
    const { id } = req.params;
    const existing = get('SELECT * FROM terms_conditions_templates WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Not found', message: 'Terms template not found' });

    const { document_type, title, content, is_active } = req.body;

    const validTypes = ['quotation', 'proforma_invoice', 'purchase_order'];
    if (document_type && !validTypes.includes(document_type)) {
      return res.status(400).json({ error: 'Validation error', message: `document_type must be one of: ${validTypes.join(', ')}` });
    }

    run(
      `UPDATE terms_conditions_templates SET
        document_type = COALESCE(?, document_type),
        title = COALESCE(?, title),
        content = COALESCE(?, content),
        is_active = COALESCE(?, is_active),
        updated_at = datetime('now')
       WHERE id = ?`,
      [
        document_type || null,
        title ? title.trim() : null,
        content !== undefined ? content : null,
        is_active !== undefined ? Number(is_active) : null,
        id,
      ]
    );

    const updated = get('SELECT * FROM terms_conditions_templates WHERE id = ?', [id]);
    return res.status(200).json({ success: true, term: updated });
  } catch (error) {
    console.error('Update term error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to update term' });
  }
}

/**
 * DELETE /api/terms-conditions/:id
 * Delete a terms template
 */
export function deleteTerm(req, res) {
  try {
    const { id } = req.params;
    const existing = get('SELECT * FROM terms_conditions_templates WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Not found', message: 'Terms template not found' });

    run('DELETE FROM terms_conditions_templates WHERE id = ?', [id]);
    return res.status(200).json({ success: true, message: 'Terms template deleted' });
  } catch (error) {
    console.error('Delete term error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to delete term' });
  }
}
