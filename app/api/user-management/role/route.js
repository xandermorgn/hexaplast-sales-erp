import { executeController, parseJsonBody } from '../../../../server/next/adapter.js';
import { requireSession } from '../../../../server/middleware/sessionMiddleware.js';
import { setUserRole } from '../../../../server/controllers/settingsController.js';

export async function PUT(request) {
  const body = await parseJsonBody(request);
  return executeController({
    request,
    controller: setUserRole,
    middlewares: [requireSession],
    body,
  });
}
