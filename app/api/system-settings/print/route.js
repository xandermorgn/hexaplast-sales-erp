import { executeController } from '../../../../server/next/adapter.js';
import { requireSession } from '../../../../server/middleware/sessionMiddleware.js';
import { getPrintSettings } from '../../../../server/controllers/systemSettingsController.js';

export async function GET(request) {
  return executeController({
    request,
    controller: getPrintSettings,
    middlewares: [requireSession],
  });
}
