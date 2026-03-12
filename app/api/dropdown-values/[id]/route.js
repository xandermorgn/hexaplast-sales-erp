import { executeController } from '../../../../server/next/adapter.js';
import { requireSession } from '../../../../server/middleware/sessionMiddleware.js';
import { deleteDropdownValue } from '../../../../server/controllers/dropdownController.js';

export async function DELETE(request, { params }) {
  const { id } = await params;
  return executeController({
    request,
    controller: deleteDropdownValue,
    middlewares: [requireSession],
    params: { id },
  });
}
