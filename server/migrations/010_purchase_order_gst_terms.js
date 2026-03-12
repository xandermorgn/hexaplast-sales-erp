/**
 * Migration 010: Add gst_amount and terms_conditions columns to purchase_orders
 */
export function up(db) {
  // Add gst_amount column
  const cols = db.prepare("PRAGMA table_info(purchase_orders)").all();
  const colNames = cols.map(c => c.name);

  if (!colNames.includes('gst_amount')) {
    db.exec(`ALTER TABLE purchase_orders ADD COLUMN gst_amount REAL DEFAULT 0`);
  }

  if (!colNames.includes('terms_conditions')) {
    db.exec(`ALTER TABLE purchase_orders ADD COLUMN terms_conditions TEXT`);
  }
}
