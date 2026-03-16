import { executeController, parseJsonBody } from '../../../../server/next/adapter.js';
import { requireSession, requireMasterAdminSession } from '../../../../server/middleware/sessionMiddleware.js';
import { getDocumentDefaultSettings, updateDocumentDefaultSettings } from '../../../../server/controllers/systemSettingsController.js';

export async function GET(request) {
  return executeController({
    request,
    controller: getDocumentDefaultSettings,
    middlewares: [requireSession],
  });
}

export async function PUT(request) {
  const body = await parseJsonBody(request);
  return executeController({
    request,
    controller: updateDocumentDefaultSettings,
    middlewares: [requireSession, requireMasterAdminSession],
    body,
  });
}

export async function POST(request) {
  const body = await parseJsonBody(request);
  return executeController({
    request,
    controller: updateDocumentDefaultSettings,
    middlewares: [requireSession, requireMasterAdminSession],
    body,
  });
}
