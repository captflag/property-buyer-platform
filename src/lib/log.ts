/**
 * Structured logging.
 *
 * One JSON object per line. Every log drain -- Vercel, Docker, Datadog, Loki,
 * CloudWatch -- parses that without configuration, and a line can be found by
 * its `event` rather than by grepping prose. No request bodies or headers are
 * logged: callers pass the fields they choose, and nothing else.
 *
 * Runs in both the Node and edge runtimes (it only uses `console`), so the
 * instrumentation hook can use it for errors from the proxy as well.
 */

type Fields = Record<string, unknown>;

function serialiseError(error: unknown): Fields {
  if (error instanceof Error) {
    // Spreading first keeps enumerable extras such as a Postgrest error's
    // `code`, `details` and `hint`, and Next's `digest`.
    return {
      ...(error as unknown as Fields),
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  if (error && typeof error === "object") return { ...(error as Fields) };
  return { message: String(error) };
}

export function logEvent(event: string, fields: Fields = {}): void {
  console.log(JSON.stringify({ level: "info", event, at: new Date().toISOString(), ...fields }));
}

export function logError(event: string, error: unknown, fields: Fields = {}): void {
  console.error(
    JSON.stringify({
      level: "error",
      event,
      at: new Date().toISOString(),
      ...fields,
      error: serialiseError(error),
    }),
  );
}
