import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "@/lib/env";

/** Routes that require a signed-in user when Supabase is configured. */
const PROTECTED_PREFIXES = ["/dashboard", "/projects", "/builder", "/notifications", "/settings"];

/** Auth pages a signed-in user should be bounced away from. */
const AUTH_PREFIXES = ["/login", "/signup", "/forgot-password"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Demo mode: no database to authenticate against, so every route is open.
  // The UI marks itself as demonstration data, and no real records exist.
  if (!isSupabaseConfigured()) {
    return withSecurityHeaders(response);
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getClaims() verifies the token's signature and refreshes an expired
  // session. With asymmetric signing keys the check runs locally against the
  // project's published keys, so this -- which runs on every request -- costs
  // no round trip to the auth server; projects still on a shared JWT secret
  // fall back to asking it, as getUser() did. getSession() alone would only
  // decode the cookie, which a client can forge.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims.sub ?? null;

  const { pathname } = request.nextUrl;

  if (!user && PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && AUTH_PREFIXES.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return withSecurityHeaders(response);
}

function withSecurityHeaders(response: NextResponse) {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  );
  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and image files. Keeping the auth check
     * off the asset path matters: it runs on every request, and a token
     * revalidation per favicon is a real latency cost.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)",
  ],
};
