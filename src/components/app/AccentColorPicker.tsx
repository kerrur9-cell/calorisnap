"use client";

import { useEffect, useState } from "react";
import { Check, Palette, RotateCcw, ShieldCheck } from "lucide-react";
import { ACCENT_PRESETS, ACCENT_STORAGE_KEY, DEFAULT_ACCENT, accentTokens, applyAccentColor, normalizeHex } from "@/lib/theme/accent";

export function AccentColorPicker() {
  const [color, setColor] = useState(DEFAULT_ACCENT);

  useEffect(() => {
    const saved = normalizeHex(localStorage.getItem(ACCENT_STORAGE_KEY) ?? "") ?? DEFAULT_ACCENT;
    applyAccentColor(saved);
    const frame = requestAnimationFrame(() => setColor(saved));
    return () => cancelAnimationFrame(frame);
  }, []);

  function selectColor(next: string) {
    const normalized = normalizeHex(next);
    if (!normalized) return;
    setColor(normalized);
    localStorage.setItem(ACCENT_STORAGE_KEY, normalized);
    applyAccentColor(normalized);
    window.dispatchEvent(new CustomEvent("calorisnap-accent-change", { detail: normalized }));
  }

  return (
    <section className="glass-card glossy-sheen mb-5 rounded-3xl p-5 shadow-md" aria-labelledby="accent-heading">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-primary" />
          <div>
            <h2 id="accent-heading" className="font-bold text-foreground">Цвет приложения</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Кнопки, акценты и подсветка изменятся сразу</p>
          </div>
        </div>
        <button type="button" onClick={() => selectColor(DEFAULT_ACCENT)} className="spring-press flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-full bg-muted text-muted-foreground" aria-label="Вернуть зелёный цвет">
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2" aria-label="Готовые цвета">
        {ACCENT_PRESETS.map((preset) => {
          const active = color === preset.value;
          return (
            <button key={preset.value} type="button" onClick={() => selectColor(preset.value)} className="spring-press flex min-h-16 touch-manipulation flex-col items-center justify-center gap-1.5 rounded-2xl border bg-card/60 text-[10px] font-semibold" aria-label={`Выбрать цвет: ${preset.name}`} aria-pressed={active}>
              <span className="flex h-8 w-8 items-center justify-center rounded-full shadow-sm" style={{ backgroundColor: preset.value }}>
                {active && <Check className="h-4 w-4" style={{ color: applyTextColor(preset.value) }} />}
              </span>
              {preset.name}
            </button>
          );
        })}
      </div>

      <label className="mt-3 flex min-h-14 cursor-pointer touch-manipulation items-center justify-between gap-3 rounded-2xl border bg-card/60 px-3">
        <span>
          <span className="block text-sm font-semibold">Любой цвет</span>
          <span className="block text-xs uppercase text-muted-foreground">{color}</span>
        </span>
        <span className="relative h-10 w-16 overflow-hidden rounded-xl border shadow-inner" style={{ backgroundColor: color }}>
          <input type="color" value={color} onChange={(event) => selectColor(event.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" aria-label="Открыть палитру цветов" />
        </span>
      </label>

      <div className="mt-3 flex items-start gap-2 rounded-2xl bg-primary-soft px-3 py-2.5 text-xs text-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <span><b>Умный контраст:</b> цвет текста и мягкие оттенки автоматически подстраиваются под выбранный цвет и тёмную тему.</span>
      </div>
    </section>
  );
}

function applyTextColor(hex: string) {
  return accentTokens(hex, false).foreground;
}
