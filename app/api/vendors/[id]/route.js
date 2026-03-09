import { executeController, parseJsonBody } from '../../../../server/next/adapter.js';
import { requireSession } from '../../../../server/middleware/sessionMiddleware.js';
import { getVendorById, updateVendor, deleteVendor } from '../../../../server/controllers/vendorController.js';

export async function GET(request, { params }) {
  const { id } = await params;
  return executeController({
    request,
    controller: getVendorById,
    middlewares: [requireSession],
    params: { id },
  });
}

export async function PUT(request, { params }) {
  const { id } = await params;
  const body = await parseJsonBody(request);
  return executeController({
    request,
    controller: updateVendor,
    middlewares: [requireSession],
    params: { id },
    body,
  });
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  return executeController({
    request,
    controller: deleteVendor,
    middlewares: [requireSession],
    params: { id },
  });
}
