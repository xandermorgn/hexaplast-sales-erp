/**
 * No-op stub – socket.io cannot run inside Next.js API routes.
 * All emit calls are silent no-ops until a compatible real-time
 * solution (e.g. Server-Sent Events) is implemented.
 */

export function emitSalesModuleUpdate() {}
