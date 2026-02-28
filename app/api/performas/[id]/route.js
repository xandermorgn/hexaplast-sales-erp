import { executeController, parseJsonBody } from '../../../../server/next/adapter.js';
import { requireSession } from '../../../../server/middleware/sessionMiddleware.js';
import { getPerformaById, updatePerforma, deletePerforma } from '../../../../server/controllers/performaControllerStable.js';

export async function GET(request, { params }) {
  const { id } = await params;
  return executeController({
    request,
    controller: getPerformaById,
    middlewares: [requireSession],
    params: { id },
  });
}

export async function PUT(request, { params }) {
  const { id } = await params;
  const body = await parseJsonBody(request);
  return executeController({
    request,
    controller: updatePerforma,
    middlewares: [requireSession],
    params: { id },
    body,
  });
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  return executeController({
    request,
    controller: deletePerforma,
    middlewares: [requireSession],
    params: { id },
  });
}
