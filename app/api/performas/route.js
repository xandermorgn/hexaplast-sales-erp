import { executeController, parseJsonBody } from '../../../server/next/adapter.js';
import { requireSession } from '../../../server/middleware/sessionMiddleware.js';
import { createPerforma, getPerformas } from '../../../server/controllers/performaControllerStable.js';

export async function GET(request) {
  return executeController({
    request,
    controller: getPerformas,
    middlewares: [requireSession],
  });
}

export async function POST(request) {
  const body = await parseJsonBody(request);
  return executeController({
    request,
    controller: createPerforma,
    middlewares: [requireSession],
    body,
  });
}
