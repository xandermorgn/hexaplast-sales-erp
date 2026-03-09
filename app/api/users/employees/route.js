import { executeController, parseJsonBody } from '../../../../server/next/adapter.js';
import { requireSession, requireMasterAdminSession } from '../../../../server/middleware/sessionMiddleware.js';
import { createEmployee, getAllEmployees } from '../../../../server/controllers/employeeController.js';

export async function GET(request) {
  return executeController({
    request,
    controller: getAllEmployees,
    middlewares: [requireSession, requireMasterAdminSession],
  });
}

export async function POST(request) {
  const body = await parseJsonBody(request);
  return executeController({
    request,
    controller: createEmployee,
    middlewares: [requireSession, requireMasterAdminSession],
    body,
  });
}
