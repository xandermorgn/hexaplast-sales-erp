import { executeController, parseJsonBody } from '../../../server/next/adapter.js';
import { requireSession } from '../../../server/middleware/sessionMiddleware.js';
import { listTerms, createTerm } from '../../../server/controllers/termsController.js';

export async function GET(request) {
  return executeController({
    request,
    controller: listTerms,
    middlewares: [requireSession],
  });
}

export async function POST(request) {
  const body = await parseJsonBody(request);
  return executeController({
    request,
    controller: createTerm,
    middlewares: [requireSession],
    body,
  });
}
