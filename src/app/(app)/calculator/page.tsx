"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Calculator } from "lucide-react";
import { macrosForWeight } from "@/lib/nutrition/macros";

function value(raw: string, max: number) {
  const parsed = Number(raw.replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= max ? parsed : 0;
}

export default function CalculatorPage() {
  const [grams, setGrams] = useState("100");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [fat, setFat] = useState("");
  const [carbs, setCarbs] = useState("");
  const [showMacros, setShowMacros] = useState(false);

  const result = macrosForWeight({
    calories: value(calories, 1000),
    protein: value(protein, 100),
    fat: value(fat, 100),
    carbs: value(carbs, 100),
  }, value(grams, 5000));

  return (
    <main className="min-h-dvh bg-background px-4 pb-24 pt-6">
      <div className="flex items-center gap-3">
        <Link
          href="/day"
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-card border border-border/40 text-muted-foreground transition hover:text-foreground active:scale-95"
          aria-label="Назад в дневник"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Calculator className="h-4 w-4" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Калькулятор порции</h1>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Введите данные продукта на 100 г и вес своей порции.</p>

      <div className="mt-5 space-y-4 rounded-2xl glass-card p-4">
        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Вес порции, г
          <input
            type="number"
            inputMode="decimal"
            min="0"
            max="5000"
            value={grams}
            onChange={(event) => setGrams(event.target.value)}
            className="mt-1.5 w-full rounded-xl border border-border/50 bg-background/80 px-3.5 py-3 text-sm font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
          />
        </label>
        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Калории на 100 г
          <input
            type="number"
            inputMode="decimal"
            min="0"
            max="1000"
            value={calories}
            onChange={(event) => setCalories(event.target.value)}
            placeholder="Например, 250"
            className="mt-1.5 w-full rounded-xl border border-border/50 bg-background/80 px-3.5 py-3 text-sm font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
          />
        </label>
        <button
          onClick={() => setShowMacros((open) => !open)}
          aria-expanded={showMacros}
          className="text-xs font-semibold text-primary transition hover:underline"
        >
          {showMacros ? "Скрыть БЖУ" : "Добавить БЖУ (необязательно)"}
        </button>
        {showMacros && (
          <div className="grid grid-cols-3 gap-2 pt-1">
            {([
              ["Белки", protein, setProtein, "bg-sky-400"],
              ["Жиры", fat, setFat, "bg-amber-400"],
              ["Углеводы", carbs, setCarbs, "bg-emerald-400"],
            ] as const).map(([label, current, setCurrent, dotColor]) => (
              <label key={label} className="text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
                  {label}, г
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max="100"
                  value={current}
                  onChange={(event) => setCurrent(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-border/50 bg-background/80 px-2.5 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
              </label>
            ))}
          </div>
        )}
      </div>

      <section className="mt-4 rounded-2xl border border-primary/20 bg-primary/10 p-5 backdrop-blur-md" aria-live="polite">
        <p className="text-xs font-medium text-muted-foreground">В порции {value(grams, 5000)} г</p>
        <p className="mt-1 text-3xl font-extrabold tracking-tight text-foreground">{result.calories} <span className="text-base font-normal text-muted-foreground">ккал</span></p>
        {showMacros && (
          <div className="mt-3 flex items-center gap-3 border-t border-primary/15 pt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
              Б {result.proteinG} г
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              Ж {result.fatG} г
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              У {result.carbsG} г
            </span>
          </div>
        )}
      </section>
      <p className="mt-3 text-center text-[11px] text-muted-foreground">Калькулятор для быстрых замеров — не сохраняет запись в дневник.</p>
    </main>
  );
}
