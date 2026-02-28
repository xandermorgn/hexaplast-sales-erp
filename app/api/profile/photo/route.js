import { executeController } from '../../../../server/next/adapter.js';
import { requireSession } from '../../../../server/middleware/sessionMiddleware.js';
import { uploadPhoto, deletePhoto } from '../../../../server/controllers/profilePhotoController.js';

export async function POST(request) {
  return executeController({
    request,
    controller: uploadPhoto,
    middlewares: [requireSession],
  });
}

export async function DELETE(request) {
  return executeController({
    request,
    controller: deletePhoto,
    middlewares: [requireSession],
  });
}
