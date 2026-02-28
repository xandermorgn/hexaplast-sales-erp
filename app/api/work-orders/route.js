import { executeController, parseJsonBody } from '../../../server/next/adapter.js';
import { requireSession } from '../../../server/middleware/sessionMiddleware.js';
import { createWorkOrder, getWorkOrders } from '../../../server/controllers/workOrderControllerStable.js';

export async function GET(request) {
  return executeController({
    request,
    controller: getWorkOrders,
    middlewares: [requireSession],
  });
}

export async function POST(request) {
  const body = await parseJsonBody(request);
  return executeController({
    request,
    controller: createWorkOrder,
    middlewares: [requireSession],
    body,
  });
}
