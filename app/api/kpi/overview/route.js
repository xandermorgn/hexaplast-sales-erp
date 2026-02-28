import { executeController } from '../../../../server/next/adapter.js';
import { requireSession, requireMasterAdminSession } from '../../../../server/middleware/sessionMiddleware.js';
import { getKpiOverview } from '../../../../server/controllers/kpiController.js';

export async function GET(request) {
  return executeController({
    request,
    controller: getKpiOverview,
    middlewares: [requireSession, requireMasterAdminSession],
  });
}
