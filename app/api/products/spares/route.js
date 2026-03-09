import { executeController } from '../../../../server/next/adapter.js';
import { requireSession } from '../../../../server/middleware/sessionMiddleware.js';
import { createProduct, getProducts } from '../../../../server/controllers/productController.js';
import { parseProductFormRequest } from '../_helpers.js';

export async function GET(request) {
  return executeController({
    request,
    controller: getProducts,
    middlewares: [requireSession],
    extra: { productType: 'spare' },
  });
}

export async function POST(request) {
  try {
    const { body, file } = await parseProductFormRequest(request, 'spare');
    return executeController({
      request,
      controller: createProduct,
      middlewares: [requireSession],
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
