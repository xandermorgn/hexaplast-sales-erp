import { get, query, run } from '../config/database.js';

export const SYSTEM_SETTING_KEYS = {
  DEFAULT_TERMS_CONDITIONS: 'default_terms_conditions',
  DEFAULT_PROFORMA_TERMS: 'default_proforma_terms',
  DEFAULT_ATTENTION: 'default_attention',
  DEFAULT_DECLARATION: 'default_declaration',
  DEFAULT_SPECIAL_NOTES: 'default_special_notes',
  COMPANY_NAME: 'company_name',
  COMPANY_ADDRESS: 'company_address',
  COMPANY_PHONE: 'company_phone',
  COMPANY_EMAIL: 'company_email',
};

const DEFAULT_TERMS_CONTENT = `Price Based On : Ex-Works, Factory
Payment : 50% Advance 50% Before Delivery
Delivery : 6 TO 8 Weeks
Validity : 30 days
Packing : Extra
Forwarding : To-Pay Basis
GST : Extra`;

const DEFAULT_ATTENTION_CONTENT = `Dear Sir,

We refer your inquiry regarding your requirement of lab testing equipment.

We thank you for giving us the opportunity to quote you.

As desired, we are attaching our techno commercial offer for your consideration.

If further information is required please feel free to contact us.

Assuring you of our best service at all times.`;

const DEFAULT_DECLARATION_CONTENT = `Thanks & regards,

Brijesh Patel
+91 96626 88726
www.hexaplastindia.com`;

const DEFAULT_PROFORMA_TERMS_CONTENT = `25% Advance will be done today, 25% within next week, balance on delivery.
Freight will be charged extra as actual if not included in billing.
Goods are always dispatched / while & after installation at buyer's risk.
Subject to Ahmedabad jurisdiction.
Delivery time within 1 month after receipt of advance payment.
Packing extra.`;

export const DEFAULT_SYSTEM_SETTINGS = {
  [SYSTEM_SETTING_KEYS.DEFAULT_TERMS_CONDITIONS]: DEFAULT_TERMS_CONTENT,
  [SYSTEM_SETTING_KEYS.DEFAULT_PROFORMA_TERMS]: DEFAULT_PROFORMA_TERMS_CONTENT,
  [SYSTEM_SETTING_KEYS.DEFAULT_ATTENTION]: DEFAULT_ATTENTION_CONTENT,
  [SYSTEM_SETTING_KEYS.DEFAULT_DECLARATION]: DEFAULT_DECLARATION_CONTENT,
  [SYSTEM_SETTING_KEYS.DEFAULT_SPECIAL_NOTES]: '',
  [SYSTEM_SETTING_KEYS.COMPANY_NAME]: 'Hexaplast',
  [SYSTEM_SETTING_KEYS.COMPANY_ADDRESS]: '',
  [SYSTEM_SETTING_KEYS.COMPANY_PHONE]: '',
  [SYSTEM_SETTING_KEYS.COMPANY_EMAIL]: '',
};

export function ensureDefaultSystemSettings() {
  for (const [key, value] of Object.entries(DEFAULT_SYSTEM_SETTINGS)) {
    const existing = get('SELECT key, value FROM system_settings WHERE key = ?', [key]);
    if (!existing) {
      run('INSERT INTO system_settings (key, value) VALUES (?, ?)', [key, value]);
    } else if ((!existing.value || existing.value.trim() === '') && value) {
      // Populate empty values with defaults
      run('UPDATE system_settings SET value = ? WHERE key = ?', [value, key]);
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
    SYSTEM_SETTING_KEYS.DEFAULT_PROFORMA_TERMS,
    SYSTEM_SETTING_KEYS.DEFAULT_ATTENTION,
    SYSTEM_SETTING_KEYS.DEFAULT_DECLARATION,
    SYSTEM_SETTING_KEYS.DEFAULT_SPECIAL_NOTES,
  ];

  const values = getSystemSettingsByKeys(keys);

  return {
    terms_conditions: values[SYSTEM_SETTING_KEYS.DEFAULT_TERMS_CONDITIONS] || '',
    proforma_terms: values[SYSTEM_SETTING_KEYS.DEFAULT_PROFORMA_TERMS] || '',
    attention: values[SYSTEM_SETTING_KEYS.DEFAULT_ATTENTION] || '',
    declaration: values[SYSTEM_SETTING_KEYS.DEFAULT_DECLARATION] || '',
    special_notes: values[SYSTEM_SETTING_KEYS.DEFAULT_SPECIAL_NOTES] || '',
  };
}

export function getCompanySettings() {
  const keys = [
    SYSTEM_SETTING_KEYS.COMPANY_NAME,
    SYSTEM_SETTING_KEYS.COMPANY_ADDRESS,
    SYSTEM_SETTING_KEYS.COMPANY_PHONE,
    SYSTEM_SETTING_KEYS.COMPANY_EMAIL,
  ];

  const values = getSystemSettingsByKeys(keys);

  return {
    company_name: values[SYSTEM_SETTING_KEYS.COMPANY_NAME] || 'Hexaplast',
    company_address: values[SYSTEM_SETTING_KEYS.COMPANY_ADDRESS] || '',
    company_phone: values[SYSTEM_SETTING_KEYS.COMPANY_PHONE] || '',
    company_email: values[SYSTEM_SETTING_KEYS.COMPANY_EMAIL] || '',
  };
}
