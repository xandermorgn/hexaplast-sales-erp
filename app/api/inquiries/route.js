import { executeController, parseJsonBody } from '../../../server/next/adapter.js';
import { requireSession } from '../../../server/middleware/sessionMiddleware.js';
import { createInquiry, getInquiries } from '../../../server/controllers/customerInquiryController.js';

export async function GET(request) {
  return executeController({
    request,
    controller: getInquiries,
    middlewares: [requireSession],
  });
}

export async function POST(request) {
  const body = await parseJsonBody(request);
  return executeController({
    request,
    controller: createInquiry,
    middlewares: [requireSession],
    body,
  });
}
