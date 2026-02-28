/** API_BASE is empty – all API calls are relative (same-origin). */
export const API_BASE = ""

export function apiUrl(path: string) {
  if (path.startsWith("http://") || path.startsWith("https://")) return path
  if (!path.startsWith("/")) return `/${path}`
  return path
}
