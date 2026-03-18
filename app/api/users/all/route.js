import { executeController } from '../../../../server/next/adapter.js';
import { requireSession } from '../../../../server/middleware/sessionMiddleware.js';
import { getAllUsers } from '../../../../server/controllers/employeeController.js';

// Middleware: allow master_admin, server_admin, or any employee
function requireEmployeeOrAdmin(req, res, next) {
  if (req.user?.role === 'master_admin') return next();
  if (req.user?.role === 'server_admin') return next();
  if (req.user?.role === 'employee') return next();
  return res.status(403).json({ error: 'Forbidden', message: 'Access denied.' });
}

export async function GET(request) {
  return executeController({
    request,
    controller: getAllUsers,
    middlewares: [requireSession, requireEmployeeOrAdmin],
  });
}
