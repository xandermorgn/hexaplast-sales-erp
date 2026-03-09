import { executeController, parseJsonBody } from '../../../../../../server/next/adapter.js';
import { requireSession } from '../../../../../../server/middleware/sessionMiddleware.js';
import { getPartsForMachine, addPart, bulkSaveParts } from '../../../../../../server/controllers/machinePartsController.js';

export async function GET(request, { params }) {
  const { id } = await params;
  return executeController({
    request,
    controller: getPartsForMachine,
    middlewares: [requireSession],
    params: { machineId: id, id },
  });
}

export async function POST(request, { params }) {
  const { id } = await params;
  const body = await parseJsonBody(request);
  return executeController({
    request,
    controller: addPart,
    middlewares: [requireSession],
    params: { machineId: id, id },
    body,
  });
}

export async function PUT(request, { params }) {
  const { id } = await params;
  const body = await parseJsonBody(request);
  return executeController({
    request,
    controller: bulkSaveParts,
    middlewares: [requireSession],
    params: { machineId: id, id },
    body,
  });
}
