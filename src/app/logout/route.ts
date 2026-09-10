import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/**
 * Sign-out endpoint.
 *
 * A GET is enough here because there is nothing to protect: the worst a forged
 * request can do is sign the user out, and the session cookie is cleared
 * server-side either way.
 */
export async function GET() {
  const supabase = await createClient();
  if (supabase) await supabase.auth.signOut();
  redirect("/");
}
