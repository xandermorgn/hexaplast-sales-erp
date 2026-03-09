import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { runMigrations } from '../migrations/runMigrations.js';

// Use project root (process.cwd()) not __dirname — Next.js bundles server
// code into .next/ so __dirname would resolve to .next/server/config/
// instead of the real project directory.
const dbPath = path.join(process.cwd(), 'server', 'data', 'sales.db');

let db;

/**
 * Initialize the database connection and create base tables.
 *
 * RULES:
 *  1. NEVER delete or recreate the database file.
 *  2. Only CREATE TABLE IF NOT EXISTS is allowed here (idempotent).
 *  3. All schema modifications (ALTER TABLE, new tables added after v1)
 *     MUST go through the migration system in server/migrations/.
 */
async function initDatabase() {
  // ── STEP 4: Database file protection ──────────────────────────────────
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // If database exists, connect to it directly — never delete it.
  if (fs.existsSync(dbPath)) {
    console.log('[database] Existing database found — connecting (no recreation).');
  } else {
    console.log('[database] No database found — creating new database file.');
  }

  db = new Database(dbPath);

  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // ── Base tables (v0 schema — immutable definitions) ───────────────────
  // These represent the original schema before any migrations.
  // They use CREATE TABLE IF NOT EXISTS so they are safe on existing DBs.

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      login_id TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('master_admin', 'employee')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_login_id ON users(login_id)`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      employee_id TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      contact_number TEXT,
      email TEXT,
      designation TEXT,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_employee_user_id ON employees(user_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_employee_id ON employees(employee_id)`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS customer_inquiries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inquiry_number TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by INTEGER,
      company_name TEXT,
      authorized_person TEXT,
      authorized_phone TEXT,
      email TEXT,
      alternate_email TEXT,
      designation TEXT,
      gst_number TEXT,
      address TEXT,
      assigned_to INTEGER,
      enquiry_source TEXT,
      category TEXT,
      industry TEXT,
      region TEXT,
      country TEXT,
      state TEXT,
      city TEXT,
      remarks TEXT,
      followup TEXT,
      status TEXT DEFAULT 'open',
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_customer_inquiries_number ON customer_inquiries(inquiry_number)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_customer_inquiries_created_by ON customer_inquiries(created_by)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_customer_inquiries_assigned_to ON customer_inquiries(assigned_to)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_customer_inquiries_created_at ON customer_inquiries(created_at)`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS product_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_name TEXT UNIQUE NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS machine_products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER,
      product_name TEXT,
      model_number TEXT,
      product_code TEXT,
      sales_price REAL,
      purchase_price REAL,
      hsn_code TEXT,
      sac_code TEXT,
      gst_percent REAL,
      currency TEXT DEFAULT 'INR',
      description TEXT,
      specifications TEXT,
      image_path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES product_categories(id) ON DELETE SET NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS spare_products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER,
      product_name TEXT,
      model_number TEXT,
      product_code TEXT,
      sales_price REAL,
      purchase_price REAL,
      hsn_code TEXT,
      sac_code TEXT,
      gst_percent REAL,
      currency TEXT DEFAULT 'INR',
      description TEXT,
      specifications TEXT,
      image_path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES product_categories(id) ON DELETE SET NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS quotations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quotation_number TEXT UNIQUE NOT NULL,
      inquiry_id INTEGER,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      total_amount REAL DEFAULT 0,
      total_discount REAL DEFAULT 0,
      subtotal REAL DEFAULT 0,
      status TEXT DEFAULT 'draft',
      next_followup DATETIME,
      terms_conditions TEXT,
      attention TEXT,
      declaration TEXT,
      special_notes TEXT,
      FOREIGN KEY (inquiry_id) REFERENCES customer_inquiries(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS quotation_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quotation_id INTEGER NOT NULL,
      product_type TEXT NOT NULL CHECK(product_type IN ('machine', 'spare')),
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      price REAL NOT NULL DEFAULT 0,
      discount_percent REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      gst_percent REAL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS performa_invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      performa_number TEXT UNIQUE NOT NULL,
      inquiry_id INTEGER,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      total_amount REAL DEFAULT 0,
      total_discount REAL DEFAULT 0,
      subtotal REAL DEFAULT 0,
      status TEXT DEFAULT 'draft',
      next_followup DATETIME,
      terms_conditions TEXT,
      attention TEXT,
      declaration TEXT,
      special_notes TEXT,
      FOREIGN KEY (inquiry_id) REFERENCES customer_inquiries(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS performa_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      performa_id INTEGER NOT NULL,
      product_type TEXT NOT NULL CHECK(product_type IN ('machine', 'spare')),
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      price REAL NOT NULL DEFAULT 0,
      discount_percent REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      gst_percent REAL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      FOREIGN KEY (performa_id) REFERENCES performa_invoices(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS work_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      work_order_number TEXT UNIQUE NOT NULL,
      performa_id INTEGER,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      prepared_by INTEGER,
      checked_by INTEGER,
      approved_by INTEGER,
      total_amount REAL DEFAULT 0,
      status TEXT DEFAULT 'generated',
      FOREIGN KEY (performa_id) REFERENCES performa_invoices(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (prepared_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (checked_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS work_order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      work_order_id INTEGER NOT NULL,
      product_type TEXT NOT NULL CHECK(product_type IN ('machine', 'spare')),
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      price REAL NOT NULL DEFAULT 0,
      discount_percent REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      gst_percent REAL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  db.exec(`
    INSERT OR IGNORE INTO system_settings (key, value) VALUES
      ('default_terms_conditions', ''),
      ('default_attention', ''),
      ('default_declaration', ''),
      ('default_special_notes', '')
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_profile_user_id ON user_profiles(user_id)`);

  // ── Run migration system ──────────────────────────────────────────────
  // All ALTER TABLE and new table additions go through numbered migration files.
  // The migration runner reads schema_version, runs only pending migrations,
  // and creates a backup before any changes.
  await runMigrations(db, dbPath);

  console.log('[database] Database initialized successfully');
  console.log('[database] Database path:', dbPath);
}

function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

function query(sql, params = []) {
  const db = getDb();
  try {
    const stmt = db.prepare(sql);
    const result = stmt.all(...params);
    return result;
  } catch (error) {
    console.error('Query error:', error.message);
    console.error('SQL:', sql);
    console.error('Params:', params);
    throw error;
  }
}

function run(sql, params = []) {
  const db = getDb();
  try {
    const stmt = db.prepare(sql);
    const result = stmt.run(...params);
    return result;
  } catch (error) {
    console.error('Run error:', error.message);
    console.error('SQL:', sql);
    console.error('Params:', params);
    throw error;
  }
}

function get(sql, params = []) {
  const results = query(sql, params);
  return results.length > 0 ? results[0] : null;
}

export { initDatabase, getDb, query, run, get };
export default { initDatabase, getDb, query, run, get };
