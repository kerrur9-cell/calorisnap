"use client";

import { useState } from "react";
import { Sparkles, X, Plus, Clock, ChefHat, Check, Loader2 } from "lucide-react";
import { usePersonalFoodGraph } from "@/hooks/usePersonalFoodGraph";
import { saveMeal } from "@/lib/meals";
import { useQueryClient } from "@tanstack/react-query";
import { dayQueryKey, MEAL_TYPES } from "@/hooks/useDayLog";
import type { MealType } from "@/types/database";
import type { DayTotals, MacroTargets } from "@/lib/nutrition/macros";

interface FridgeRecipeIngredient {
  name: string;
  weight_grams: number;
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
}

interface FridgeRecipe {
  title: string;
  description: string;
  cookingTimeMinutes: number;
  difficulty: "easy" | "medium";
  ingredients: FridgeRecipeIngredient[];
  instructions: string[];
  totalCalories: number;
  totalProtein: number;
  totalFat: number;
  totalCarbs: number;
}

interface FridgeRecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
  dateKey: string;
  remainingCalories: number;
  remainingTotals: DayTotals;
  macroTargets: MacroTargets;
  defaultMealType?: MealType;
}

export function FridgeRecipeModal({
  isOpen,
  onClose,
  dateKey,
  remainingCalories,
  remainingTotals,
  defaultMealType = "dinner",
}: FridgeRecipeModalProps) {
  const queryClient = useQueryClient();
  const { data: foodGraph } = usePersonalFoodGraph();

  const [ingredients, setIngredients] = useState<string[]>([]);
  const [currentInput, setCurrentInput] = useState("");
  const [selectedMealType, setSelectedMealType] = useState<MealType>(defaultMealType);
  const [recipes, setRecipes] = useState<FridgeRecipe[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [savingRecipeIndex, setSavingRecipeIndex] = useState<number | null>(null);
  const [savedRecipeIndex, setSavedRecipeIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  function handleAddIngredient(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!ingredients.some((i) => i.toLowerCase() === trimmed.toLowerCase())) {
      setIngredients((prev) => [...prev, trimmed]);
    }
    setCurrentInput("");
  }

  function handleRemoveIngredient(name: string) {
    setIngredients((prev) => prev.filter((i) => i !== name));
  }

  async function handleGenerate() {
    if (ingredients.length === 0) {
      setError("Укажите хотя бы один продукт из холодильника");
      return;
    }

    setIsLoading(true);
    setError(null);
    setRecipes(null);
    setSavedRecipeIndex(null);

    try {
      const res = await fetch("/api/ai/fridge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredients,
          remainingCalories,
          remainingProtein: remainingTotals.proteinG,
          remainingFat: remainingTotals.fatG,
          remainingCarbs: remainingTotals.carbsG,
          mealType: selectedMealType,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Не удалось подобрать рецепты");

      setRecipes(data.recipes ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка при генерации рецептов");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSaveRecipeToDiary(recipe: FridgeRecipe, index: number) {
    setSavingRecipeIndex(index);
    setError(null);

    try {
      const mealId = crypto.randomUUID();
      await saveMeal({
        id: mealId,
        date: dateKey,
        type: selectedMealType,
        items: recipe.ingredients.map((item, idx) => ({
          custom_food_name: item.name,
          weight_grams: item.weight_grams,
          calories: item.calories,
          protein_g: item.protein_g,
          fat_g: item.fat_g,
          carbs_g: item.carbs_g,
          weight_source: "ai_estimated",
          position: idx,
        })),
      });

      queryClient.invalidateQueries({ queryKey: dayQueryKey(dateKey) });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      setSavedRecipeIndex(index);

      setTimeout(() => {
        onClose();
      }, 1200);
    } catch {
      setError("Не удалось сохранить рецепт в дневник");
    } finally {
      setSavingRecipeIndex(null);
    }
  }

  return (
    <div
      className="animate-backdrop-fade fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="animate-sheet-spring w-full max-w-lg rounded-t-3xl bg-card/95 backdrop-blur-xl p-5 shadow-2xl sm:rounded-3xl max-h-[90vh] overflow-y-auto no-scrollbar space-y-4 border border-border/40">
        {/* iOS-стиль индикатор свайпа вниз */}
        <div className="mx-auto -mt-1 mb-2 h-1.5 w-12 rounded-full bg-muted-foreground/20 sm:hidden shrink-0" />

        {/* Заголовок */}
        <header className="flex items-center justify-between border-b border-border/50 pb-3">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-primary-soft p-2 text-primary">
              <ChefHat className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-bold">Что приготовить из холодильника</h2>
              <p className="text-xs text-muted-foreground">
                Рецепты под ваши остатки калорий и БЖУ
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Закрыть"
            className="rounded-full p-2 text-muted-foreground hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Бюджет калорий */}
        <div className="flex items-center justify-between rounded-2xl bg-muted/40 p-3 text-xs">
          <div className="text-muted-foreground">
            Остаток на день:{" "}
            <span className="font-bold text-foreground">
              {remainingCalories > 0 ? `+${remainingCalories}` : remainingCalories} ккал
            </span>
          </div>
          <div className="flex gap-2 font-medium">
            <span>Б: {Math.max(0, Math.round(remainingTotals.proteinG))}г</span>
            <span>Ж: {Math.max(0, Math.round(remainingTotals.fatG))}г</span>
            <span>У: {Math.max(0, Math.round(remainingTotals.carbsG))}г</span>
          </div>
        </div>

        {/* Выбор приёма пищи */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground">Приём пищи:</label>
          <div className="flex flex-wrap gap-1.5">
            {MEAL_TYPES.map((mt) => (
              <button
                key={mt.value}
                onClick={() => setSelectedMealType(mt.value)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                  selectedMealType === mt.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {mt.emoji} {mt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Поле добавления ингредиентов */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground">
            Что есть в холодильнике:
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddIngredient(currentInput);
                }
              }}
              placeholder="Например: яйца, помидоры, сыр, курица..."
              className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary"
            />
            <button
              onClick={() => handleAddIngredient(currentInput)}
              className="flex items-center gap-1 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
            >
              <Plus className="h-4 w-4" />
              Добавить
            </button>
          </div>

          {/* Список выбранных ингредиентов */}
          {ingredients.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {ingredients.map((ing) => (
                <span
                  key={ing}
                  className="flex items-center gap-1 rounded-full bg-primary-soft/80 px-2.5 py-1 text-xs font-medium text-primary"
                >
                  {ing}
                  <button
                    onClick={() => handleRemoveIngredient(ing)}
                    className="hover:opacity-75"
                    aria-label={`Удалить ${ing}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Быстрый выбор из личного графа продуктов */}
          {foodGraph && foodGraph.frequentFoods.length > 0 && (
            <div className="pt-2">
              <div className="text-[11px] font-medium text-muted-foreground mb-1.5">
                Ваши любимые продукты (нажмите, чтобы добавить):
              </div>
              <div className="flex flex-wrap gap-1.5">
                {foodGraph.frequentFoods.slice(0, 8).map((food) => {
                  const isSelected = ingredients.some(
                    (i) => i.toLowerCase() === food.foodName.toLowerCase()
                  );
                  if (isSelected) return null;
                  return (
                    <button
                      key={food.foodName}
                      onClick={() => handleAddIngredient(food.foodName)}
                      className="rounded-full border border-border/60 bg-muted/30 px-2.5 py-0.5 text-[11px] text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    >
                      + {food.foodName}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {error && <div className="text-xs text-danger">{error}</div>}

        {/* Кнопка запуска генерации */}
        <button
          onClick={handleGenerate}
          disabled={isLoading || ingredients.length === 0}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-xs font-bold text-primary-foreground shadow-sm transition-all disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Подбираю рецепты под калории...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Придумать рецепты под баланс БЖУ
            </>
          )}
        </button>

        {/* Список сгенерированных рецептов */}
        {recipes && recipes.length > 0 && (
          <div className="space-y-4 pt-2">
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Предложенные рецепты ({recipes.length})
            </div>

            {recipes.map((recipe, idx) => (
              <div
                key={idx}
                className="space-y-3 rounded-2xl border border-border/80 bg-background/50 p-4 shadow-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold">{recipe.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{recipe.description}</p>
                  </div>
                  <div className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground shrink-0">
                    <Clock className="h-3 w-3" />
                    <span>{recipe.cookingTimeMinutes} мин</span>
                  </div>
                </div>

                {/* КБЖУ рецепта */}
                <div className="flex items-center justify-between rounded-xl bg-primary-soft/40 px-3 py-2 text-xs font-semibold text-primary">
                  <span>{Math.round(recipe.totalCalories)} ккал</span>
                  <div className="flex gap-2 text-[11px]">
                    <span>Б: {Number(recipe.totalProtein.toFixed(1))}г</span>
                    <span>Ж: {Number(recipe.totalFat.toFixed(1))}г</span>
                    <span>У: {Number(recipe.totalCarbs.toFixed(1))}г</span>
                  </div>
                </div>

                {/* Ингредиенты с точными граммовками */}
                <div className="space-y-1 text-xs">
                  <div className="text-[11px] font-bold text-muted-foreground">Ингредиенты:</div>
                  {recipe.ingredients.map((item, iIdx) => (
                    <div
                      key={iIdx}
                      className="flex items-center justify-between border-b border-border/20 py-1"
                    >
                      <span>{item.name}</span>
                      <div className="tabular-nums text-muted-foreground">
                        <span className="font-semibold text-foreground mr-2">{item.weight_grams} г</span>
                        <span>{Math.round(item.calories)} ккал</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Шаги приготовления */}
                <div className="space-y-1 text-xs pt-1">
                  <div className="text-[11px] font-bold text-muted-foreground">Как готовить:</div>
                  <ol className="list-decimal list-inside space-y-1 text-muted-foreground leading-relaxed">
                    {recipe.instructions.map((step, sIdx) => (
                      <li key={sIdx}>{step}</li>
                    ))}
                  </ol>
                </div>

                {/* Кнопка записи в дневник */}
                <button
                  onClick={() => handleSaveRecipeToDiary(recipe, idx)}
                  disabled={savingRecipeIndex === idx || savedRecipeIndex === idx}
                  className={`flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition-all ${
                    savedRecipeIndex === idx
                      ? "bg-emerald-600 text-white"
                      : "bg-primary text-primary-foreground hover:bg-primary/90"
                  }`}
                >
                  {savingRecipeIndex === idx ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : savedRecipeIndex === idx ? (
                    <>
                      <Check className="h-4 w-4" />
                      Записано в дневник!
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Записать рецепт в дневник
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
