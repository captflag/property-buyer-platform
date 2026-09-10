import type { Instrumentation } from "next";

import { logError } from "@/lib/log";

/**
 * Every error Next catches while rendering, running a route handler, an
 * action or the proxy, as one structured log line.
 *
 * This is the seam an error tracker plugs into: Sentry, for one, exports its
 * own `onRequestError` to be called from here. Until one is connected, the
 * lines reach whatever collects the server's stderr.
 */
export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  logError("request_failed", error, {
    method: request.method,
    // The query string can carry cursors and ids; the route is what matters.
    path: request.path.split("?")[0],
    routePath: context.routePath,
    routeType: context.routeType,
    renderSource: context.renderSource,
  });
};
