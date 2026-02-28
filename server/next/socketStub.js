/**
 * No-op socket emitter stub for Next.js migration.
 * Socket.io requires a persistent HTTP server and cannot run inside
 * Next.js API routes.  All emit calls become silent no-ops.
 */

export function emitSalesModuleUpdate() {}
export function emitGanttUpdate() {}
export function emitWorkOrderUpdate() {}
export function emitNotification() {}
export function emitSalesUpdate() {}
