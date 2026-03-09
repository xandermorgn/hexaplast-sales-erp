/**
 * Migration 003: Add missing columns to quotations and performa_invoices
 */
export function up(db) {
  const quotationInfo = db.pragma('table_info(quotations)');
  const quotationCols = quotationInfo.map(row => row.name);

  if (!quotationCols.includes('total_gst')) {
    db.exec('ALTER TABLE quotations ADD COLUMN total_gst REAL DEFAULT 0');
  }

  const performaInfo = db.pragma('table_info(performa_invoices)');
  const performaCols = performaInfo.map(row => row.name);

  if (!performaCols.includes('quotation_id')) {
    db.exec('ALTER TABLE performa_invoices ADD COLUMN quotation_id INTEGER');
  }
  if (!performaCols.includes('total_gst')) {
    db.exec('ALTER TABLE performa_invoices ADD COLUMN total_gst REAL DEFAULT 0');
  }
}
