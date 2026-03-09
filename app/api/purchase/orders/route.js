import { executeController } from '../../../../server/next/adapter.js';
import { requireSession } from '../../../../server/middleware/sessionMiddleware.js';
import { getAllPurchaseOrders } from '../../../../server/controllers/purchaseInquiryController.js';

export async function GET(request) {
  return executeController({
    request,
    controller: getAllPurchaseOrders,
    middlewares: [requireSession],
  });
}
