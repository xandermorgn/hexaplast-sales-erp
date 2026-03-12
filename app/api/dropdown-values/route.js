import { executeController, parseJsonBody } from '../../../server/next/adapter.js';
import { requireSession } from '../../../server/middleware/sessionMiddleware.js';
import { listDropdownValues, createDropdownValue } from '../../../server/controllers/dropdownController.js';

export async function GET(request) {
  return executeController({
    request,
    controller: listDropdownValues,
    middlewares: [requireSession],
  });
}

export async function POST(request) {
  const body = await parseJsonBody(request);
  return executeController({
    request,
    controller: createDropdownValue,
    middlewares: [requireSession],
    body,
  });
}
