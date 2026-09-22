export const DEFAULT_ACCENT = "#34c759";
export const ACCENT_STORAGE_KEY = "calorisnap-accent";
export const COLOR_SETTINGS_KEY = "calorisnap-colors-v1";

export const ACCENT_PRESETS = [
  { name: "Зелёный", value: "#34c759" },
  { name: "Розовый", value: "#ff2d87" },
  { name: "Синий", value: "#3478f6" },
  { name: "Фиолетовый", value: "#8b5cf6" },
  { name: "Оранжевый", value: "#ff9500" },
  { name: "Красный", value: "#ff3b30" },
  { name: "Бирюзовый", value: "#14b8a6" },
  { name: "Графит", value: "#64748b" },
] as const;

export type ColorSettings = {
  accent: string;
  calories: string;
  protein: string;
  fat: string;
  carbs: string;
  warning: string;
  danger: string;
  panels: string;
};

export const DEFAULT_COLOR_SETTINGS: ColorSettings = {
  accent: DEFAULT_ACCENT,
  calories: "#34c759",
  protein: "#5ac8fa",
  fat: "#ff9500",
  carbs: "#34c759",
  warning: "#ff9500",
  danger: "#ff3b30",
  panels: "#8e8e93",
};

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
  return tokens;
}

export function parseColorSettings(raw: string | null, legacyAccent?: string | null): ColorSettings {
  let source: Partial<ColorSettings> = {};
  try {
    source = raw ? JSON.parse(raw) as Partial<ColorSettings> : {};
  } catch { /* Invalid local settings fall back to safe defaults. */ }
  const result = { ...DEFAULT_COLOR_SETTINGS };
  for (const key of Object.keys(result) as Array<keyof ColorSettings>) {
    const normalized = normalizeHex(source[key] ?? "");
    if (normalized) result[key] = normalized;
  }
  if (!source.accent) result.accent = normalizeHex(legacyAccent ?? "") ?? result.accent;
  return result;
}

export function applyColorSettings(settings: ColorSettings, root: HTMLElement = document.documentElement) {
  applyAccentColor(settings.accent, root);
  root.style.setProperty("--calories", settings.calories);
  root.style.setProperty("--protein", settings.protein);
  root.style.setProperty("--fat", settings.fat);
  root.style.setProperty("--carbs", settings.carbs);
  root.style.setProperty("--warning", settings.warning);
  root.style.setProperty("--danger", settings.danger);
  const dark = root.classList.contains("dark");
  root.style.setProperty("--warning-soft", accentTokens(settings.warning, dark).soft);
  root.style.setProperty("--danger-soft", accentTokens(settings.danger, dark).soft);
  root.style.setProperty("--card", mix(settings.panels, dark ? "#1c1c1e" : "#ffffff", dark ? 0.78 : 0.9));
  root.style.setProperty("--muted", mix(settings.panels, dark ? "#242426" : "#f2f2f7", dark ? 0.68 : 0.82));
  root.style.setProperty("--border", mix(settings.panels, dark ? "#3a3a3c" : "#e0e0e5", 0.72));
  return settings;
}
