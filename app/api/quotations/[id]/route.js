import { executeController, parseJsonBody } from '../../../../server/next/adapter.js';
import { requireSession } from '../../../../server/middleware/sessionMiddleware.js';
import { getQuotationById, updateQuotation, deleteQuotation } from '../../../../server/controllers/quotationControllerStable.js';

export async function GET(request, { params }) {
  const { id } = await params;
  return executeController({
    request,
    controller: getQuotationById,
    middlewares: [requireSession],
    params: { id },
  });
}

export async function PUT(request, { params }) {
  const { id } = await params;
  const body = await parseJsonBody(request);
  return executeController({
    request,
    controller: updateQuotation,
    middlewares: [requireSession],
    params: { id },
    body,
  });
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  return executeController({
    request,
    controller: deleteQuotation,
    middlewares: [requireSession],
    params: { id },
  });
}
