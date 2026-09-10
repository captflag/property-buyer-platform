/**
 * iCalendar (RFC 5545) generation.
 *
 * Hand-written rather than a dependency because the format is small and the
 * places libraries get it wrong are exactly the places that matter:
 *
 *   - Lines end CRLF, not LF. Outlook rejects LF-only files silently.
 *   - Lines fold at 75 *octets*, not characters. A name like "Café Müller"
 *     is more bytes than letters, and folding by character produces a line
 *     that some clients truncate mid-codepoint.
 *   - All-day events use VALUE=DATE with an *exclusive* DTEND -- a one-day
 *     event ends the following day. Getting this wrong renders every payment
 *     date as zero-length or two days long depending on the client.
 *   - UIDs are stable across exports, so re-importing updates events rather
 *     than duplicating them.
 */

export interface CalendarEvent {
  /** Stable identifier; becomes `${uid}@kestrel.app`. */
  uid: string;
  title: string;
  description?: string;
  location?: string;
  url?: string;
  /** For all-day events: `YYYY-MM-DD`. For timed events: an ISO instant. */
  start: string;
  allDay: boolean;
  /** Timed events only. */
  durationMinutes?: number;
  categories?: string[];
}

const encoder = new TextEncoder();

/** Escape TEXT values per RFC 5545 3.3.11. */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/**
 * Fold a content line to at most 75 octets per physical line. Continuation
 * lines begin with a single space, which counts towards their 75.
 */
export function foldLine(line: string): string {
  if (encoder.encode(line).length <= 75) return line;

  const out: string[] = [];
  let current = "";
  let currentBytes = 0;
  let limit = 75;

  // Iterate by code point so a multi-byte character is never split.
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    if (currentBytes + bytes > limit) {
      out.push(current);
      current = char;
      currentBytes = bytes;
      limit = 74; // leading space on continuation lines
    } else {
      current += char;
      currentBytes += bytes;
    }
  }
  out.push(current);

  return out.map((part, i) => (i === 0 ? part : ` ${part}`)).join("\r\n");
}

function formatUtc(instant: Date): string {
  return instant
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

function formatDateValue(date: string): string {
  return date.replace(/-/g, "");
}

function nextDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

export function buildIcs(
  events: readonly CalendarEvent[],
  options: { name: string; now: Date; description?: string },
): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Kestrel//Property Buyer Platform//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(options.name)}`,
  ];
  if (options.description) {
    lines.push(`X-WR-CALDESC:${escapeText(options.description)}`);
  }

  const stamp = formatUtc(options.now);

  for (const event of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${event.uid}@kestrel.app`);
    lines.push(`DTSTAMP:${stamp}`);

    if (event.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${formatDateValue(event.start)}`);
      lines.push(`DTEND;VALUE=DATE:${formatDateValue(nextDay(event.start))}`);
      // Mark all-day events free so a payment date does not block a calendar.
      lines.push("TRANSP:TRANSPARENT");
    } else {
      const start = new Date(event.start);
      const end = new Date(start.getTime() + (event.durationMinutes ?? 60) * 60_000);
      lines.push(`DTSTART:${formatUtc(start)}`);
      lines.push(`DTEND:${formatUtc(end)}`);
    }

    lines.push(`SUMMARY:${escapeText(event.title)}`);
    if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
    if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
    if (event.url) lines.push(`URL:${event.url}`);
    if (event.categories?.length) {
      lines.push(`CATEGORIES:${event.categories.map(escapeText).join(",")}`);
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
