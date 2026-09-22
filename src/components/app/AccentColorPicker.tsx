"use client";

import { useEffect, useState } from "react";
import { Check, Gauge, Palette, RotateCcw, ShieldCheck } from "lucide-react";
import {
  ACCENT_PRESETS,
  ACCENT_STORAGE_KEY,
  COLOR_SETTINGS_KEY,
  DEFAULT_COLOR_SETTINGS,
  accentTokens,
  applyColorSettings,
  normalizeHex,
  parseColorSettings,
  type ColorSettings,
} from "@/lib/theme/accent";

export function AccentColorPicker() {
  const [colors, setColors] = useState<ColorSettings>(DEFAULT_COLOR_SETTINGS);

  useEffect(() => {
    const saved = parseColorSettings(localStorage.getItem(COLOR_SETTINGS_KEY), localStorage.getItem(ACCENT_STORAGE_KEY));
    applyColorSettings(saved);
    const frame = requestAnimationFrame(() => setColors(saved));
    return () => cancelAnimationFrame(frame);
  }, []);

  function save(next: ColorSettings) {
    setColors(next);
    localStorage.setItem(COLOR_SETTINGS_KEY, JSON.stringify(next));
    localStorage.setItem(ACCENT_STORAGE_KEY, next.accent);
    applyColorSettings(next);
    window.dispatchEvent(new CustomEvent("calorisnap-colors-change", { detail: next }));
  }

  function change(key: keyof ColorSettings, value: string) {
    const normalized = normalizeHex(value);
    if (normalized) save({ ...colors, [key]: normalized });
  }

  return (
    <section className="glass-card glossy-sheen mb-5 rounded-3xl p-5 shadow-md" aria-labelledby="accent-heading">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-primary" />
          <div>
            <h2 id="accent-heading" className="font-bold text-foreground">Цвета приложения</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Настройте каждый элемент отдельно</p>
          </div>
        </div>
        <button type="button" onClick={() => save(DEFAULT_COLOR_SETTINGS)} className="spring-press flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-full bg-muted text-muted-foreground" aria-label="Вернуть стандартные цвета">
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

      <p className="mb-2 text-xs font-semibold text-muted-foreground">Основной цвет</p>
      <div className="grid grid-cols-4 gap-2" aria-label="Готовые основные цвета">
        {ACCENT_PRESETS.map((preset) => {
          const active = colors.accent === preset.value;
          return (
            <button key={preset.value} type="button" onClick={() => change("accent", preset.value)} className="spring-press flex min-h-16 touch-manipulation flex-col items-center justify-center gap-1.5 rounded-2xl border bg-card/60 text-[10px] font-semibold" aria-label={`Выбрать основной цвет: ${preset.name}`} aria-pressed={active}>
              <span className="flex h-8 w-8 items-center justify-center rounded-full shadow-sm" style={{ backgroundColor: preset.value }}>
                {active && <Check className="h-4 w-4" style={{ color: accentTokens(preset.value, false).foreground }} />}
              </span>
              {preset.name}
            </button>
          );
        })}
      </div>

      <ColorControl label="Свой основной цвет" value={colors.accent} onChange={(value) => change("accent", value)} wide />

      <div className="mt-5 mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <Gauge className="h-4 w-4" /> Прогресс и КБЖУ
      </div>
      <div className="grid grid-cols-2 gap-2">
        <ColorControl label="Калории" value={colors.calories} onChange={(value) => change("calories", value)} />
        <ColorControl label="Белки" value={colors.protein} onChange={(value) => change("protein", value)} />
        <ColorControl label="Жиры" value={colors.fat} onChange={(value) => change("fat", value)} />
        <ColorControl label="Углеводы" value={colors.carbs} onChange={(value) => change("carbs", value)} />
      </div>

      <p className="mt-5 mb-2 text-xs font-semibold text-muted-foreground">Обозначение лимита</p>
      <div className="grid grid-cols-2 gap-2">
        <ColorControl label="Почти лимит" value={colors.warning} onChange={(value) => change("warning", value)} />
        <ColorControl label="Перебор" value={colors.danger} onChange={(value) => change("danger", value)} />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px] font-semibold">
        <StatusPreview label="В норме" color={colors.calories} />
        <StatusPreview label="Почти лимит" color={colors.warning} />
        <StatusPreview label="Перебор" color={colors.danger} />
      </div>

      <p className="mt-5 mb-2 text-xs font-semibold text-muted-foreground">Карточки и серые панели</p>
      <ColorControl label="Тонировка панелей" value={colors.panels} onChange={(value) => change("panels", value)} wide />

      <div className="mt-3 flex items-start gap-2 rounded-2xl bg-primary-soft px-3 py-2.5 text-xs text-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <span><b>Умный контраст:</b> подписи, карточки и мягкие фоны автоматически остаются читаемыми в светлой и тёмной теме.</span>
      </div>
    </section>
  );
}

function ColorControl({ label, value, onChange, wide = false }: { label: string; value: string; onChange: (value: string) => void; wide?: boolean }) {
  return (
    <label className={`flex min-h-14 cursor-pointer touch-manipulation items-center justify-between gap-2 rounded-2xl border bg-card/60 px-3 ${wide ? "mt-3" : ""}`}>
      <span className="min-w-0">
        <span className="block truncate text-xs font-semibold">{label}</span>
        <span className="block text-[10px] uppercase text-muted-foreground">{value}</span>
      </span>
      <span className="relative h-9 w-11 shrink-0 overflow-hidden rounded-xl border shadow-inner" style={{ backgroundColor: value }}>
        <input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" aria-label={`Выбрать цвет: ${label}`} />
      </span>
    </label>
  );
}

function StatusPreview({ label, color }: { label: string; color: string }) {
  return <div className="rounded-xl px-1.5 py-2" style={{ backgroundColor: color, color: accentTokens(color, false).foreground }}>{label}</div>;
}
