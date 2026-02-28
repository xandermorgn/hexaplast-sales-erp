import { executeController, parseJsonBody } from '../../../../server/next/adapter.js';
import { requireSession } from '../../../../server/middleware/sessionMiddleware.js';
import { getWorkOrderById, updateWorkOrder, deleteWorkOrder } from '../../../../server/controllers/workOrderControllerStable.js';

export async function GET(request, { params }) {
  const { id } = await params;
  return executeController({
    request,
    controller: getWorkOrderById,
    middlewares: [requireSession],
    params: { id },
  });
}

export async function PUT(request, { params }) {
  const { id } = await params;
  const body = await parseJsonBody(request);
  return executeController({
    request,
    controller: updateWorkOrder,
    middlewares: [requireSession],
    params: { id },
    body,
  });
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  return executeController({
    request,
    controller: deleteWorkOrder,
    middlewares: [requireSession],
    params: { id },
  });
}
