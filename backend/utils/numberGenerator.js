import { get } from '../config/database.js';

const SAFE_IDENTIFIER_REGEX = /^[A-Za-z_][A-Za-z0-9_]*$/;

function assertSafeIdentifier(value, label) {
  if (!SAFE_IDENTIFIER_REGEX.test(value)) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
}

/**
 * Generate the next formatted number for a table column.
 * Example output: HP/INQ/0001
 */
export function generateNextNumber(prefix, tableName, columnName) {
  if (!prefix || typeof prefix !== 'string') {
    throw new Error('prefix is required and must be a string');
  }

  assertSafeIdentifier(tableName, 'tableName');
  assertSafeIdentifier(columnName, 'columnName');

  const likePattern = `${prefix}%`;
  const suffixStartIndex = prefix.length + 1;

  const sql = `
    SELECT ${columnName} AS current_number
    FROM ${tableName}
    WHERE ${columnName} LIKE ?
    ORDER BY CAST(SUBSTR(${columnName}, ?) AS INTEGER) DESC
    LIMIT 1
  `;

  const row = get(sql, [likePattern, suffixStartIndex]);

  if (!row?.current_number) {
    return `${prefix}0001`;
  }

  const currentNumber = String(row.current_number);
  const numericPart = currentNumber.startsWith(prefix)
    ? currentNumber.slice(prefix.length)
    : '';

  const parsed = Number.parseInt(numericPart, 10);
  const next = Number.isNaN(parsed) ? 1 : parsed + 1;

  return `${prefix}${String(next).padStart(4, '0')}`;
}

export function generateNextInquiryNumber() {
  return generateNextNumber('HP/INQ/', 'customer_inquiries', 'inquiry_number');
}

export function generateNextQuotationNumber() {
  return generateNextNumber('HP/QT/', 'quotations', 'quotation_number');
}

export function generateNextPerformaNumber() {
  return generateNextNumber('HP/PF/', 'performa_invoices', 'performa_number');
}

export function generateNextWorkOrderNumber() {
  return generateNextNumber('HP/WO/', 'work_orders', 'work_order_number');
}
