import { executeController, parseJsonBody } from '../../../../../server/next/adapter.js';
import { requireSession } from '../../../../../server/middleware/sessionMiddleware.js';
import { createPerformaFromQuotation } from '../../../../../server/controllers/performaControllerStable.js';

export async function POST(request, { params }) {
  const { quotation_id } = await params;
  const body = await parseJsonBody(request);
  return executeController({
    request,
    controller: createPerformaFromQuotation,
    middlewares: [requireSession],
    params: { quotation_id },
    body,
  });
}
