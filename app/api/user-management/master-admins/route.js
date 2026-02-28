import { executeController } from '../../../../server/next/adapter.js';
import { requireSession, requireServerAdminSession } from '../../../../server/middleware/sessionMiddleware.js';
import { listUsers } from '../../../../server/controllers/settingsController.js';

export async function GET(request) {
  return executeController({
    request,
    controller: listUsers,
    middlewares: [requireSession, requireServerAdminSession],
  });
}
