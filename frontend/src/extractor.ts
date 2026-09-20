import { AutomateEntry, ExtractedPayload, FilterOptions } from "./types";

/**
 * Normalizes and extracts a human-readable payload string from an entry.
 */
export function extractPayloadString(entry: AutomateEntry): string {
  if (!entry) return "";

  if (typeof entry.payload === "string") return entry.payload;

  if (Array.isArray(entry.payloads) && entry.payloads.length > 0) {
    const first = entry.payloads[0];
    if (typeof first === "string") return first;
    if (first && typeof first.raw === "string") return first.raw;
    if (first && typeof first.value === "string") return first.value;
  }

  if (typeof entry.raw === "string") return entry.raw;

  return "";
}

/**
 * Filters a list of automate entries based on user preferences.
 */
export function filterEntries(entries: AutomateEntry[], options: FilterOptions): ExtractedPayload[] {
  const { statusCategory, searchQuery, deduplicate } = options;
  const searchNormalized = (searchQuery || "").toLowerCase().trim();

  const filtered = entries.filter((entry) => {
    const code = entry.response?.statusCode || entry.statusCode || (entry.response && entry.response.code) || 0;

    if (statusCategory === "200" && code !== 200) return false;
    if (statusCategory === "2xx" && (code < 200 || code >= 300)) return false;
    if (statusCategory === "3xx" && (code < 300 || code >= 400)) return false;
    if (statusCategory === "4xx" && (code < 400 || code >= 500)) return false;
    if (statusCategory === "5xx" && (code < 500 || code >= 600)) return false;

    const text = extractPayloadString(entry);
    if (searchNormalized && !text.toLowerCase().includes(searchNormalized)) return false;

    return true;
  });

  let results: ExtractedPayload[] = filtered
    .map((e) => ({
      payload: extractPayloadString(e),
      statusCode: e.response?.statusCode || e.statusCode || 200
    }))
    .filter((x) => Boolean(x.payload));

  if (deduplicate) {
    const seen = new Set<string>();
    results = results.filter((item) => {
      if (seen.has(item.payload)) return false;
      seen.add(item.payload);
      return true;
    });
  }

  return results;
}
