import { executeController, parseJsonBody } from '../../../../server/next/adapter.js';
import { requireSession } from '../../../../server/middleware/sessionMiddleware.js';
import { getTermById, updateTerm, deleteTerm } from '../../../../server/controllers/termsController.js';

export async function GET(request, { params }) {
  const { id } = await params;
  return executeController({
    request,
    controller: getTermById,
    middlewares: [requireSession],
    params: { id },
  });
}

export async function PUT(request, { params }) {
  const { id } = await params;
  const body = await parseJsonBody(request);
  return executeController({
    request,
    controller: updateTerm,
    middlewares: [requireSession],
    params: { id },
    body,
  });
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  return executeController({
    request,
    controller: deleteTerm,
    middlewares: [requireSession],
    params: { id },
  });
}
