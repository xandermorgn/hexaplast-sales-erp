import { executeController } from '../../../server/next/adapter.js';
import { requireSession, requireMasterAdminSession } from '../../../server/middleware/sessionMiddleware.js';
import { getAuditLogs } from '../../../server/controllers/auditController.js';

export async function GET(request) {
  return executeController({
    request,
    controller: getAuditLogs,
    middlewares: [requireSession, requireMasterAdminSession],
  });
}
