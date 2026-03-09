import { executeController } from '../../../../server/next/adapter.js';
import { requireSession } from '../../../../server/middleware/sessionMiddleware.js';
import { createProduct, getProducts } from '../../../../server/controllers/productController.js';
import { parseProductFormRequest } from '../_helpers.js';

export async function GET(request) {
  return executeController({
    request,
    controller: getProducts,
    middlewares: [requireSession],
    extra: { productType: 'machine' },
  });
}

export async function POST(request) {
  try {
    const { body, file } = await parseProductFormRequest(request, 'machine');
    return executeController({
      request,
      controller: createProduct,
      middlewares: [requireSession],
      body,
      extra: { productType: 'machine', file },
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
