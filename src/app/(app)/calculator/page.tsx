"use client";

import { useState } from "react";
import Link from "next/link";
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
    <main className="min-h-dvh bg-background px-4 pb-24 pt-8">
      <Link href="/day" className="text-sm text-muted-foreground">← Назад</Link>
      <h1 className="mt-5 text-2xl font-bold">Калькулятор порции</h1>
      <p className="mt-2 text-sm text-muted-foreground">Введите данные продукта на 100 г и вес своей порции.</p>

      <div className="mt-6 space-y-4 rounded-2xl bg-card p-4 shadow-sm">
        <label className="block text-sm font-medium">Вес порции, г
          <input type="number" inputMode="decimal" min="0" max="5000" value={grams} onChange={(event) => setGrams(event.target.value)} className="mt-1 w-full rounded-xl border bg-background px-3 py-3 outline-none focus:border-primary" />
        </label>
        <label className="block text-sm font-medium">Калории на 100 г
          <input type="number" inputMode="decimal" min="0" max="1000" value={calories} onChange={(event) => setCalories(event.target.value)} placeholder="Например, 250" className="mt-1 w-full rounded-xl border bg-background px-3 py-3 outline-none focus:border-primary" />
        </label>
        <button onClick={() => setShowMacros((open) => !open)} aria-expanded={showMacros} className="text-sm font-medium text-primary">{showMacros ? "Скрыть БЖУ" : "Добавить БЖУ (необязательно)"}</button>
        {showMacros && <div className="grid grid-cols-3 gap-2">
          {([
            ["Белки", protein, setProtein],
            ["Жиры", fat, setFat],
            ["Углеводы", carbs, setCarbs],
          ] as const).map(([label, current, setCurrent]) => (
            <label key={label} className="text-xs text-muted-foreground">{label}, г/100 г
              <input type="number" inputMode="decimal" min="0" max="100" value={current} onChange={(event) => setCurrent(event.target.value)} className="mt-1 w-full rounded-lg border bg-background px-2 py-2 text-foreground outline-none focus:border-primary" />
            </label>
          ))}
        </div>}
      </div>

      <section className="mt-4 rounded-2xl bg-primary-soft p-5" aria-live="polite">
        <p className="text-sm">В порции {value(grams, 5000)} г</p>
        <p className="mt-1 text-3xl font-bold">{result.calories} ккал</p>
        {showMacros && <p className="mt-2 text-sm">Б {result.proteinG} г · Ж {result.fatG} г · У {result.carbsG} г</p>}
      </section>
      <p className="mt-3 text-xs text-muted-foreground">Калькулятор ничего не сохраняет в дневник.</p>
    </main>
  );
}
