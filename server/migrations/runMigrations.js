/**
 * Migration Runner for Hexaplast ERP
 *
 * Reads the current schema_version, compares with available migration files,
 * runs only missing migrations in order, and updates the version after each.
 *
 * Usage:
 *   import { runMigrations } from './migrations/runMigrations.js';
 *   await runMigrations(db);   // call after initDatabase()
 */

import fs from 'fs';
import path from 'path';

// Static imports — Next.js bundles server code so we cannot use
// fs.readdirSync + dynamic import() to discover migration files.
import { up as up001 } from './001_user_profiles_columns.js';
import { up as up002 } from './002_product_table_columns.js';
import { up as up003 } from './003_quotation_performa_columns.js';
import { up as up004 } from './004_work_order_columns.js';
import { up as up005 } from './005_item_snapshot_columns.js';
import { up as up006 } from './006_soft_delete_columns.js';
import { up as up007 } from './007_create_followups_table.js';
import { up as up008 } from './008_create_purchase_module_tables.js';
import { up as up009 } from './009_create_notifications_audit_tables.js';

// ── Backup helper ──────────────────────────────────────────────────────────

function backupDatabase(dbPath) {
  const backupsDir = path.resolve(path.dirname(dbPath), '..', 'backups');
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(backupsDir, `erp_backup_${timestamp}.db`);

  fs.copyFileSync(dbPath, backupFile);
  console.log(`[migrations] Backup created: ${backupFile}`);
  return backupFile;
}

// ── Migration registry ─────────────────────────────────────────────────────
// When adding a new migration:
//   1. Create the file (e.g. 010_my_change.js) with an exported `up(db)` fn
//   2. Add a static import above
//   3. Append an entry to this array

const MIGRATIONS = [
  { version: 1, name: '001_user_profiles_columns', up: up001 },
  { version: 2, name: '002_product_table_columns', up: up002 },
  { version: 3, name: '003_quotation_performa_columns', up: up003 },
  { version: 4, name: '004_work_order_columns', up: up004 },
  { version: 5, name: '005_item_snapshot_columns', up: up005 },
  { version: 6, name: '006_soft_delete_columns', up: up006 },
  { version: 7, name: '007_create_followups_table', up: up007 },
  { version: 8, name: '008_create_purchase_module_tables', up: up008 },
  { version: 9, name: '009_create_notifications_audit_tables', up: up009 },
];

// ── Main runner ────────────────────────────────────────────────────────────

export async function runMigrations(db, dbPath) {
  // 1. Ensure schema_version table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER NOT NULL
    )
  `);

  // Seed with version 0 if empty. All migrations are idempotent
  // (column-existence checks + CREATE TABLE IF NOT EXISTS) so it's
  // always safe to re-run them on an existing database.
  const row = db.prepare('SELECT version FROM schema_version LIMIT 1').get();
  let currentVersion = 0;
  if (!row) {
    db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(0);
    console.log('[migrations] schema_version initialized at version 0');
  } else {
    currentVersion = row.version;
  }

  console.log(`[migrations] Current schema version: ${currentVersion}`);

  // 2. Filter pending migrations from static registry
  const pending = MIGRATIONS.filter(m => m.version > currentVersion);

  if (pending.length === 0) {
    console.log('[migrations] Schema is up to date — nothing to run.');
    return;
  }

  console.log(`[migrations] ${pending.length} pending migration(s) to run.`);

  // 3. Create backup before running any migration
  if (dbPath && fs.existsSync(dbPath)) {
    try {
      backupDatabase(dbPath);
    } catch (err) {
      console.error('[migrations] Backup failed — aborting migrations for safety:', err.message);
      return;
    }
  }

  // 4. Run each pending migration inside a transaction
  for (const migration of pending) {
    console.log(`[migrations] Running ${migration.name} (v${migration.version}) ...`);
    const txn = db.transaction(() => {
      migration.up(db);
      db.prepare('UPDATE schema_version SET version = ?').run(migration.version);
    });

    try {
      txn();
      console.log(`[migrations] ✓ ${migration.name} applied successfully.`);
    } catch (err) {
      console.error(`[migrations] ✗ ${migration.name} FAILED:`, err.message);
      console.error('[migrations] Rolling back this migration. Later migrations skipped.');
      throw err; // propagate so the server knows
    }
  }

  const finalRow = db.prepare('SELECT version FROM schema_version LIMIT 1').get();
  console.log(`[migrations] All migrations applied. Schema version now: ${finalRow.version}`);
}
