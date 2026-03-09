import { executeController, parseJsonBody } from '../../../../../server/next/adapter.js';
import { requireSession } from '../../../../../server/middleware/sessionMiddleware.js';
import { getPurchaseOrderById, updatePurchaseOrder } from '../../../../../server/controllers/purchaseInquiryController.js';

export async function GET(request, { params }) {
  const { id } = await params;
  return executeController({
    request,
    controller: getPurchaseOrderById,
    middlewares: [requireSession],
    params: { id },
  });
}

export async function PUT(request, { params }) {
  const { id } = await params;
  const body = await parseJsonBody(request);
  return executeController({
    request,
    controller: updatePurchaseOrder,
    middlewares: [requireSession],
    params: { id },
    body,
  });
}
