import { executeController, parseJsonBody } from '../../../server/next/adapter.js';
import { requireSession } from '../../../server/middleware/sessionMiddleware.js';
import { createQuotation, getQuotations } from '../../../server/controllers/quotationControllerStable.js';

export async function GET(request) {
  return executeController({
    request,
    controller: getQuotations,
    middlewares: [requireSession],
  });
}

export async function POST(request) {
  const body = await parseJsonBody(request);
  return executeController({
    request,
    controller: createQuotation,
    middlewares: [requireSession],
    body,
  });
}
