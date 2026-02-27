export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4001"

export function apiUrl(path: string) {
  if (path.startsWith("http://") || path.startsWith("https://")) return path
  if (!path.startsWith("/")) return `${API_BASE}/${path}`
  return `${API_BASE}${path}`
}
