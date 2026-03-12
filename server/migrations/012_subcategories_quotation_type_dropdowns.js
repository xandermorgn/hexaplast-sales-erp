/**
 * Migration 012 — Sub-categories, quotation_type, dynamic dropdown values
 *
 * 1. product_subcategories table (bundles of machines)
 * 2. subcategory_products relation table
 * 3. quotation_type column on quotations
 * 4. dropdown_values table for dynamic dropdown management
 */
export function up(db) {
  // 1. Product sub-categories
  db.exec(`
    CREATE TABLE IF NOT EXISTS product_subcategories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES product_categories(id) ON DELETE SET NULL
    )
  `);

  // 2. Relation: which products belong to which subcategory
  db.exec(`
    CREATE TABLE IF NOT EXISTS subcategory_products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subcategory_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      product_type TEXT NOT NULL DEFAULT 'machine' CHECK(product_type IN ('machine', 'spare')),
      FOREIGN KEY (subcategory_id) REFERENCES product_subcategories(id) ON DELETE CASCADE
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_subcat_products_subcat ON subcategory_products(subcategory_id)`);

  // 3. quotation_type on quotations (Machine / Spare)
  const qtCols = db.prepare("PRAGMA table_info(quotations)").all();
  if (!qtCols.find(c => c.name === 'quotation_type')) {
    db.exec("ALTER TABLE quotations ADD COLUMN quotation_type TEXT DEFAULT NULL");
  }

  // 4. Dynamic dropdown values
  db.exec(`
    CREATE TABLE IF NOT EXISTS dropdown_values (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      field_name TEXT NOT NULL,
      value TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(field_name, value)
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_dropdown_field ON dropdown_values(field_name)`);

  // Seed existing unique values from customer_inquiries into dropdown_values
  const fields = [
    { col: 'enquiry_source', field: 'enquiry_source' },
    { col: 'category', field: 'category' },
    { col: 'industry', field: 'industry' },
    { col: 'region', field: 'region' },
  ];

  const insertStmt = db.prepare(
    'INSERT OR IGNORE INTO dropdown_values (field_name, value) VALUES (?, ?)'
  );

  for (const { col, field } of fields) {
    const rows = db.prepare(
      `SELECT DISTINCT ${col} FROM customer_inquiries WHERE ${col} IS NOT NULL AND TRIM(${col}) != ''`
    ).all();
    for (const row of rows) {
      const val = (row[col] || '').trim();
      if (val) insertStmt.run(field, val);
    }
  }
}
