import { executeController, parseJsonBody } from '../../../../server/next/adapter.js';
import { login } from '../../../../server/controllers/authController.js';

export async function POST(request) {
  const body = await parseJsonBody(request);
  return executeController({ request, controller: login, body });
}
