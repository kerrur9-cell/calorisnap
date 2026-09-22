export const DEFAULT_ACCENT = "#34c759";
export const ACCENT_STORAGE_KEY = "calorisnap-accent";

export const ACCENT_PRESETS = [
  { name: "Зелёный", value: "#34c759" },
  { name: "Розовый", value: "#ff2d87" },
  { name: "Синий", value: "#3478f6" },
  { name: "Фиолетовый", value: "#8b5cf6" },
] as const;

type Rgb = { r: number; g: number; b: number };

export function normalizeHex(value: string): string | null {
  const match = value.trim().match(/^#?([\da-f]{6})$/i);
  return match ? `#${match[1].toLowerCase()}` : null;
}

function hexToRgb(hex: string): Rgb {
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
  };
}

function toHex(value: number) {
  return Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, "0");
}

function mix(first: string, second: string, secondWeight: number) {
  const a = hexToRgb(first);
  const b = hexToRgb(second);
  const channel = (left: number, right: number) => left * (1 - secondWeight) + right * secondWeight;
  return `#${toHex(channel(a.r, b.r))}${toHex(channel(a.g, b.g))}${toHex(channel(a.b, b.b))}`;
}

function luminance(hex: string) {
  const rgb = hexToRgb(hex);
  const linear = [rgb.r, rgb.g, rgb.b].map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

export function contrastRatio(first: string, second: string) {
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export function accentTokens(value: string, dark: boolean) {
  const primary = normalizeHex(value) ?? DEFAULT_ACCENT;
  const whiteContrast = contrastRatio(primary, "#ffffff");
  const darkContrast = contrastRatio(primary, "#111111");
  return {
    primary,
    foreground: whiteContrast >= darkContrast ? "#ffffff" : "#111111",
    soft: mix(primary, dark ? "#1c1c1e" : "#ffffff", dark ? 0.72 : 0.84),
  };
}

export function applyAccentColor(value: string, root: HTMLElement = document.documentElement) {
  const tokens = accentTokens(value, root.classList.contains("dark"));
  root.style.setProperty("--primary", tokens.primary);
  root.style.setProperty("--primary-foreground", tokens.foreground);
  root.style.setProperty("--primary-soft", tokens.soft);
  root.style.setProperty("--carbs", tokens.primary);
  return tokens;
}
