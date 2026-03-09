/**
 * Migration 006: Add is_deleted columns for soft-delete support
 */
export function up(db) {
  const targets = [
    'customer_inquiries',
    'quotations',
    'performa_invoices',
    'work_orders',
    'machine_products',
    'spare_products',
  ];

  for (const tableName of targets) {
    const info = db.pragma(`table_info(${tableName})`);
    const cols = info.map(row => row.name);
    if (!cols.includes('is_deleted')) {
      db.exec(`ALTER TABLE ${tableName} ADD COLUMN is_deleted INTEGER DEFAULT 0`);
    }
  }
}
