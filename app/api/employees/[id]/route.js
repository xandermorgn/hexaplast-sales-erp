import { executeController, parseJsonBody } from '../../../../server/next/adapter.js';
import { requireSession } from '../../../../server/middleware/sessionMiddleware.js';
import { getEmployeeById, updateEmployee, deleteEmployee } from '../../../../server/controllers/employeeController.js';

function requireAdminOrEmployee(req, res, next) {
  if (req.user?.role === 'master_admin' || req.user?.role === 'employee') return next();
  return res.status(403).json({ error: 'Forbidden', message: 'Access denied.' });
}

export async function GET(request, { params }) {
  const { id } = await params;
  return executeController({
    request,
    controller: getEmployeeById,
    middlewares: [requireSession, requireAdminOrEmployee],
    params: { id },
  });
}

export async function PUT(request, { params }) {
  const { id } = await params;
  const body = await parseJsonBody(request);
  return executeController({
    request,
    controller: updateEmployee,
    middlewares: [requireSession, requireAdminOrEmployee],
    params: { id },
    body,
  });
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  return executeController({
    request,
    controller: deleteEmployee,
    middlewares: [requireSession, requireAdminOrEmployee],
    params: { id },
  });
}
