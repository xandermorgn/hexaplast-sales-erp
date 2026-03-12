export const STATUS_ENUMS = {
  inquiry: new Set(['open', 'converted', 'closed']),
  quotation: new Set(['draft', 'sent', 'approved', 'rejected', 'converted', 'accepted']),
  performa: new Set(['draft', 'finalized', 'converted']),
  work_order: new Set(['generated', 'approved', 'sent_to_production', 'completed', 'rejected']),
};

export const STATUS_TRANSITIONS = {
  quotation: {
    draft: new Set(['sent', 'rejected']),
    sent: new Set(['approved', 'accepted']),
    approved: new Set(['converted', 'accepted']),
    accepted: new Set(['converted']),
    rejected: new Set([]),
    converted: new Set([]),
  },
  performa: {
    draft: new Set(['finalized']),
    finalized: new Set(['converted']),
    converted: new Set([]),
  },
  work_order: {
    generated: new Set(['approved', 'rejected']),
    approved: new Set(['sent_to_production', 'rejected']),
    sent_to_production: new Set(['completed']),
    completed: new Set([]),
    rejected: new Set([]),
  },
};

export function isValidStatus(type, value) {
  const enumSet = STATUS_ENUMS[type];
  return Boolean(enumSet && enumSet.has(value));
}

export function assertValidStatus(type, value, messagePrefix = 'Invalid status') {
  if (!isValidStatus(type, value)) {
    const allowed = STATUS_ENUMS[type] ? Array.from(STATUS_ENUMS[type]).join(', ') : '';
    const error = new Error(`${messagePrefix}. Allowed: ${allowed}`);
    error.statusCode = 400;
    throw error;
  }
}

export function assertValidTransition(type, currentStatus, nextStatus) {
  if (nextStatus === undefined || nextStatus === null || nextStatus === currentStatus) {
    return;
  }

  assertValidStatus(type, nextStatus);

  const flow = STATUS_TRANSITIONS[type];
  if (!flow) return;

  const allowed = flow[currentStatus] || new Set();
  if (!allowed.has(nextStatus)) {
    const error = new Error(`Illegal status transition: ${currentStatus} -> ${nextStatus}`);
    error.statusCode = 400;
    throw error;
  }
}
