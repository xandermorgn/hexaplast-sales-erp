import { executeController, parseJsonBody } from '../../../server/next/adapter.js';
import { requireSession } from '../../../server/middleware/sessionMiddleware.js';
import { createEmployee, getAllEmployees } from '../../../server/controllers/employeeController.js';

function requireAdminOrEmployee(req, res, next) {
  if (req.user?.role === 'master_admin' || req.user?.role === 'employee') return next();
  return res.status(403).json({ error: 'Forbidden', message: 'Access denied.' });
}

export async function GET(request) {
  return executeController({
    request,
    controller: getAllEmployees,
    middlewares: [requireSession, requireAdminOrEmployee],
  });
}

export async function POST(request) {
  const body = await parseJsonBody(request);
  return executeController({
    request,
    controller: createEmployee,
    middlewares: [requireSession, requireAdminOrEmployee],
    body,
  });
}
