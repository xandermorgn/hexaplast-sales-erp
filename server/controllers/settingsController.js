import { get, query, run } from '../config/database.js';
import { hashPassword } from '../utils/hash.js';

function getPasswordValidationError(password) {
  if (typeof password !== 'string') return 'Password must be a string.';
  if (password.length < 8) return 'Password must be at least 8 characters long.';
  if (!/[a-z]/.test(password)) return 'Password must include at least one lowercase letter.';
  if (!/[A-Z]/.test(password)) return 'Password must include at least one uppercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must include at least one digit.';
  return null;
}

export function listUsers(req, res) {
  try {
    if (req.user?.role !== 'server_admin') {
      return res.status(403).json({ error: 'Forbidden', message: 'Access denied. Server Admin privileges required.' });
    }

    const users = query(
      `SELECT id, login_id, name, role, created_at,
              'active' AS status
       FROM users
       WHERE role = 'master_admin'
       ORDER BY created_at DESC`,
      [],
    );

    return res.status(200).json({ count: users.length, users });
  } catch (error) {
    console.error('Settings listUsers error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to fetch users' });
  }
}

export async function createMasterAdmin(req, res) {
  try {
    if (req.user?.role !== 'server_admin') {
      return res.status(403).json({ error: 'Forbidden', message: 'Access denied. Server Admin privileges required.' });
    }

    const { login_id, password, name } = req.body || {};

    if (!login_id || !password || !name) {
      return res.status(400).json({ error: 'Validation error', message: 'Required: login_id, password, name' });
    }

    if (String(login_id) === 'Xander') {
      return res.status(400).json({ error: 'Validation error', message: 'Invalid login_id' });
    }

    const passwordValidationError = getPasswordValidationError(password);
    if (passwordValidationError) {
      return res.status(400).json({
        error: 'Validation error',
        message: passwordValidationError,
      });
    }

    const existing = get('SELECT id FROM users WHERE login_id = ?', [login_id]);
    if (existing) {
      return res.status(409).json({ error: 'Conflict', message: 'Login ID already exists.' });
    }

    const password_hash = await hashPassword(password);
    run(
      `INSERT INTO users (login_id, password_hash, name, role)
       VALUES (?, ?, ?, 'master_admin')`,
      [login_id, password_hash, name],
    );

    const created = get('SELECT id, login_id, name, role FROM users WHERE login_id = ?', [login_id]);

    if (created?.id) {
      run(
        `INSERT OR IGNORE INTO user_profiles (user_id, display_name, personal_phone, personal_email, photo_path)
         VALUES (?, ?, NULL, NULL, NULL)`,
        [created.id, name],
      );
    }

    return res.status(201).json({ success: true, user: created });
  } catch (error) {
    console.error('Settings createMasterAdmin error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to create master admin' });
  }
}

export function setUserRole(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'No session found' });
    }

    const { login_id, role } = req.body || {};

    if (!login_id || !role) {
      return res.status(400).json({ error: 'Validation error', message: 'Required: login_id, role' });
    }

    if (String(login_id) === 'Xander') {
      return res.status(403).json({ error: 'Forbidden', message: 'Access denied.' });
    }

    const requesterRole = req.user.role;
    const allowedRoles = requesterRole === 'server_admin'
      ? ['master_admin', 'employee']
      : requesterRole === 'master_admin'
        ? ['employee']
        : [];

    if (allowedRoles.length === 0) {
      return res.status(403).json({ error: 'Forbidden', message: 'Access denied.' });
    }

    if (!allowedRoles.includes(String(role))) {
      return res.status(400).json({
        error: 'Validation error',
        message: requesterRole === 'master_admin'
          ? 'master_admin can only assign employee role'
          : 'role must be master_admin or employee',
      });
    }

    const user = get('SELECT id, login_id, role FROM users WHERE login_id = ?', [login_id]);
    if (!user) {
      return res.status(404).json({ error: 'Not found', message: 'User not found' });
    }

    if (requesterRole === 'master_admin' && user.role === 'master_admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'master_admin cannot modify another master_admin role',
      });
    }

    run('UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE login_id = ?', [role, login_id]);

    const updated = get('SELECT id, login_id, name, role FROM users WHERE login_id = ?', [login_id]);
    return res.status(200).json({ success: true, user: updated });
  } catch (error) {
    console.error('Settings setUserRole error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to update role' });
  }
}

