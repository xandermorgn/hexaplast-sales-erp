import { executeController } from '../../../../server/next/adapter.js';
import { requireSession } from '../../../../server/middleware/sessionMiddleware.js';
import { getAllBoms } from '../../../../server/controllers/bomController.js';

export async function GET(request) {
  return executeController({
    request,
    controller: getAllBoms,
    middlewares: [requireSession],
  });
}
