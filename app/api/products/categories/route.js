import { executeController, parseJsonBody } from '../../../../server/next/adapter.js';
import { requireSession } from '../../../../server/middleware/sessionMiddleware.js';
import { createCategory, getCategories } from '../../../../server/controllers/productController.js';

export async function GET(request) {
  return executeController({
    request,
    controller: getCategories,
    middlewares: [requireSession],
  });
}

export async function POST(request) {
  const body = await parseJsonBody(request);
  return executeController({
    request,
    controller: createCategory,
    middlewares: [requireSession],
    body,
  });
}
