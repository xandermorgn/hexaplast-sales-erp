import { initDatabase } from '../config/database.js';
import { ensureBootstrapMasterAdmin } from '../utils/bootstrapMasterAdmin.js';

async function bootstrapMasterAdmin() {
  try {
    await initDatabase();
    await ensureBootstrapMasterAdmin({ logCreated: true });
  } catch (error) {
    console.error('Bootstrap Master Admin failed:', error.message);
    process.exit(1);
  }
}

bootstrapMasterAdmin();
