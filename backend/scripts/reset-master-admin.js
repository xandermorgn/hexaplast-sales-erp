import { initDatabase, get, run } from '../config/database.js';
import { hashPassword } from '../utils/hash.js';

async function resetMasterAdmin() {
  console.log('Resetting Master Admin credentials...\n');

  try {
    await initDatabase();

    const newLoginId = 'Xander';
    const newPassword = 'Xander@998877';
    const hashedPassword = await hashPassword(newPassword);

    // Check if master admin exists
    const existingMasterAdmin = get("SELECT * FROM users WHERE role = 'master_admin'");
    
    if (existingMasterAdmin) {
      console.log('Found existing Master Admin:', existingMasterAdmin.login_id);
      console.log('Updating credentials...\n');
      
      // Update existing master admin
      run(
        `UPDATE users 
         SET login_id = ?, password_hash = ?, name = ?
         WHERE role = 'master_admin'`,
        [newLoginId, hashedPassword, 'Xander (Master Admin)']
      );
      
      console.log('✓ Master Admin credentials updated successfully!\n');
    } else {
      console.log('No Master Admin found. Creating new one...\n');
      
      // Create new master admin
      run(
        `INSERT INTO users (login_id, password_hash, name, role)
         VALUES (?, ?, ?, ?)`,
        [newLoginId, hashedPassword, 'Xander (Master Admin)', 'master_admin']
      );
      
      console.log('✓ Master Admin created successfully!\n');
    }

    console.log('New Credentials:');
    console.log('  Login ID: Xander');
    console.log('  Password: Xander@998877');
    console.log('\n✓ You can now log in with these credentials!\n');

  } catch (error) {
    console.error('✗ Reset failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

resetMasterAdmin();
