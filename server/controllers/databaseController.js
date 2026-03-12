import fs from 'fs';
import path from 'path';
import { getDb, get, initDatabase } from '../config/database.js';
import { verifyPassword, hashPassword } from '../utils/hash.js';

const dbPath = path.join(process.cwd(), 'server', 'data', 'sales.db');

/**
 * POST /api/database/delete
 * Delete the current database after password verification.
 * Body: { password, new_master_admin: { name, login_id, password } }
 * Only server_admin can access this.
 */
export async function deleteDatabase(req, res) {
  try {
    const { password, new_master_admin } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Validation error', message: 'Server admin password is required' });
    }

    if (!new_master_admin || !new_master_admin.name || !new_master_admin.login_id || !new_master_admin.password) {
      return res.status(400).json({ error: 'Validation error', message: 'New master admin details (name, login_id, password) are required' });
    }

    // Verify the server admin password
    const serverAdmin = get('SELECT * FROM users WHERE login_id = ? AND role = ?', [req.session.loginId, 'server_admin']);
    if (!serverAdmin) {
      return res.status(403).json({ error: 'Forbidden', message: 'Server admin not found' });
    }

    // Check password stored in server_admin_credentials or users table
    // Server admin uses a special bootstrap — check the server_admin_credentials table
    const cred = get('SELECT password_hash FROM server_admin_credentials WHERE id = 1');
    if (!cred) {
      return res.status(500).json({ error: 'Internal error', message: 'Server admin credentials not found' });
    }

    const valid = await verifyPassword(password, cred.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Incorrect server admin password' });
    }

    // Validate new master admin password strength
    if (new_master_admin.password.length < 6) {
      return res.status(400).json({ error: 'Validation error', message: 'New master admin password must be at least 6 characters' });
    }

    // Close the current database connection
    const db = getDb();
    db.close();

    // Delete the database file
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }

    // Re-initialize the database (creates fresh tables + runs migrations)
    await initDatabase();

    // Create the new master admin
    const newDb = getDb();
    const passwordHash = await hashPassword(new_master_admin.password);
    newDb.prepare(
      `INSERT INTO users (login_id, password_hash, name, role) VALUES (?, ?, ?, 'master_admin')`
    ).run(new_master_admin.login_id.trim(), passwordHash, new_master_admin.name.trim());

    return res.status(200).json({
      success: true,
      message: 'Database deleted and re-initialized. New master admin created. Please log in again.',
    });
  } catch (error) {
    console.error('Delete database error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to delete database: ' + error.message });
  }
}

/**
 * GET /api/database/backup
 * Download the current database file as a binary attachment.
 * Only server_admin can access this.
 */
export function backupDatabase(req, res) {
  try {
    if (!fs.existsSync(dbPath)) {
      return res.status(404).json({ error: 'Not found', message: 'Database file not found' });
    }

    // Use WAL checkpoint to ensure all data is flushed to the main DB file
    try {
      const db = getDb();
      db.pragma('wal_checkpoint(TRUNCATE)');
    } catch (e) {
      // Non-fatal — continue with backup
      console.warn('WAL checkpoint warning:', e.message);
    }

    const fileBuffer = fs.readFileSync(dbPath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `hexaplast-erp-backup-${timestamp}.db`;

    // Convert to base64 for JSON transport through the Next.js adapter
    const base64Data = fileBuffer.toString('base64');
    return res.status(200).json({
      success: true,
      filename,
      data: base64Data,
    });
  } catch (error) {
    console.error('Backup database error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to backup database' });
  }
}

/**
 * POST /api/database/import
 * Import a previously backed-up database file.
 * Body: { db_base64, password }
 * Only server_admin can access this.
 */
export async function importDatabase(req, res) {
  try {
    const { db_base64, password } = req.body;

    if (!db_base64) {
      return res.status(400).json({ error: 'Validation error', message: 'Database file is required' });
    }

    if (!password) {
      return res.status(400).json({ error: 'Validation error', message: 'Server admin password is required' });
    }

    // Verify the server admin password
    const cred = get('SELECT password_hash FROM server_admin_credentials WHERE id = 1');
    if (!cred) {
      return res.status(500).json({ error: 'Internal error', message: 'Server admin credentials not found' });
    }

    const valid = await verifyPassword(password, cred.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Incorrect server admin password' });
    }

    // Parse the base64 data
    const base64Data = db_base64.replace(/^data:[^;]+;base64,/, '');
    const dbBuffer = Buffer.from(base64Data, 'base64');

    // Basic validation — SQLite files start with "SQLite format 3\0"
    const header = dbBuffer.slice(0, 16).toString('ascii');
    if (!header.startsWith('SQLite format 3')) {
      return res.status(400).json({ error: 'Validation error', message: 'Invalid database file. The file does not appear to be a valid SQLite database.' });
    }

    // Close the current database connection
    const db = getDb();
    db.close();

    // Write the imported database
    fs.writeFileSync(dbPath, dbBuffer);

    // Re-initialize to connect to the imported database and run any pending migrations
    await initDatabase();

    return res.status(200).json({
      success: true,
      message: 'Database imported successfully. Please log in again.',
    });
  } catch (error) {
    console.error('Import database error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to import database: ' + error.message });
  }
}
