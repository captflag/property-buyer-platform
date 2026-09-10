import { redirect } from "next/navigation";

/**
 * A bare project URL has no page of its own -- the project's overview is the
 * dashboard. Redirecting keeps `/projects/kestrel-house` a working link
 * wherever it appears (emails, notifications, shared links) instead of a 404.
 */
export default async function ProjectIndexPage({ params }: PageProps<"/projects/[slug]">) {
  await params;
  redirect("/dashboard");
}
