import { executeController } from '../../../../server/next/adapter.js';
import { logout } from '../../../../server/controllers/authController.js';

export async function POST(request) {
  return executeController({ request, controller: logout });
}
