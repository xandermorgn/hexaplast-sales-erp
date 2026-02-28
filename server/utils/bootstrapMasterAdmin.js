import { get, run } from '../config/database.js';
import { hashPassword } from './hash.js';

const DEFAULT_MASTER_ADMIN = {
  name: 'Master Admin',
  loginId: 'master',
  password: 'Master@123',
};

export async function ensureBootstrapMasterAdmin(options = {}) {
  const { logCreated = true } = options;

  const countRow = get("SELECT COUNT(*) AS count FROM users WHERE role = 'master_admin'");
  const masterAdminCount = Number(countRow?.count || 0);

  if (masterAdminCount > 0) {
    return false;
  }

  const existingLogin = get('SELECT id FROM users WHERE login_id = ?', [DEFAULT_MASTER_ADMIN.loginId]);
  if (existingLogin) {
    throw new Error(`Bootstrap failed: login_id "${DEFAULT_MASTER_ADMIN.loginId}" already exists.`);
  }

  const passwordHash = await hashPassword(DEFAULT_MASTER_ADMIN.password);

  const insertResult = run(
    `INSERT INTO users (login_id, password_hash, name, role)
     VALUES (?, ?, ?, 'master_admin')`,
    [DEFAULT_MASTER_ADMIN.loginId, passwordHash, DEFAULT_MASTER_ADMIN.name],
  );

  const userId = Number(insertResult?.lastInsertRowid || 0);
  if (userId > 0) {
    run(
      `INSERT OR IGNORE INTO user_profiles (user_id, display_name, personal_phone, personal_email, photo_path)
       VALUES (?, ?, NULL, NULL, NULL)`,
      [userId, DEFAULT_MASTER_ADMIN.name],
    );
  }

  if (logCreated) {
    console.log('Bootstrap Master Admin created.');
  }

  return true;
}

export default { ensureBootstrapMasterAdmin };
