/**
 * Migration 011: Create terms_conditions_templates table for centralized T&C management
 */
export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS terms_conditions_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_type TEXT NOT NULL CHECK(document_type IN ('quotation', 'proforma_invoice', 'purchase_order')),
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
}
