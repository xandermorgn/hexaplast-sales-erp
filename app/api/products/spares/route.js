import { executeController, parseJsonBody } from '../../../../server/next/adapter.js';
import { requireSession } from '../../../../server/middleware/sessionMiddleware.js';
import { createProduct, getProducts, uploadProductImage } from '../../../../server/controllers/productController.js';

export async function GET(request) {
  return executeController({
    request,
    controller: getProducts,
    middlewares: [requireSession],
    extra: { productType: 'spare' },
  });
}

export async function POST(request) {
  return executeController({
    request,
    controller: createProduct,
    middlewares: [requireSession, uploadProductImage],
    extra: { productType: 'spare' },
  });
}
