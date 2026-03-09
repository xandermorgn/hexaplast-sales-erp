import { executeController } from '../../../../server/next/adapter.js';
import { requireSession } from '../../../../server/middleware/sessionMiddleware.js';
import { getDueFollowUps } from '../../../../server/controllers/followUpController.js';

export async function GET(request) {
  return executeController({
    request,
    controller: getDueFollowUps,
    middlewares: [requireSession],
  });
}
