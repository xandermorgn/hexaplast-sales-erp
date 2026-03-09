import { executeController, parseJsonBody } from '../../../../../../server/next/adapter.js';
import { requireSession } from '../../../../../../server/middleware/sessionMiddleware.js';
import { addBomMaterial } from '../../../../../../server/controllers/bomController.js';

export async function POST(request, { params }) {
  const { id } = await params;
  const body = await parseJsonBody(request);
  return executeController({
    request,
    controller: addBomMaterial,
    middlewares: [requireSession],
    params: { id },
    body,
  });
}
