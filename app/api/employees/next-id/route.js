import { executeController } from '../../../../server/next/adapter.js';
import { requireSession, requireMasterAdminSession } from '../../../../server/middleware/sessionMiddleware.js';
import { getNextEmployeeId } from '../../../../server/controllers/employeeController.js';

export async function GET(request) {
  return executeController({
    request,
    controller: getNextEmployeeId,
    middlewares: [requireSession, requireMasterAdminSession],
  });
}
