import { executeController } from '../../../../server/next/adapter.js';
import { requireSession } from '../../../../server/middleware/sessionMiddleware.js';
import { getPendingWorkOrders } from '../../../../server/controllers/bomController.js';

export async function GET(request) {
  return executeController({
    request,
    controller: getPendingWorkOrders,
    middlewares: [requireSession],
  });
}
