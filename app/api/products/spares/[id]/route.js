import { executeController } from '../../../../../server/next/adapter.js';
import { requireSession } from '../../../../../server/middleware/sessionMiddleware.js';
import { updateProduct, deleteProduct } from '../../../../../server/controllers/productController.js';
import { parseProductFormRequest } from '../../_helpers.js';

export async function PUT(request, { params }) {
  const { id } = await params;
  try {
    const { body, file } = await parseProductFormRequest(request, 'spare');
    return executeController({
      request,
      controller: updateProduct,
      middlewares: [requireSession],
      params: { id },
      body,
      extra: { productType: 'spare', file },
    });
  } catch (error) {
    const status = Number.isInteger(error?.statusCode) ? error.statusCode : 400;
    return Response.json(
      {
        error: 'Upload failed',
        message: error?.message || 'Failed to parse product form data',
      },
      { status },
    );
  }
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
