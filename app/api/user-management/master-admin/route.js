import { executeController, parseJsonBody } from '../../../../server/next/adapter.js';
import { requireSession, requireServerAdminSession } from '../../../../server/middleware/sessionMiddleware.js';
import { createMasterAdmin } from '../../../../server/controllers/settingsController.js';

export async function POST(request) {
  const body = await parseJsonBody(request);
  return executeController({
    request,
    controller: createMasterAdmin,
    middlewares: [requireSession, requireServerAdminSession],
    body,
  });
}
