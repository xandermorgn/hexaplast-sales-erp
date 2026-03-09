import { executeController, parseJsonBody } from '../../../../../server/next/adapter.js';
import { requireSession } from '../../../../../server/middleware/sessionMiddleware.js';
import { createBomFromWorkOrder } from '../../../../../server/controllers/bomController.js';

export async function POST(request) {
  const body = await parseJsonBody(request);
  return executeController({
    request,
    controller: createBomFromWorkOrder,
    middlewares: [requireSession],
    body,
  });
}
