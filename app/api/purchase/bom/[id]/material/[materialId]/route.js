import { executeController, parseJsonBody } from '../../../../../../../server/next/adapter.js';
import { requireSession } from '../../../../../../../server/middleware/sessionMiddleware.js';
import { updateBomMaterial } from '../../../../../../../server/controllers/bomController.js';

export async function PUT(request, { params }) {
  const { id, materialId } = await params;
  const body = await parseJsonBody(request);
  return executeController({
    request,
    controller: updateBomMaterial,
    middlewares: [requireSession],
    params: { id, materialId },
    body,
  });
}
