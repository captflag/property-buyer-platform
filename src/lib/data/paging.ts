/**
 * Keyset paging, shared by the Supabase and demo implementations of the feeds.
 *
 * A page ends at its last row's (timestamp, id); the next page is every row
 * strictly older than that pair. Unlike an offset, that costs the same on page
 * forty as on page one, and a row inserted while someone is scrolling cannot
 * push another row onto two pages. The id breaks ties, so two rows with the
 * same instant can never straddle a page boundary and be skipped.
 *
 * Pure and dependency-free, so it is tested directly.
 */

export interface Window {
  /** Rows per page. */
  limit: number;
  /** Cursor from the previous page's `nextCursor`. */
  before?: string | null;
  /** Only rows strictly after this instant. */
  since?: string | null;
}

export interface Cursor {
  at: string;
  id: string;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID.test(value);
}

// Cursor contents are ASCII (a timestamp and a uuid), so btoa is safe here.
function toBase64Url(text: string): string {
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): string {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  return atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
}

export function encodeCursor(at: string, id: string): string {
  return toBase64Url(JSON.stringify([at, id]));
}

/**
 * Cursors come back from the browser, and their parts are interpolated into
 * a PostgREST filter. Anything that is not exactly a timestamp and a uuid is
 * treated as "no cursor" rather than passed on.
 */
export function decodeCursor(cursor: string | null | undefined): Cursor | null {
  if (!cursor || cursor.length > 200) return null;
  try {
    const parsed: unknown = JSON.parse(fromBase64Url(cursor));
    if (!Array.isArray(parsed) || parsed.length !== 2) return null;
    const [at, id] = parsed as [unknown, unknown];
    if (typeof at !== "string" || typeof id !== "string") return null;
    if (!ISO_INSTANT.test(at) || !UUID.test(id)) return null;
    return { at, id };
  } catch {
    return null;
  }
}

/** Whether a string from the browser is a cursor this module issued. */
export function isCursor(value: string): boolean {
  return decodeCursor(value) !== null;
}

/** A PostgREST `or` filter for rows strictly older than the cursor. */
export function keysetFilter(column: string, cursor: Cursor): string {
  return `${column}.lt."${cursor.at}",and(${column}.eq."${cursor.at}",id.lt.${cursor.id})`;
}

/**
 * Trim the look-ahead row -- every query asks for one more than a page -- and
 * turn the last row kept into the next cursor.
 */
export function pageOf<T extends { id: string }>(
  rows: T[],
  at: (row: T) => string,
  limit: number,
): Page<T> {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  return { items, nextCursor: hasMore && last ? encodeCursor(at(last), last.id) : null };
}

/** The same window over an in-memory list, ordered as the database orders it. */
export function demoWindow<T extends { id: string }>(
  rows: readonly T[],
  at: (row: T) => string,
  window: Window,
): Page<T> {
  const cursor = decodeCursor(window.before);
  const ordered = [...rows]
    .sort((a, b) => at(b).localeCompare(at(a)) || b.id.localeCompare(a.id))
    .filter((row) => !window.since || at(row) > window.since)
    .filter(
      (row) => !cursor || at(row) < cursor.at || (at(row) === cursor.at && row.id < cursor.id),
    );
  return pageOf(ordered.slice(0, window.limit + 1), at, window.limit);
}
