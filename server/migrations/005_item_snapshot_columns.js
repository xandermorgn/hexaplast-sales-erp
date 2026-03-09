/**
 * Migration 005: Add snapshot columns to performa_items and work_order_items
 */
export function up(db) {
  // Performa items
  const piInfo = db.pragma('table_info(performa_items)');
  const piCols = piInfo.map(row => row.name);

  const piAdditions = [
    { col: 'category_name', sql: 'ALTER TABLE performa_items ADD COLUMN category_name TEXT' },
    { col: 'sub_category', sql: 'ALTER TABLE performa_items ADD COLUMN sub_category TEXT' },
    { col: 'product_name', sql: 'ALTER TABLE performa_items ADD COLUMN product_name TEXT' },
    { col: 'model_number', sql: 'ALTER TABLE performa_items ADD COLUMN model_number TEXT' },
    { col: 'hsn_sac_code', sql: 'ALTER TABLE performa_items ADD COLUMN hsn_sac_code TEXT' },
    { col: 'unit', sql: 'ALTER TABLE performa_items ADD COLUMN unit TEXT' },
  ];

  for (const { col, sql } of piAdditions) {
    if (!piCols.includes(col)) {
      db.exec(sql);
    }
  }

  // Work order items
  const woiInfo = db.pragma('table_info(work_order_items)');
  const woiCols = woiInfo.map(row => row.name);

  const woiAdditions = [
    { col: 'category_name', sql: 'ALTER TABLE work_order_items ADD COLUMN category_name TEXT' },
    { col: 'sub_category', sql: 'ALTER TABLE work_order_items ADD COLUMN sub_category TEXT' },
    { col: 'product_name', sql: 'ALTER TABLE work_order_items ADD COLUMN product_name TEXT' },
    { col: 'model_number', sql: 'ALTER TABLE work_order_items ADD COLUMN model_number TEXT' },
    { col: 'hsn_sac_code', sql: 'ALTER TABLE work_order_items ADD COLUMN hsn_sac_code TEXT' },
    { col: 'unit', sql: 'ALTER TABLE work_order_items ADD COLUMN unit TEXT' },
  ];

  for (const { col, sql } of woiAdditions) {
    if (!woiCols.includes(col)) {
      db.exec(sql);
    }
  }
}
