import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'data', 'sales.db');

let db;

function initDatabase() {
  // Ensure data directory exists
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Open database file (creates if doesn't exist)
  db = new Database(dbPath);
  
  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Create tables
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

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_login_id ON users(login_id)
  `);

  // Create employees table
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

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_employee_user_id ON employees(user_id)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_employee_id ON employees(employee_id)
  `);

  // Create customer inquiries table
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
      is_deleted INTEGER DEFAULT 0,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_customer_inquiries_number ON customer_inquiries(inquiry_number)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_customer_inquiries_created_by ON customer_inquiries(created_by)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_customer_inquiries_assigned_to ON customer_inquiries(assigned_to)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_customer_inquiries_created_at ON customer_inquiries(created_at)
  `);

  // Product categories
  db.exec(`
    CREATE TABLE IF NOT EXISTS product_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_name TEXT UNIQUE NOT NULL
    )
  `);

  // Machine products
  db.exec(`
    CREATE TABLE IF NOT EXISTS machine_products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER,
      created_by INTEGER,
      product_name TEXT,
      model_number TEXT,
      product_code TEXT,
      sales_price REAL,
      purchase_price REAL,
      hsn_code TEXT,
      sac_code TEXT,
      gst_percent REAL,
      quantity REAL DEFAULT 0,
      currency TEXT DEFAULT 'INR',
      description TEXT,
      specifications TEXT,
      image_path TEXT,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES product_categories(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // Spare products
  db.exec(`
    CREATE TABLE IF NOT EXISTS spare_products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER,
      created_by INTEGER,
      product_name TEXT,
      model_number TEXT,
      product_code TEXT,
      sales_price REAL,
      purchase_price REAL,
      hsn_code TEXT,
      sac_code TEXT,
      gst_percent REAL,
      quantity REAL DEFAULT 0,
      currency TEXT DEFAULT 'INR',
      description TEXT,
      specifications TEXT,
      image_path TEXT,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES product_categories(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // Quotations
  db.exec(`
    CREATE TABLE IF NOT EXISTS quotations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quotation_number TEXT UNIQUE NOT NULL,
      inquiry_id INTEGER,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      total_amount REAL DEFAULT 0,
      total_discount REAL DEFAULT 0,
      total_gst REAL DEFAULT 0,
      subtotal REAL DEFAULT 0,
      status TEXT DEFAULT 'draft',
      next_followup DATETIME,
      terms_conditions TEXT,
      attention TEXT,
      declaration TEXT,
      special_notes TEXT,
      is_deleted INTEGER DEFAULT 0,
      FOREIGN KEY (inquiry_id) REFERENCES customer_inquiries(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // Quotation items
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

  // Performa invoices (same structure as quotations)
  db.exec(`
    CREATE TABLE IF NOT EXISTS performa_invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      performa_number TEXT UNIQUE NOT NULL,
      quotation_id INTEGER,
      inquiry_id INTEGER,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      total_amount REAL DEFAULT 0,
      total_discount REAL DEFAULT 0,
      total_gst REAL DEFAULT 0,
      subtotal REAL DEFAULT 0,
      status TEXT DEFAULT 'draft',
      next_followup DATETIME,
      terms_conditions TEXT,
      attention TEXT,
      declaration TEXT,
      special_notes TEXT,
      is_deleted INTEGER DEFAULT 0,
      FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE SET NULL,
      FOREIGN KEY (inquiry_id) REFERENCES customer_inquiries(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // Performa invoice items
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

  // Work orders
  db.exec(`
    CREATE TABLE IF NOT EXISTS work_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      work_order_number TEXT UNIQUE NOT NULL,
      performa_id INTEGER,
      inquiry_id INTEGER,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      prepared_by INTEGER,
      checked_by INTEGER,
      approved_by INTEGER,
      approved_at DATETIME,
      sent_to_production_at DATETIME,
      rejection_reason TEXT,
      error_log TEXT,
      subtotal REAL DEFAULT 0,
      total_discount REAL DEFAULT 0,
      total_gst REAL DEFAULT 0,
      total_amount REAL DEFAULT 0,
      status TEXT DEFAULT 'generated',
      is_deleted INTEGER DEFAULT 0,
      FOREIGN KEY (performa_id) REFERENCES performa_invoices(id) ON DELETE SET NULL,
      FOREIGN KEY (inquiry_id) REFERENCES customer_inquiries(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (prepared_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (checked_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // Work order items
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

  // System settings (global editable defaults)
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



  // Create user_profiles table (UI-only data, separate from employees system data)
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      personal_phone TEXT,
      personal_email TEXT,
      photo_path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_profile_user_id ON user_profiles(user_id)
  `);

  // Migration: Add missing columns to user_profiles if they don't exist
  // SQLite doesn't have IF NOT EXISTS for ALTER TABLE, so we check first
  try {
    const tableInfo = db.pragma('table_info(user_profiles)');
    const columns = tableInfo.map(row => row.name);
    
    if (!columns.includes('personal_phone')) {
      db.exec("ALTER TABLE user_profiles ADD COLUMN personal_phone TEXT");
      console.log('Migration: Added personal_phone column to user_profiles');
    }
    if (!columns.includes('personal_email')) {
      db.exec("ALTER TABLE user_profiles ADD COLUMN personal_email TEXT");
      console.log('Migration: Added personal_email column to user_profiles');
    }
    if (!columns.includes('photo_path')) {
      db.exec("ALTER TABLE user_profiles ADD COLUMN photo_path TEXT");
      console.log('Migration: Added photo_path column to user_profiles');
    }
  } catch (migrationError) {
    console.log('Migration check completed:', migrationError.message);
  }

  // Migration: Add missing quantity columns to product tables if they don't exist
  try {
    const machineTableInfo = db.pragma('table_info(machine_products)');
    const machineColumns = machineTableInfo.map(row => row.name);

    if (!machineColumns.includes('quantity')) {
      db.exec('ALTER TABLE machine_products ADD COLUMN quantity REAL DEFAULT 0');
      console.log('Migration: Added quantity column to machine_products');
    }

    if (!machineColumns.includes('created_by')) {
      db.exec('ALTER TABLE machine_products ADD COLUMN created_by INTEGER');
      console.log('Migration: Added created_by column to machine_products');
    }

    const spareTableInfo = db.pragma('table_info(spare_products)');
    const spareColumns = spareTableInfo.map(row => row.name);

    if (!spareColumns.includes('quantity')) {
      db.exec('ALTER TABLE spare_products ADD COLUMN quantity REAL DEFAULT 0');
      console.log('Migration: Added quantity column to spare_products');
    }

    if (!spareColumns.includes('created_by')) {
      db.exec('ALTER TABLE spare_products ADD COLUMN created_by INTEGER');
      console.log('Migration: Added created_by column to spare_products');
    }
  } catch (migrationError) {
    console.log('Product migration check completed:', migrationError.message);
  }

  // Migration: Add missing total_gst column to quotations if it doesn't exist
  try {
    const quotationTableInfo = db.pragma('table_info(quotations)');
    const quotationColumns = quotationTableInfo.map(row => row.name);

    if (!quotationColumns.includes('total_gst')) {
      db.exec('ALTER TABLE quotations ADD COLUMN total_gst REAL DEFAULT 0');
      console.log('Migration: Added total_gst column to quotations');
    }
  } catch (migrationError) {
    console.log('Quotation migration check completed:', migrationError.message);
  }

  // Migration: Add missing columns to performa_invoices if they don't exist
  try {
    const performaTableInfo = db.pragma('table_info(performa_invoices)');
    const performaColumns = performaTableInfo.map(row => row.name);

    if (!performaColumns.includes('quotation_id')) {
      db.exec('ALTER TABLE performa_invoices ADD COLUMN quotation_id INTEGER');
      console.log('Migration: Added quotation_id column to performa_invoices');
    }

    if (!performaColumns.includes('total_gst')) {
      db.exec('ALTER TABLE performa_invoices ADD COLUMN total_gst REAL DEFAULT 0');
      console.log('Migration: Added total_gst column to performa_invoices');
    }
  } catch (migrationError) {
    console.log('Performa migration check completed:', migrationError.message);
  }

  // Migration: Add missing columns to work_orders if they don't exist
  try {
    const workOrderTableInfo = db.pragma('table_info(work_orders)');
    const workOrderColumns = workOrderTableInfo.map(row => row.name);

    if (!workOrderColumns.includes('inquiry_id')) {
      db.exec('ALTER TABLE work_orders ADD COLUMN inquiry_id INTEGER');
      console.log('Migration: Added inquiry_id column to work_orders');
    }

    if (!workOrderColumns.includes('subtotal')) {
      db.exec('ALTER TABLE work_orders ADD COLUMN subtotal REAL DEFAULT 0');
      console.log('Migration: Added subtotal column to work_orders');
    }

    if (!workOrderColumns.includes('total_discount')) {
      db.exec('ALTER TABLE work_orders ADD COLUMN total_discount REAL DEFAULT 0');
      console.log('Migration: Added total_discount column to work_orders');
    }

    if (!workOrderColumns.includes('total_gst')) {
      db.exec('ALTER TABLE work_orders ADD COLUMN total_gst REAL DEFAULT 0');
      console.log('Migration: Added total_gst column to work_orders');
    }

    if (!workOrderColumns.includes('approved_at')) {
      db.exec('ALTER TABLE work_orders ADD COLUMN approved_at DATETIME');
      console.log('Migration: Added approved_at column to work_orders');
    }

    if (!workOrderColumns.includes('sent_to_production_at')) {
      db.exec('ALTER TABLE work_orders ADD COLUMN sent_to_production_at DATETIME');
      console.log('Migration: Added sent_to_production_at column to work_orders');
    }

    if (!workOrderColumns.includes('rejection_reason')) {
      db.exec('ALTER TABLE work_orders ADD COLUMN rejection_reason TEXT');
      console.log('Migration: Added rejection_reason column to work_orders');
    }

    if (!workOrderColumns.includes('error_log')) {
      db.exec('ALTER TABLE work_orders ADD COLUMN error_log TEXT');
      console.log('Migration: Added error_log column to work_orders');
    }
  } catch (migrationError) {
    console.log('Work order migration check completed:', migrationError.message);
  }

  // Migration: Add missing is_deleted columns for soft-delete support
  try {
    const softDeleteTargets = [
      'customer_inquiries',
      'quotations',
      'performa_invoices',
      'work_orders',
      'machine_products',
      'spare_products',
    ];

    for (const tableName of softDeleteTargets) {
      const tableInfo = db.pragma(`table_info(${tableName})`);
      const columns = tableInfo.map(row => row.name);
      if (!columns.includes('is_deleted')) {
        db.exec(`ALTER TABLE ${tableName} ADD COLUMN is_deleted INTEGER DEFAULT 0`);
        console.log(`Migration: Added is_deleted column to ${tableName}`);
      }
    }
  } catch (migrationError) {
    console.log('Soft-delete migration check completed:', migrationError.message);
  }



  // Create notifications table (DB-backed, append-only)
  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);


  // Create audit_logs table (immutable, append-only)
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

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_audit_performed_by ON audit_logs(performed_by)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_audit_performed_at ON audit_logs(performed_at)
  `);

  console.log('Database initialized successfully');
  console.log('Database path:', dbPath);
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
