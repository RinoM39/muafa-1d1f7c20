import { redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

/**
 * Auth guard for `beforeLoad`. Skips on the server (no localStorage there
 * means the session can't be read, which would falsely log users out on
 * the first SSR render — particularly visible on desktop where a hard
 * navigation hits SSR, while mobile typically client-navigates).
 *
 * Uses getSession() (reads from storage, no network round-trip) instead of
 * getUser() to avoid racing the auth restore right after sign-in/sign-up.
 */
export async function requireAuth(redirectPath: string) {
  if (typeof window === "undefined") return null;
  const { data } = await supabase.auth.getSession();
  if (!data.session?.user) {
    throw redirect({ to: "/login", search: { redirect: redirectPath } });
  }
  return data.session.user;
}

export async function requireAdmin(redirectPath: string) {
  const user = await requireAuth(redirectPath);
  if (!user) return;
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  if (!roles?.some((r) => r.role === "admin")) {
    throw redirect({ to: "/" });
  }
}
