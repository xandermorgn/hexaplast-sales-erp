import { executeController, parseJsonBody } from '../../../../../server/next/adapter.js';
import { requireSession } from '../../../../../server/middleware/sessionMiddleware.js';
import { updateProduct, deleteProduct, uploadProductImage } from '../../../../../server/controllers/productController.js';

export async function PUT(request, { params }) {
  const { id } = await params;
  return executeController({
    request,
    controller: updateProduct,
    middlewares: [requireSession, uploadProductImage],
    params: { id },
    extra: { productType: 'spare' },
  });
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  return executeController({
    request,
    controller: deleteProduct,
    middlewares: [requireSession],
    params: { id },
    extra: { productType: 'spare' },
  });
}
