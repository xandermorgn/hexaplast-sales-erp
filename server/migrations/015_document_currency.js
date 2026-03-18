/**
 * Migration 015 — Add currency column to quotations, performa_invoices, work_orders, purchase_orders
 *
 * Currency is stored at the document level (not per-item).
 * Defaults to 'INR'. The amount values stay unchanged; only the display currency label changes.
 */

export function up(db) {
  const tables = ['quotations', 'performa_invoices', 'work_orders', 'purchase_orders'];

  for (const table of tables) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
    if (!cols.includes('currency')) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN currency TEXT DEFAULT 'INR'`);
      console.log(`[migration-015] Added currency to ${table}`);
    }
  }

  console.log('[migration-015] Done.');
}
