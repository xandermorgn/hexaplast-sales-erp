import { executeController, parseJsonBody } from '../../../../server/next/adapter.js';
import { requireSession } from '../../../../server/middleware/sessionMiddleware.js';
import { requireServerAdminSession } from '../../../../server/middleware/sessionMiddleware.js';
import { importDatabase } from '../../../../server/controllers/databaseController.js';

export async function POST(request) {
  const body = await parseJsonBody(request);
  return executeController({
    request,
    controller: importDatabase,
    middlewares: [requireSession, requireServerAdminSession],
    body,
  });
}
