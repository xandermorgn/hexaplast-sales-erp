import { get, query, run } from '../config/database.js';

export const SYSTEM_SETTING_KEYS = {
  DEFAULT_TERMS_CONDITIONS: 'default_terms_conditions',
  DEFAULT_ATTENTION: 'default_attention',
  DEFAULT_DECLARATION: 'default_declaration',
  DEFAULT_SPECIAL_NOTES: 'default_special_notes',
};

export const DEFAULT_SYSTEM_SETTINGS = {
  [SYSTEM_SETTING_KEYS.DEFAULT_TERMS_CONDITIONS]: '',
  [SYSTEM_SETTING_KEYS.DEFAULT_ATTENTION]: '',
  [SYSTEM_SETTING_KEYS.DEFAULT_DECLARATION]: '',
  [SYSTEM_SETTING_KEYS.DEFAULT_SPECIAL_NOTES]: '',
};

export function ensureDefaultSystemSettings() {
  for (const [key, value] of Object.entries(DEFAULT_SYSTEM_SETTINGS)) {
    const existing = get('SELECT key FROM system_settings WHERE key = ?', [key]);
    if (!existing) {
      run('INSERT INTO system_settings (key, value) VALUES (?, ?)', [key, value]);
    }
  }
}

export function getSystemSettingsByKeys(keys = []) {
  if (!Array.isArray(keys) || keys.length === 0) return {};

  const placeholders = keys.map(() => '?').join(', ');
  const rows = query(`SELECT key, value FROM system_settings WHERE key IN (${placeholders})`, keys);

  const map = {};
  for (const key of keys) {
    map[key] = DEFAULT_SYSTEM_SETTINGS[key] || '';
  }

  for (const row of rows) {
    map[row.key] = row.value ?? '';
  }

  return map;
}

export function getDefaultDocumentSettings() {
  const keys = [
    SYSTEM_SETTING_KEYS.DEFAULT_TERMS_CONDITIONS,
    SYSTEM_SETTING_KEYS.DEFAULT_ATTENTION,
    SYSTEM_SETTING_KEYS.DEFAULT_DECLARATION,
    SYSTEM_SETTING_KEYS.DEFAULT_SPECIAL_NOTES,
  ];

  const values = getSystemSettingsByKeys(keys);

  return {
    terms_conditions: values[SYSTEM_SETTING_KEYS.DEFAULT_TERMS_CONDITIONS] || '',
    attention: values[SYSTEM_SETTING_KEYS.DEFAULT_ATTENTION] || '',
    declaration: values[SYSTEM_SETTING_KEYS.DEFAULT_DECLARATION] || '',
    special_notes: values[SYSTEM_SETTING_KEYS.DEFAULT_SPECIAL_NOTES] || '',
  };
}
