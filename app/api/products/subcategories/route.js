import { executeController, parseJsonBody } from '../../../../server/next/adapter.js';
import { requireSession } from '../../../../server/middleware/sessionMiddleware.js';
import { listSubcategories, createSubcategory } from '../../../../server/controllers/subcategoryController.js';

export async function GET(request) {
  return executeController({
    request,
    controller: listSubcategories,
    middlewares: [requireSession],
  });
}

export async function POST(request) {
  const body = await parseJsonBody(request);
  return executeController({
    request,
    controller: createSubcategory,
    middlewares: [requireSession],
    body,
  });
}
