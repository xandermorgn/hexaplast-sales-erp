import { executeController, parseJsonBody } from '../../../../../server/next/adapter.js';
import { requireSession } from '../../../../../server/middleware/sessionMiddleware.js';
import { retryWorkOrderProductionPush } from '../../../../../server/controllers/workOrderControllerStable.js';

export async function POST(request, { params }) {
  const { id } = await params;
  const body = await parseJsonBody(request);
  return executeController({
    request,
    controller: retryWorkOrderProductionPush,
    middlewares: [requireSession],
    params: { id },
    body,
  });
}
