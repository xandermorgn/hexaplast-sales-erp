/**
 * Migration 007: Create follow_ups table
 */
export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS follow_ups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL CHECK(entity_type IN ('enquiry','quotation','performa','workorder')),
      entity_id INTEGER NOT NULL,
      employee_id INTEGER NOT NULL,
      note TEXT,
      reminder_datetime TEXT NOT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','completed','missed')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_followup_entity ON follow_ups(entity_type, entity_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_followup_employee ON follow_ups(employee_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_followup_status ON follow_ups(status, reminder_datetime)`);
}
