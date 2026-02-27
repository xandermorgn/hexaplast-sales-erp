import { emitSalesUpdate as emitRealtimeSalesUpdate } from '../realtime/socket.js';

const ALLOWED_MODULES = new Set(['quotation', 'performa', 'work_order', 'inquiry']);
const ALLOWED_ACTIONS = new Set(['create', 'update', 'delete', 'convert', 'approve', 'reject']);

export function emitSalesModuleUpdate({ module, action, id }) {
  if (!ALLOWED_MODULES.has(module)) {
    throw new Error(`Invalid sales module: ${module}`);
  }

  if (!ALLOWED_ACTIONS.has(action)) {
    throw new Error(`Invalid sales action: ${action}`);
  }

  emitRealtimeSalesUpdate({
    module,
    action,
    id,
  });
}
