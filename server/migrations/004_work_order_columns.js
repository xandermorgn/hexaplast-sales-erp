/**
 * Migration 004: Add missing columns to work_orders
 */
export function up(db) {
  const info = db.pragma('table_info(work_orders)');
  const cols = info.map(row => row.name);

  const additions = [
    { col: 'inquiry_id', sql: 'ALTER TABLE work_orders ADD COLUMN inquiry_id INTEGER' },
    { col: 'subtotal', sql: 'ALTER TABLE work_orders ADD COLUMN subtotal REAL DEFAULT 0' },
    { col: 'total_discount', sql: 'ALTER TABLE work_orders ADD COLUMN total_discount REAL DEFAULT 0' },
    { col: 'total_gst', sql: 'ALTER TABLE work_orders ADD COLUMN total_gst REAL DEFAULT 0' },
    { col: 'approved_at', sql: 'ALTER TABLE work_orders ADD COLUMN approved_at DATETIME' },
    { col: 'sent_to_production_at', sql: 'ALTER TABLE work_orders ADD COLUMN sent_to_production_at DATETIME' },
    { col: 'rejection_reason', sql: 'ALTER TABLE work_orders ADD COLUMN rejection_reason TEXT' },
    { col: 'error_log', sql: 'ALTER TABLE work_orders ADD COLUMN error_log TEXT' },
    { col: 'quotation_id', sql: 'ALTER TABLE work_orders ADD COLUMN quotation_id INTEGER' },
    { col: 'work_order_date', sql: 'ALTER TABLE work_orders ADD COLUMN work_order_date DATETIME' },
    { col: 'calibration_nabl', sql: 'ALTER TABLE work_orders ADD COLUMN calibration_nabl TEXT' },
    { col: 'packing', sql: 'ALTER TABLE work_orders ADD COLUMN packing TEXT' },
    { col: 'delivery_date', sql: 'ALTER TABLE work_orders ADD COLUMN delivery_date DATETIME' },
    { col: 'remarks', sql: 'ALTER TABLE work_orders ADD COLUMN remarks TEXT' },
    { col: 'apply_gst', sql: 'ALTER TABLE work_orders ADD COLUMN apply_gst INTEGER DEFAULT 1' },
    { col: 'extra_charge_gst_percent', sql: 'ALTER TABLE work_orders ADD COLUMN extra_charge_gst_percent REAL DEFAULT 0' },
    { col: 'extra_charge_1', sql: 'ALTER TABLE work_orders ADD COLUMN extra_charge_1 INTEGER DEFAULT 0' },
    { col: 'extra_charge_2', sql: 'ALTER TABLE work_orders ADD COLUMN extra_charge_2 INTEGER DEFAULT 0' },
    { col: 'advance_display', sql: 'ALTER TABLE work_orders ADD COLUMN advance_display INTEGER DEFAULT 0' },
    { col: 'advance_date', sql: 'ALTER TABLE work_orders ADD COLUMN advance_date DATETIME' },
    { col: 'advance_description', sql: 'ALTER TABLE work_orders ADD COLUMN advance_description TEXT' },
    { col: 'advance_amount', sql: 'ALTER TABLE work_orders ADD COLUMN advance_amount REAL DEFAULT 0' },
  ];

  for (const { col, sql } of additions) {
    if (!cols.includes(col)) {
      db.exec(sql);
    }
  }
}
