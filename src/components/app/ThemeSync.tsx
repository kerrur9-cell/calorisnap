"use client";
import { useEffect } from "react";
import { useProfile } from "@/hooks/useProfile";
import type { Profile } from "@/types/database";
import { ACCENT_STORAGE_KEY, COLOR_SETTINGS_KEY, applyColorSettings, parseColorSettings } from "@/lib/theme/accent";

export function ThemeSync({ initialProfile }: { initialProfile: Profile }) {
  const { data } = useProfile(initialProfile);
  const theme = data?.theme ?? "auto";
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => {
      document.documentElement.classList.toggle("dark", theme === "dark" || (theme === "auto" && media.matches));
      applyColorSettings(parseColorSettings(localStorage.getItem(COLOR_SETTINGS_KEY), localStorage.getItem(ACCENT_STORAGE_KEY)));
    };
    const handleAccent = (event: Event) => {
      const selected = event instanceof CustomEvent && event.detail && typeof event.detail === "object"
        ? event.detail
        : parseColorSettings(localStorage.getItem(COLOR_SETTINGS_KEY), localStorage.getItem(ACCENT_STORAGE_KEY));
      applyColorSettings(selected);
    };
    update();
    media.addEventListener("change", update);
    window.addEventListener("storage", handleAccent);
    window.addEventListener("calorisnap-colors-change", handleAccent);
    return () => {
      media.removeEventListener("change", update);
      window.removeEventListener("storage", handleAccent);
      window.removeEventListener("calorisnap-colors-change", handleAccent);
    };
  }, [theme]);
  return null;
}
