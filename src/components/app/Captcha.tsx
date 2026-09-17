"use client";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: { sitekey: string; callback: (token: string) => void; "expired-callback": () => void; "error-callback": () => void }) => string;
      remove: (id: string) => void;
    };
  }
}
export function Captcha({ onToken }: { onToken: (token: string) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  useEffect(() => {
    if (!ready || !container.current || !window.turnstile || !sitekey) return;
    const id = window.turnstile.render(container.current, { sitekey, callback: onToken,
      "expired-callback": () => onToken(""), "error-callback": () => onToken("") });
    return () => window.turnstile?.remove(id);
  }, [ready, onToken, sitekey]);
  if (!sitekey) return null;
  return <><Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" onReady={() => setReady(true)} /><div ref={container} /></>;
}
