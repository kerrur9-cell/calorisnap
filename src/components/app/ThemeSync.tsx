"use client";
import { useEffect } from "react";
import { useProfile } from "@/hooks/useProfile";
import type { Profile } from "@/types/database";
import { ACCENT_STORAGE_KEY, DEFAULT_ACCENT, applyAccentColor, normalizeHex } from "@/lib/theme/accent";

export function ThemeSync({ initialProfile }: { initialProfile: Profile }) {
  const { data } = useProfile(initialProfile);
  const theme = data?.theme ?? "auto";
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => {
      document.documentElement.classList.toggle("dark", theme === "dark" || (theme === "auto" && media.matches));
      applyAccentColor(normalizeHex(localStorage.getItem(ACCENT_STORAGE_KEY) ?? "") ?? DEFAULT_ACCENT);
    };
    const handleAccent = (event: Event) => {
      const selected = event instanceof CustomEvent && typeof event.detail === "string"
        ? event.detail
        : localStorage.getItem(ACCENT_STORAGE_KEY) ?? DEFAULT_ACCENT;
      applyAccentColor(selected);
    };
    update();
    media.addEventListener("change", update);
    window.addEventListener("storage", handleAccent);
    window.addEventListener("calorisnap-accent-change", handleAccent);
    return () => {
      media.removeEventListener("change", update);
      window.removeEventListener("storage", handleAccent);
      window.removeEventListener("calorisnap-accent-change", handleAccent);
    };
  }, [theme]);
  return null;
}
