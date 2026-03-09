import { executeController, parseJsonBody } from '../../../../../../../server/next/adapter.js';
import { requireSession } from '../../../../../../../server/middleware/sessionMiddleware.js';
import { updatePart, deletePart } from '../../../../../../../server/controllers/machinePartsController.js';

export async function PUT(request, { params }) {
  const { id, partId } = await params;
  const body = await parseJsonBody(request);
  return executeController({
    request,
    controller: updatePart,
    middlewares: [requireSession],
    params: { machineId: id, partId },
    body,
  });
}

export async function DELETE(request, { params }) {
  const { id, partId } = await params;
  return executeController({
    request,
    controller: deletePart,
    middlewares: [requireSession],
    params: { machineId: id, partId },
  });
}
