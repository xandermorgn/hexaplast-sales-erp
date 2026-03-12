import { executeController, parseJsonBody } from '../../../../server/next/adapter.js';
import { requireSession } from '../../../../server/middleware/sessionMiddleware.js';
import { bulkImportVendors } from '../../../../server/controllers/vendorController.js';

export async function POST(request) {
  const body = await parseJsonBody(request);
  return executeController({
    request,
    controller: bulkImportVendors,
    middlewares: [requireSession],
    body,
  });
}
