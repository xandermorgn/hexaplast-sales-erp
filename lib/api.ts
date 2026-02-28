/** API_BASE is empty – all API calls are relative (same-origin). */
export const API_BASE = ""

export function apiUrl(path: string) {
  if (!path) return "/"

  // Enforce same-origin requests from frontend code.
  // If an absolute URL is passed accidentally, drop the origin.
  if (path.startsWith("http://") || path.startsWith("https://")) {
    try {
      const parsed = new URL(path)
      return `${parsed.pathname}${parsed.search}${parsed.hash}` || "/"
    } catch {
      return "/"
    }
  }

  if (!path.startsWith("/")) return `/${path}`
  return path
}
