"use client";
import { useEffect } from "react";
import { useProfile } from "@/hooks/useProfile";

export function ThemeSync() {
  const { data } = useProfile();
  const theme = data?.theme ?? "auto";
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => document.documentElement.classList.toggle("dark", theme === "dark" || (theme === "auto" && media.matches));
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [theme]);
  return null;
}
