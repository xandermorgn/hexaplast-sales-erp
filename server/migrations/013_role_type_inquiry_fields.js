/**
 * Migration 013 — Employee Role Types + Customer Inquiry Fields
 *
 * 1. Add `role_type` column to `users` table (main / sub / regular)
 *    - main   = Main Employee (high-level sales, sees all data)
 *    - sub    = Sub Employee  (mid-level sales, sees only own data)
 *    - regular = Regular Employee (purchase team)
 *    Default: 'sub' for safety (most restrictive sales role).
 *
 * 2. Add `inquiry_date` and `alternate_email_2` to `customer_inquiries`.
 */

export function up(db) {
  // ── 1. role_type on users ────────────────────────────────────────────
  const userCols = db.prepare("PRAGMA table_info(users)").all();
  const hasRoleType = userCols.some(c => c.name === 'role_type');
  if (!hasRoleType) {
    db.exec("ALTER TABLE users ADD COLUMN role_type TEXT DEFAULT 'sub'");
    console.log('[migration-013] Added users.role_type column');
  }

  // ── 2. inquiry_date on customer_inquiries ────────────────────────────
  const inqCols = db.prepare("PRAGMA table_info(customer_inquiries)").all();

  const hasInquiryDate = inqCols.some(c => c.name === 'inquiry_date');
  if (!hasInquiryDate) {
    db.exec("ALTER TABLE customer_inquiries ADD COLUMN inquiry_date TEXT");
    console.log('[migration-013] Added customer_inquiries.inquiry_date column');
  }

  const hasAltEmail2 = inqCols.some(c => c.name === 'alternate_email_2');
  if (!hasAltEmail2) {
    db.exec("ALTER TABLE customer_inquiries ADD COLUMN alternate_email_2 TEXT");
    console.log('[migration-013] Added customer_inquiries.alternate_email_2 column');
  }

  // ── 3. Back-fill existing employees with sensible role_type ──────────
  //    Sales Employee → 'sub' (default), Purchase Employee → 'regular'
  if (!hasRoleType) {
    db.exec(`
      UPDATE users SET role_type = 'regular'
      WHERE id IN (
        SELECT user_id FROM employees WHERE designation = 'Purchase Employee'
      )
    `);
    // master_admin gets NULL role_type (not applicable)
    db.exec("UPDATE users SET role_type = NULL WHERE role = 'master_admin'");
    console.log('[migration-013] Back-filled role_type for existing employees');
  }
}
