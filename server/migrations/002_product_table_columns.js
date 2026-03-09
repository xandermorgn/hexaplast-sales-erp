/**
 * Migration 002: Add missing columns to machine_products and spare_products
 */
export function up(db) {
  const machineInfo = db.pragma('table_info(machine_products)');
  const machineCols = machineInfo.map(row => row.name);

  if (!machineCols.includes('quantity')) {
    db.exec('ALTER TABLE machine_products ADD COLUMN quantity REAL DEFAULT 0');
  }
  if (!machineCols.includes('created_by')) {
    db.exec('ALTER TABLE machine_products ADD COLUMN created_by INTEGER');
  }

  const spareInfo = db.pragma('table_info(spare_products)');
  const spareCols = spareInfo.map(row => row.name);

  if (!spareCols.includes('quantity')) {
    db.exec('ALTER TABLE spare_products ADD COLUMN quantity REAL DEFAULT 0');
  }
  if (!spareCols.includes('created_by')) {
    db.exec('ALTER TABLE spare_products ADD COLUMN created_by INTEGER');
  }
}
