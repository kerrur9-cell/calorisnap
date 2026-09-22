import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const PUBLIC_PATHS = ["/login", "/auth", "/privacy"];

// Netlify deploys edge middleware natively. In Next 16 `proxy.ts` is always
// Node.js runtime, while the legacy `middleware.ts` convention remains the
// supported way to emit an Edge-compatible request guard.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Пока Supabase не настроен — показываем экран с инструкцией (/setup).
  if (!isSupabaseConfigured()) {
    if (pathname === "/setup") return NextResponse.next();
    return NextResponse.redirect(new URL("/setup", request.url));
  }

  // Public legal page needs neither a session refresh nor a network auth call.
  if (pathname === "/privacy") return NextResponse.next();

  const { response, user } = await updateSession(request);

  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/day";
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Все пути, кроме:
     *  - _next/static, _next/image — ассеты
     *  - favicon, manifest, sw, иконки — статика
     *  - api/ai — защищён отдельно внутри route handler
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline.html|icons/|api/).*)",
  ],
};
