import { Server } from 'socket.io';

let io = null;

export function initSocket(httpServer, { corsOrigin } = {}) {
  if (io) return io;

  io = new Server(httpServer, {
    cors: {
      origin: corsOrigin || true,
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    console.log(`[socket.io] client connected: ${socket.id}`);

    socket.on('disconnect', (reason) => {
      console.log(`[socket.io] client disconnected: ${socket.id} (${reason})`);
    });
  });

  return io;
}

export function emitGanttUpdate() {
  if (!io) return;
  io.emit('gantt:update', { updatedAt: new Date().toISOString() });
}

export function emitWorkOrderUpdate() {
  if (!io) return;
  io.emit('workorder:update', { updatedAt: new Date().toISOString() });
}

export function emitNotification(notification) {
  if (!io) return;
  io.emit('notification:new', notification);
}

export function emitSalesUpdate(payload = {}) {
  if (!io) return;
  io.emit('sales:update', {
    updatedAt: new Date().toISOString(),
    ...payload,
  });
}
