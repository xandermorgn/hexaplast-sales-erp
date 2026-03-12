import { executeController, parseJsonBody } from '../../../../../server/next/adapter.js';
import { requireSession } from '../../../../../server/middleware/sessionMiddleware.js';
import { confirmPurchaseOrder } from '../../../../../server/controllers/purchaseInquiryController.js';

export async function POST(request) {
  const body = await parseJsonBody(request);
  return executeController({
    request,
    controller: confirmPurchaseOrder,
    middlewares: [requireSession],
    body,
  });
}
