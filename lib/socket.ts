import { io, type Socket } from "socket.io-client"
import { API_BASE } from "@/lib/api"

let socket: Socket | null = null

export function getSocket(): Socket {
  if (socket) return socket

  socket = io(API_BASE, {
    transports: ["websocket"],
    reconnection: true,
    autoConnect: true,
  })

  return socket
}
