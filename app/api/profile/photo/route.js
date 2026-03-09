import { executeController, parseJsonBody } from '../../../../server/next/adapter.js';
import { requireSession } from '../../../../server/middleware/sessionMiddleware.js';
import { uploadPhoto, deletePhoto, getPhoto } from '../../../../server/controllers/profilePhotoController.js';

export async function GET(request) {
  return executeController({
    request,
    controller: getPhoto,
    middlewares: [requireSession],
  });
}

export async function POST(request) {
  const body = await parseJsonBody(request);
  return executeController({
    request,
    controller: uploadPhoto,
    middlewares: [requireSession],
    body,
  });
}

export async function DELETE(request) {
  return executeController({
    request,
    controller: deletePhoto,
    middlewares: [requireSession],
  });
}
