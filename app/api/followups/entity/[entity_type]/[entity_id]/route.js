import { executeController } from '../../../../../../server/next/adapter.js';
import { requireSession } from '../../../../../../server/middleware/sessionMiddleware.js';
import { getFollowUpsForEntity } from '../../../../../../server/controllers/followUpController.js';

export async function GET(request, { params }) {
  const { entity_type, entity_id } = await params;
  return executeController({
    request,
    controller: getFollowUpsForEntity,
    middlewares: [requireSession],
    params: { entity_type, entity_id },
  });
}
