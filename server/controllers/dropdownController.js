/**
 * Dropdown Values Controller
 * CRUD for dynamic dropdown values (enquiry_source, category, industry, region)
 */
import { get, query, run } from '../config/database.js';

export function listDropdownValues(req, res) {
  try {
    const { field_name } = req.query || {};

    if (field_name) {
      const values = query(
        'SELECT * FROM dropdown_values WHERE field_name = ? ORDER BY value ASC',
        [field_name]
      );
      return res.status(200).json({ values });
    }

    // Return all grouped by field_name
    const all = query('SELECT * FROM dropdown_values ORDER BY field_name ASC, value ASC');
    const grouped = {};
    for (const row of all) {
      if (!grouped[row.field_name]) grouped[row.field_name] = [];
      grouped[row.field_name].push(row);
    }
    return res.status(200).json({ values: all, grouped });
  } catch (error) {
    console.error('List dropdown values error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to fetch dropdown values' });
  }
}

export function createDropdownValue(req, res) {
  try {
    const field_name = String(req.body?.field_name || '').trim();
    const value = String(req.body?.value || '').trim();

    if (!field_name || !value) {
      return res.status(400).json({ error: 'Validation error', message: 'field_name and value are required' });
    }

    const allowed = ['enquiry_source', 'category', 'industry', 'region'];
    if (!allowed.includes(field_name)) {
      return res.status(400).json({ error: 'Validation error', message: `field_name must be one of: ${allowed.join(', ')}` });
    }

    run('INSERT OR IGNORE INTO dropdown_values (field_name, value) VALUES (?, ?)', [field_name, value]);

    const created = get(
      'SELECT * FROM dropdown_values WHERE field_name = ? AND value = ?',
      [field_name, value]
    );

    return res.status(201).json({ success: true, dropdown_value: created });
  } catch (error) {
    if (String(error?.message || '').includes('UNIQUE')) {
      return res.status(409).json({ error: 'Conflict', message: 'Value already exists' });
    }
    console.error('Create dropdown value error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to create dropdown value' });
  }
}

export function deleteDropdownValue(req, res) {
  try {
    const { id } = req.params;
    const existing = get('SELECT * FROM dropdown_values WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Not found', message: 'Dropdown value not found' });
    }

    run('DELETE FROM dropdown_values WHERE id = ?', [id]);
    return res.status(200).json({ success: true, message: 'Value deleted' });
  } catch (error) {
    console.error('Delete dropdown value error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to delete dropdown value' });
  }
}
