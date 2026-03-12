import { executeController } from '../../../../server/next/adapter.js';
import { requireSession } from '../../../../server/middleware/sessionMiddleware.js';
import { requireServerAdminSession } from '../../../../server/middleware/sessionMiddleware.js';
import { backupDatabase } from '../../../../server/controllers/databaseController.js';

export async function GET(request) {
  return executeController({
    request,
    controller: backupDatabase,
    middlewares: [requireSession, requireServerAdminSession],
  });
}
