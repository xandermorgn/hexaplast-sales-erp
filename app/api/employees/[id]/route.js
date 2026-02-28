import { executeController, parseJsonBody } from '../../../../server/next/adapter.js';
import { requireSession, requireMasterAdminSession } from '../../../../server/middleware/sessionMiddleware.js';
import { getEmployeeById, updateEmployee, deleteEmployee } from '../../../../server/controllers/employeeController.js';

export async function GET(request, { params }) {
  const { id } = await params;
  return executeController({
    request,
    controller: getEmployeeById,
    middlewares: [requireSession, requireMasterAdminSession],
    params: { id },
  });
}

export async function PUT(request, { params }) {
  const { id } = await params;
  const body = await parseJsonBody(request);
  return executeController({
    request,
    controller: updateEmployee,
    middlewares: [requireSession, requireMasterAdminSession],
    params: { id },
    body,
  });
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  return executeController({
    request,
    controller: deleteEmployee,
    middlewares: [requireSession, requireMasterAdminSession],
    params: { id },
  });
}
