/**
 * Migration 014 — Add show_image column to quotation_items
 *
 * This enables the per-item image toggle in quotation PDFs.
 * machine_products already has specifications + image_path columns.
 */

export function up(db) {
  // Add show_image to quotation_items (default true)
  const cols = db.prepare("PRAGMA table_info(quotation_items)").all();
  const colNames = cols.map(c => c.name);

  if (!colNames.includes('show_image')) {
    db.exec(`ALTER TABLE quotation_items ADD COLUMN show_image INTEGER DEFAULT 1`);
    console.log('[migration-014] Added show_image to quotation_items');
  }

  // Also add show_image to performa_items and work_order_items for consistency
  const piCols = db.prepare("PRAGMA table_info(performa_items)").all().map(c => c.name);
  if (!piCols.includes('show_image')) {
    db.exec(`ALTER TABLE performa_items ADD COLUMN show_image INTEGER DEFAULT 1`);
    console.log('[migration-014] Added show_image to performa_items');
  }

  const woCols = db.prepare("PRAGMA table_info(work_order_items)").all().map(c => c.name);
  if (!woCols.includes('show_image')) {
    db.exec(`ALTER TABLE work_order_items ADD COLUMN show_image INTEGER DEFAULT 1`);
    console.log('[migration-014] Added show_image to work_order_items');
  }

  console.log('[migration-014] Done.');
}
