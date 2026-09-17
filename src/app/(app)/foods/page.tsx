"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Plus, Check, Loader2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { macrosForWeight } from "@/lib/nutrition/macros";
import { todayKey } from "@/lib/utils";
import { dayQueryKey, MEAL_TYPES } from "@/hooks/useDayLog";
import { useQueryClient } from "@tanstack/react-query";
import type { MealType } from "@/types/database";
import { saveMeal } from "@/lib/meals";
import { resolveMealType, nutritionSchema, weightSchema, foodNameSchema } from "@/lib/validation";

export default function FoodsPage() {
  return (
    <Suspense
      fallback={<div className="min-h-dvh bg-background pb-24" />}
    >
      <FoodsFlow />
    </Suspense>
  );
}

interface SearchResult {
  id: string;
  name: string;
  name_local: string | null;
  calories_per_100g: number;
  protein_per_100g: number;
  fat_per_100g: number;
  carbs_per_100g: number;
}

/** SearchResult → Per100 (единый формат для расчёта) */
function toPer100(food: SearchResult) {
  return {
    calories: food.calories_per_100g,
    protein: food.protein_per_100g,
    fat: food.fat_per_100g,
    carbs: food.carbs_per_100g,
  };
}

function FoodsFlow() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [mealType, setMealType] = useState<MealType>(
    resolveMealType(searchParams.get("meal")),
  );

  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [weight, setWeight] = useState("100");
  const [adding, setAdding] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingMeal = useRef<string | null>(null);
  const addLock = useRef(false);

  // Создание своего продукта
  const [showCustom, setShowCustom] = useState(false);
  const [custom, setCustom] = useState({
    name: "",
    calories: "",
    protein: "",
    fat: "",
    carbs: "",
  });

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/foods/search?q=${encodeURIComponent(q.trim())}`, { signal: controller.signal });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Не удалось найти продукты");
        setResults(json.items ?? []);
        setError(null);
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Ошибка поиска");
      }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [q]);

  async function addItem(food: SearchResult) {
    if (addLock.current) return;
    const grams = Number(weight.replace(",", "."));
    if (!weightSchema.safeParse(grams).success) { setError("Укажите вес от 0 до 5000 г"); return; }
    addLock.current = true;
    setAdding(true);
    setError(null);
    try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Войдите в аккаунт заново");
    const nutrition = macrosForWeight(toPer100(food), grams);

    const dateKey = todayKey();

    pendingMeal.current ??= crypto.randomUUID();
    await saveMeal({ id: pendingMeal.current, date: dateKey, type: mealType, items: [{
      food_item_id: food.id,
      custom_food_name: food.name_local || food.name,
      weight_grams: grams,
      calories: nutrition.calories,
      protein_g: nutrition.proteinG,
      fat_g: nutrition.fatG,
      carbs_g: nutrition.carbsG,
      weight_source: "manual",
    }] });
      queryClient.invalidateQueries({ queryKey: dayQueryKey(dateKey) });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      setDone(true);
      setTimeout(() => {
        setDone(false);
        setSelected(null);
        router.push("/day");
      }, 700);
    } catch (e) { setError(e instanceof Error ? e.message : "Не удалось сохранить продукт"); }
    finally { setAdding(false); addLock.current = false; }
  }

  async function createCustom() {
    if (!foodNameSchema.safeParse(custom.name).success || !custom.calories || !nutritionSchema.safeParse({
      calories: Number(custom.calories), protein: Number(custom.protein), fat: Number(custom.fat), carbs: Number(custom.carbs),
    }).success) {
      setError("Укажите название и калорийность");
      return;
    }
    setAdding(true);
    setError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) { setAdding(false); setError("Войдите в аккаунт заново"); return; }

    const { data, error: createError } = await supabase
      .from("food_items")
      .insert({
        name: custom.name,
        name_local: custom.name,
        calories_per_100g: Number(custom.calories),
        protein_per_100g: Number(custom.protein) || 0,
        fat_per_100g: Number(custom.fat) || 0,
        carbs_per_100g: Number(custom.carbs) || 0,
        source: "user_custom",
        created_by: user.id,
      })
      .select()
      .single();

    setAdding(false);
    if (createError) {
      setError(createError.message);
      return;
    }

    const food: SearchResult = {
      id: data.id,
      name: data.name,
      name_local: data.name_local,
      calories_per_100g: Number(data.calories_per_100g),
      protein_per_100g: Number(data.protein_per_100g),
      fat_per_100g: Number(data.fat_per_100g),
      carbs_per_100g: Number(data.carbs_per_100g),
    };
    setShowCustom(false);
    pendingMeal.current = null;
    setCustom({ name: "", calories: "", protein: "", fat: "", carbs: "" });
    setSelected(food);
  }

  const selectedNutrition = useMemo(
    () =>
      selected
        && weightSchema.safeParse(Number(weight.replace(",", "."))).success
        ? macrosForWeight(
            toPer100(selected),
            Number(weight.replace(",", ".")),
          )
        : null,
    [selected, weight],
  );

  return (
    <main className="min-h-dvh bg-background px-4 pb-24 pt-6">
      <header className="mb-4 flex items-center justify-between">
        <Link href="/day" className="text-sm text-muted-foreground">
          ← Назад
        </Link>
        <h1 className="text-lg font-bold">Добавить продукт</h1>
        <div className="w-10" />
      </header>

      {/* Выбор приёма пищи */}
      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
        {MEAL_TYPES.map((mt) => (
          <button
            key={mt.value}
            onClick={() => setMealType(mt.value)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              mealType === mt.value
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground"
            }`}
          >
            {mt.emoji} {mt.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-danger-soft p-3 text-sm text-danger">
          {error}
        </div>
      )}

      {/* Поиск */}
      <div className="relative mb-4">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          maxLength={100}
          placeholder="Найти продукт…"
          className="w-full rounded-2xl border border-border bg-card py-3.5 pl-10 pr-4 outline-none focus:border-primary"
        />
      </div>

      {/* Выбранный продукт — ввод веса */}
      {selected && (
        <div className="rounded-2xl bg-primary-soft p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="font-semibold">
                {selected.name_local || selected.name}
              </div>
              <div className="text-xs text-muted-foreground tabular-nums">
                {selected.calories_per_100g} ккал / 100 г
              </div>
            </div>
            <button
              onClick={() => setSelected(null)}
              aria-label="Отменить"
              className="rounded-full p-1.5 text-muted-foreground hover:text-danger"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mb-3 flex items-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="flex-1 rounded-xl border border-border bg-background px-3 py-2.5 tabular-nums outline-none focus:border-primary"
            />
            <span className="text-sm text-muted-foreground">г</span>
          </div>
          {selectedNutrition && (
            <div className="mb-3 flex justify-between text-sm tabular-nums">
              <span className="text-muted-foreground">Б {selectedNutrition.proteinG} г</span>
              <span className="text-muted-foreground">Ж {selectedNutrition.fatG} г</span>
              <span className="text-muted-foreground">У {selectedNutrition.carbsG} г</span>
              <span className="font-bold">{selectedNutrition.calories} ккал</span>
            </div>
          )}
          <button
            onClick={() => addItem(selected)}
            disabled={adding || done}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-50"
          >
            {adding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : done ? (
              <Check className="h-4 w-4" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {done ? "Добавлено!" : "Добавить в дневник"}
          </button>
        </div>
      )}

      {/* Результаты поиска */}
      {!selected && (
        <>
          {results && results.length > 0 && (
            <ul className="space-y-2">
              {results.map((food, i) => (
                <li key={food.id}>
                  <button
                    onClick={() => {
                      pendingMeal.current = null;
                      setSelected(food);
                      setWeight("100");
                    }}
                    className="flex w-full items-center justify-between rounded-2xl bg-card p-4 text-left shadow-sm transition-colors hover:bg-muted"
                  >
                    <div>
                      <div className="font-medium">
                        {food.name_local || food.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Б {food.protein_per_100g} · Ж {food.fat_per_100g} · У{" "}
                        {food.carbs_per_100g} / 100г
                      </div>
                    </div>
                    <div className="text-sm font-semibold tabular-nums">
                      {Math.round(food.calories_per_100g)} ккал
                    </div>
                  </button>
                  {i === 0 && (
                    <Link
                      href="/foods?q="
                      className={`mt-2 flex items-center justify-center gap-1 rounded-xl border border-dashed border-border py-3 text-sm text-muted-foreground hover:text-primary`}
                      onClick={(e) => {
                        e.preventDefault();
                        setShowCustom(true);
                      }}
                    >
                      <Plus className="h-4 w-4" /> Создать свой продукт
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
          {results && results.length === 0 && !showCustom && (
            <button
              onClick={() => setShowCustom(true)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border py-4 text-sm text-muted-foreground hover:text-primary"
            >
              <Plus className="h-4 w-4" /> «{q}» не найден — создать?
            </button>
          )}
          {results === null && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Начните вводить название, чтобы найти продукт. Например, «гречка»
              или «курица».
            </p>
          )}

          {/* Форма нового продукта */}
          {showCustom && (
            <div className="mt-4 rounded-2xl bg-card p-4 shadow-sm">
              <h2 className="mb-3 font-semibold">Новый продукт</h2>
              <div className="space-y-3">
                <input
                  value={custom.name}
                  onChange={(e) => setCustom({ ...custom, name: e.target.value })}
                  placeholder="Название"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 outline-none focus:border-primary"
                />
                <div className="grid grid-cols-4 gap-2">
                  <CustomInput label="ккал" value={custom.calories} onChange={(v) => setCustom({ ...custom, calories: v })} />
                  <CustomInput label="белок" value={custom.protein} onChange={(v) => setCustom({ ...custom, protein: v })} />
                  <CustomInput label="жиры" value={custom.fat} onChange={(v) => setCustom({ ...custom, fat: v })} />
                  <CustomInput label="углев." value={custom.carbs} onChange={(v) => setCustom({ ...custom, carbs: v })} />
                </div>
                <p className="text-xs text-muted-foreground">
                  Значения на 100 г продукта
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowCustom(false)}
                    className="rounded-xl bg-muted px-4 py-2.5 text-sm"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={createCustom}
                    disabled={adding}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    {adding && <Loader2 className="h-4 w-4 animate-spin" />}
                    Сохранить
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}

function CustomInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="space-y-1">
      <span className="block text-xs text-muted-foreground">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-right tabular-nums outline-none focus:border-primary"
      />
    </label>
  );
}
