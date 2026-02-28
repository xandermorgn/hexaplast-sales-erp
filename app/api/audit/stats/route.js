import { executeController } from '../../../../server/next/adapter.js';
import { requireSession, requireMasterAdminSession } from '../../../../server/middleware/sessionMiddleware.js';
import { getAuditStats } from '../../../../server/controllers/auditController.js';

export async function GET(request) {
  return executeController({
    request,
    controller: getAuditStats,
    middlewares: [requireSession, requireMasterAdminSession],
  });
}
