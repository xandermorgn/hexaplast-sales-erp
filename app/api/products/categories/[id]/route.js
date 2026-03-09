import { executeController, parseJsonBody } from '../../../../../server/next/adapter.js';
import { requireSession } from '../../../../../server/middleware/sessionMiddleware.js';
import { updateCategory, deleteCategory } from '../../../../../server/controllers/productController.js';

export async function PUT(request, { params }) {
  const { id } = await params;
  const body = await parseJsonBody(request);
  return executeController({
    request,
    controller: updateCategory,
    middlewares: [requireSession],
    params: { id },
    body,
  });
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  return executeController({
    request,
    controller: deleteCategory,
    middlewares: [requireSession],
    params: { id },
  });
}
