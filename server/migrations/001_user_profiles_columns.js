/**
 * Migration 001: Add missing columns to user_profiles table
 */
export function up(db) {
  const tableInfo = db.pragma('table_info(user_profiles)');
  const columns = tableInfo.map(row => row.name);

  if (!columns.includes('personal_phone')) {
    db.exec("ALTER TABLE user_profiles ADD COLUMN personal_phone TEXT");
  }
  if (!columns.includes('personal_email')) {
    db.exec("ALTER TABLE user_profiles ADD COLUMN personal_email TEXT");
  }
  if (!columns.includes('photo_path')) {
    db.exec("ALTER TABLE user_profiles ADD COLUMN photo_path TEXT");
  }
  if (!columns.includes('photo_data')) {
    db.exec("ALTER TABLE user_profiles ADD COLUMN photo_data BLOB");
  }
  if (!columns.includes('photo_mime')) {
    db.exec("ALTER TABLE user_profiles ADD COLUMN photo_mime TEXT");
  }
}
