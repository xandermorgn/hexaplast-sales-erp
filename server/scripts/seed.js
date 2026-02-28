import { initDatabase, get, run } from '../config/database.js';
import { hashPassword } from '../utils/hash.js';

async function seed() {
  console.log('Starting database seed...\n');

  try {
    await initDatabase();

    const existingMasterAdmin = get("SELECT * FROM users WHERE role = 'master_admin'");
    
    if (existingMasterAdmin) {
      console.log('⚠ Master Admin already exists. Skipping seed.');
      console.log(`   Login ID: ${existingMasterAdmin.login_id}`);
      return;
    }

    const masterAdminPassword = 'Xander@998877';
    const hashedPassword = await hashPassword(masterAdminPassword);

    run(
      `INSERT INTO users (login_id, password_hash, name, role)
       VALUES (?, ?, ?, ?)`,
      ['Xander', hashedPassword, 'Xander (Master Admin)', 'master_admin']
    );

    console.log('✓ Master Admin created successfully\n');
    console.log('Credentials:');
    console.log('  Login ID: Xander');
    console.log('  Password: Xander@998877');
    console.log('\n⚠ IMPORTANT: All other users must be created via Master Admin → Add Employee\n');

    console.log('✓ Database seeded successfully!');
    console.log('\nTotal users created: 1 (Master Admin only)');

  } catch (error) {
    console.error('✗ Seed failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

seed();
