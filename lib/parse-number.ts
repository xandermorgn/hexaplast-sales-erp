/**
 * Parse a numeric string that may contain commas.
 * e.g. "12,123" -> 12123, "123,456.78" -> 123456.78
 * Returns 0 if parsing fails.
 */
export function parseNum(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0
  const cleaned = String(value).replace(/,/g, "")
  const parsed = Number(cleaned)
  return Number.isNaN(parsed) ? 0 : parsed
}
