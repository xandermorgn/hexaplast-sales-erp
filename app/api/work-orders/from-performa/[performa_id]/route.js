import { executeController, parseJsonBody } from '../../../../../server/next/adapter.js';
import { requireSession } from '../../../../../server/middleware/sessionMiddleware.js';
import { createWorkOrderFromPerforma } from '../../../../../server/controllers/workOrderControllerStable.js';

export async function POST(request, { params }) {
  const { performa_id } = await params;
  const body = await parseJsonBody(request);
  return executeController({
    request,
    controller: createWorkOrderFromPerforma,
    middlewares: [requireSession],
    params: { performa_id },
    body,
  });
}
