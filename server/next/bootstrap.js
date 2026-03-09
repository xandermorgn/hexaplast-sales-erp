import { initDatabase } from '../config/database.js'
import { ensureBootstrapMasterAdmin } from '../utils/bootstrapMasterAdmin.js'
import { ensureDefaultSystemSettings } from '../utils/systemSettings.js'

let bootstrapPromise = null

export async function initializeServerRuntime() {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      await initDatabase()
      await ensureBootstrapMasterAdmin({ logCreated: true })
      ensureDefaultSystemSettings()
    })()
  }

  return bootstrapPromise
}
