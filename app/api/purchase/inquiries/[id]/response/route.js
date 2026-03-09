import { executeController, parseJsonBody } from '../../../../../../server/next/adapter.js';
import { requireSession } from '../../../../../../server/middleware/sessionMiddleware.js';
import { addResponse, getResponses } from '../../../../../../server/controllers/purchaseInquiryController.js';

export async function GET(request, { params }) {
  const { id } = await params;
  return executeController({
    request,
    controller: getResponses,
    middlewares: [requireSession],
    params: { id },
  });
}

export async function POST(request, { params }) {
  const { id } = await params;
  const body = await parseJsonBody(request);
  return executeController({
    request,
    controller: addResponse,
    middlewares: [requireSession],
    params: { id },
    body,
  });
}
