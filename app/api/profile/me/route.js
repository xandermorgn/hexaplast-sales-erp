import { executeController, parseJsonBody } from '../../../../server/next/adapter.js';
import { requireSession } from '../../../../server/middleware/sessionMiddleware.js';
import { getMyProfile, updateMyProfile } from '../../../../server/controllers/profileController.js';

export async function GET(request) {
  return executeController({
    request,
    controller: getMyProfile,
    middlewares: [requireSession],
  });
}

export async function PUT(request) {
  const body = await parseJsonBody(request);
  return executeController({
    request,
    controller: updateMyProfile,
    middlewares: [requireSession],
    body,
  });
}
