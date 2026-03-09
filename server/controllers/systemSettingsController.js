import { logAudit, AUDIT_ACTIONS, ENTITY_TYPES } from '../utils/auditLogger.js';
import {
  ensureDefaultSystemSettings,
  getDefaultDocumentSettings,
  getCompanySettings,
  getSystemSettingsByKeys,
  SYSTEM_SETTING_KEYS,
} from '../utils/systemSettings.js';
import { run } from '../config/database.js';

const DOCUMENT_SETTING_KEYS = [
  SYSTEM_SETTING_KEYS.DEFAULT_TERMS_CONDITIONS,
  SYSTEM_SETTING_KEYS.DEFAULT_ATTENTION,
  SYSTEM_SETTING_KEYS.DEFAULT_DECLARATION,
  SYSTEM_SETTING_KEYS.DEFAULT_SPECIAL_NOTES,
];

function normalizeText(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

export function getPrintSettings(req, res) {
  try {
    ensureDefaultSystemSettings();
    const company = getCompanySettings();
    return res.status(200).json({ success: true, company });
  } catch (error) {
    console.error('Get print settings error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch print settings',
    });
  }
}

export function getDocumentDefaultSettings(req, res) {
  try {
    ensureDefaultSystemSettings();
    const defaults = getDefaultDocumentSettings();
    return res.status(200).json({ success: true, defaults });
  } catch (error) {
    console.error('Get document default settings error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch document default settings',
    });
  }
}

export function updateDocumentDefaultSettings(req, res) {
  try {
    ensureDefaultSystemSettings();

    const oldValues = getSystemSettingsByKeys(DOCUMENT_SETTING_KEYS);

    const nextValues = {
      [SYSTEM_SETTING_KEYS.DEFAULT_TERMS_CONDITIONS]: normalizeText(req.body?.terms_conditions),
      [SYSTEM_SETTING_KEYS.DEFAULT_ATTENTION]: normalizeText(req.body?.attention),
      [SYSTEM_SETTING_KEYS.DEFAULT_DECLARATION]: normalizeText(req.body?.declaration),
      [SYSTEM_SETTING_KEYS.DEFAULT_SPECIAL_NOTES]: normalizeText(req.body?.special_notes),
    };

    for (const key of DOCUMENT_SETTING_KEYS) {
      run(
        `INSERT INTO system_settings (key, value)
         VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [key, nextValues[key]],
      );
    }

    const defaults = getDefaultDocumentSettings();

    logAudit({
      entity_type: ENTITY_TYPES.SYSTEM_SETTING,
      entity_id: 1,
      action: AUDIT_ACTIONS.UPDATE,
      old_value: oldValues,
      new_value: nextValues,
      req,
    });

    return res.status(200).json({
      success: true,
      message: 'Document default settings updated',
      defaults,
    });
  } catch (error) {
    console.error('Update document default settings error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update document default settings',
    });
  }
}
