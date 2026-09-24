import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const authError = searchParams.get("error_description") || searchParams.get("error");

  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL("/day", request.url));
      const redirectUrl = new URL("/login", request.url);
      redirectUrl.searchParams.set("error", "callback_exchange_failed");
      redirectUrl.searchParams.set("error_description", error.message);
      return NextResponse.redirect(redirectUrl);
    } catch (err) {
      const redirectUrl = new URL("/login", request.url);
      redirectUrl.searchParams.set("error", "callback_exception");
      redirectUrl.searchParams.set("error_description", err instanceof Error ? err.message : "Ошибка сессии");
      return NextResponse.redirect(redirectUrl);
    }
  }

  const redirectUrl = new URL("/login", request.url);
  redirectUrl.searchParams.set("error", "oauth_failed");
  if (authError) {
    redirectUrl.searchParams.set("error_description", authError);
  }
  return NextResponse.redirect(redirectUrl);
}
