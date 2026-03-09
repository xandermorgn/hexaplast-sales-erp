/**
 * Migration 008: Create purchase module tables
 * (machine_parts, work_order_boms, bom_materials, vendors, purchase_inquiries,
 *  inquiry_vendor_responses, purchase_orders, purchase_order_items)
 */
export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS machine_parts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      machine_id INTEGER NOT NULL,
      part_number TEXT,
      part_name TEXT NOT NULL,
      specification TEXT,
      unit TEXT DEFAULT 'Nos',
      default_quantity REAL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (machine_id) REFERENCES machine_products(id) ON DELETE CASCADE
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_machine_parts_machine ON machine_parts(machine_id)`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS work_order_boms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      work_order_id INTEGER NOT NULL,
      machine_id INTEGER NOT NULL,
      machine_index INTEGER NOT NULL DEFAULT 1,
      status TEXT DEFAULT 'draft' CHECK(status IN ('draft','in_progress','completed')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE CASCADE,
      FOREIGN KEY (machine_id) REFERENCES machine_products(id) ON DELETE CASCADE
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_bom_work_order ON work_order_boms(work_order_id)`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS bom_materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bom_id INTEGER NOT NULL,
      part_id INTEGER,
      part_number TEXT,
      part_name TEXT NOT NULL,
      specification TEXT,
      quantity REAL DEFAULT 1,
      unit TEXT DEFAULT 'Nos',
      notes TEXT,
      added_to_purchase INTEGER DEFAULT 0,
      vendor_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (bom_id) REFERENCES work_order_boms(id) ON DELETE CASCADE,
      FOREIGN KEY (part_id) REFERENCES machine_parts(id) ON DELETE SET NULL,
      FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE SET NULL
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_bom_materials_bom ON bom_materials(bom_id)`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS vendors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      address TEXT,
      gst TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS purchase_inquiries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bom_material_id INTEGER NOT NULL,
      vendor_id INTEGER NOT NULL,
      message TEXT,
      sent_via TEXT DEFAULT 'whatsapp',
      status TEXT DEFAULT 'sent' CHECK(status IN ('sent','responded','closed')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (bom_material_id) REFERENCES bom_materials(id) ON DELETE CASCADE,
      FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_pinq_material ON purchase_inquiries(bom_material_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_pinq_vendor ON purchase_inquiries(vendor_id)`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS inquiry_vendor_responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inquiry_id INTEGER NOT NULL,
      unit_price REAL,
      total_price REAL,
      remarks TEXT,
      responded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (inquiry_id) REFERENCES purchase_inquiries(id) ON DELETE CASCADE
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_ivr_inquiry ON inquiry_vendor_responses(inquiry_id)`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS purchase_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      po_number TEXT NOT NULL UNIQUE,
      vendor_id INTEGER NOT NULL,
      status TEXT DEFAULT 'draft' CHECK(status IN ('draft','sent','acknowledged','completed','cancelled')),
      total_amount REAL DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_po_vendor ON purchase_orders(vendor_id)`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS purchase_order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_order_id INTEGER NOT NULL,
      bom_material_id INTEGER NOT NULL,
      inquiry_id INTEGER,
      part_name TEXT NOT NULL,
      specification TEXT,
      quantity REAL DEFAULT 1,
      unit TEXT DEFAULT 'Nos',
      unit_price REAL DEFAULT 0,
      total_price REAL DEFAULT 0,
      FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
      FOREIGN KEY (bom_material_id) REFERENCES bom_materials(id) ON DELETE CASCADE,
      FOREIGN KEY (inquiry_id) REFERENCES purchase_inquiries(id) ON DELETE SET NULL
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_poi_po ON purchase_order_items(purchase_order_id)`);
}
