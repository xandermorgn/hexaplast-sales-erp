import { executeController, parseJsonBody } from '../../../server/next/adapter.js';
import { requireSession } from '../../../server/middleware/sessionMiddleware.js';
import { getAllVendors, createVendor } from '../../../server/controllers/vendorController.js';

export async function GET(request) {
  return executeController({
    request,
    controller: getAllVendors,
    middlewares: [requireSession],
  });
}

export async function POST(request) {
  const body = await parseJsonBody(request);
  return executeController({
    request,
    controller: createVendor,
    middlewares: [requireSession],
    body,
  });
}
