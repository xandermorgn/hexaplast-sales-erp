import { executeController } from '../../../../../server/next/adapter.js';
import { requireSession } from '../../../../../server/middleware/sessionMiddleware.js';
import { generatePurchaseOrders } from '../../../../../server/controllers/purchaseInquiryController.js';

export async function POST(request) {
  return executeController({
    request,
    controller: generatePurchaseOrders,
    middlewares: [requireSession],
  });
}
