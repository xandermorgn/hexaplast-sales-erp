import { executeController } from '../../../../server/next/adapter.js';
import { getCurrentUser } from '../../../../server/controllers/authController.js';

export async function GET(request) {
  return executeController({ request, controller: getCurrentUser });
}
