import { executeController } from '../../../../server/next/adapter.js';
import { requireSession } from '../../../../server/middleware/sessionMiddleware.js';
import { query } from '../../../../server/config/database.js';

function getAssignableUsers(req, res) {
  try {
    const users = query(
      `SELECT u.id, u.name, u.role,
              COALESCE(e.designation, '') AS designation
       FROM users u
       LEFT JOIN employees e ON e.user_id = u.id
       WHERE u.role IN ('master_admin', 'employee')
       ORDER BY u.name ASC`,
      [],
    );

    return res.status(200).json({
      count: users.length,
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        role: u.role,
        designation: u.designation || '',
        label: u.name,
      })),
    });
  } catch (error) {
    console.error('getAssignableUsers error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to fetch assignable users' });
  }
}

export async function GET(request) {
  return executeController({
    request,
    controller: getAssignableUsers,
    middlewares: [requireSession],
  });
}
