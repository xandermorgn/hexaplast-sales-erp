/**
 * Socket.io has been removed in the unified Next.js migration.
 * This stub prevents import errors from any remaining references.
 * Real-time updates will be implemented via polling or SSE in a future iteration.
 */

type NoopSocket = {
  on: (...args: unknown[]) => NoopSocket
  off: (...args: unknown[]) => NoopSocket
  emit: (...args: unknown[]) => NoopSocket
  connect: () => NoopSocket
  disconnect: () => NoopSocket
}

const noop: NoopSocket = {
  on: () => noop,
  off: () => noop,
  emit: () => noop,
  connect: () => noop,
  disconnect: () => noop,
}

export function getSocket(): NoopSocket {
  return noop
}
