import { executeController, parseJsonBody } from '../../../server/next/adapter.js';
import { requireSession } from '../../../server/middleware/sessionMiddleware.js';
import { getAllFollowUps, createFollowUp } from '../../../server/controllers/followUpController.js';

export async function GET(request) {
  return executeController({
    request,
    controller: getAllFollowUps,
    middlewares: [requireSession],
  });
}

export async function POST(request) {
  const body = await parseJsonBody(request);
  return executeController({
    request,
    controller: createFollowUp,
    middlewares: [requireSession],
    body,
  });
}
