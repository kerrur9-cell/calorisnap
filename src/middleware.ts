import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const PUBLIC_PATHS = ["/login", "/auth", "/privacy"];

// Netlify deploys this legacy convention as an Edge-compatible request guard.
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!isSupabaseConfigured()) {
    if (pathname === "/setup") return NextResponse.next();
    return NextResponse.redirect(new URL("/setup", request.url));
  }
  if (pathname === "/privacy") return NextResponse.next();
  const { response, user } = await updateSession(request);
  const isPublic = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  if (!user && !isPublic) {
    const url = request.nextUrl.clone(); url.pathname = "/login";
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }
  if (user && pathname === "/login") {
    const url = request.nextUrl.clone(); url.pathname = "/day";
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline.html|icons/|api/).*)"],
};
