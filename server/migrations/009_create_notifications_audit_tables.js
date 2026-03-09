/**
 * Migration 009: Create notifications and audit_logs tables
 */
export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      performed_by INTEGER NOT NULL,
      performed_role TEXT NOT NULL,
      performed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (performed_by) REFERENCES users(id)
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_performed_by ON audit_logs(performed_by)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_performed_at ON audit_logs(performed_at)`);
}
