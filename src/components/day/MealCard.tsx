"use client";

import type { MealWithItems } from "@/types/database";
import { mealTypeMeta } from "@/hooks/useDayLog";
import { sumTotals } from "@/lib/nutrition/macros";
import { ImageIcon, Trash2, ArrowLeftRight } from "lucide-react";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { dayQueryKey } from "@/hooks/useDayLog";
import Image from "next/image";
import { FoodSwapModal } from "./FoodSwapModal";
import type { FoodSwapItem } from "@/lib/nutrition/swap";

/**
 * Карточка приёма пищи: emoji + список продуктов + сумма по БЖУ.
 * Свайп-удаление реализовано кнопкой (для надёжности и a11y).
 */
export function MealCard({
  meal,
  dateKey,
}: {
  meal: MealWithItems;
  dateKey: string;
}) {
  const meta = mealTypeMeta(meal.meal_type);
  const totals = sumTotals(meal.meal_items);
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [swappingItem, setSwappingItem] = useState<FoodSwapItem | null>(null);

  async function showPhoto() {
    if (!meal.photo_storage_path) return;
    const { data, error } = await createClient().storage.from("food-photos").createSignedUrl(meal.photo_storage_path, 300);
    if (error) setError("Не удалось открыть фото");
    else setPhotoUrl(data.signedUrl);
  }

  async function handleDelete() {
    if (!confirm(`Удалить «${meta.label}»?`)) return;
    setDeleting(true);
    setError(null);
    const supabase = createClient();
    if (meal.photo_storage_path) {
      const { error } = await supabase.storage.from("food-photos").remove([meal.photo_storage_path]);
      if (error) { setError("Не удалось удалить фото. Повторите удаление."); setDeleting(false); return; }
    }
    const { error } = await supabase
      .from("meal_entries")
      .delete()
      .eq("id", meal.id);
    if (!error) {
      queryClient.invalidateQueries({ queryKey: dayQueryKey(dateKey) });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    } else setError("Не удалось удалить запись. Повторите удаление.");
    setDeleting(false);
  }

  const displayedAt = new Date(meal.logged_at).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="rounded-2xl bg-card p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{meta.emoji}</span>
          <div>
            <h3 className="font-semibold">{meta.label}</h3>
            <span className="text-xs text-muted-foreground">{displayedAt}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {meal.photo_storage_path && (
            <button onClick={showPhoto} className="flex items-center gap-1 text-xs text-muted-foreground">
              <ImageIcon className="h-3.5 w-3.5" /> фото
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={deleting}
            aria-label="Удалить приём пищи"
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-danger-soft hover:text-danger"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {error && <p role="alert" className="text-danger">{error}</p>}
      {photoUrl && <Image src={photoUrl} unoptimized width={1280} height={960} alt="Фото приёма пищи" className="mb-3 h-auto w-full rounded-xl" onError={() => { setPhotoUrl(null); setError("Ссылка на фото истекла. Нажмите «фото» ещё раз."); }} />}
      <ul className="space-y-1.5">
        {meal.meal_items.map((item) => {
          const name = item.custom_food_name ?? "Продукт";
          return (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-2 text-sm"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <button
                  onClick={() =>
                    setSwappingItem({
                      name,
                      weightGrams: item.weight_grams ?? 100,
                      calories: item.calories,
                      proteinG: item.protein_g,
                      fatG: item.fat_g,
                      carbsG: item.carbs_g,
                    })
                  }
                  title="Подобрать замену (Food Swap)"
                  aria-label={`Подобрать замену для ${name}`}
                  className="rounded p-1 text-muted-foreground/60 transition-colors hover:bg-primary-soft hover:text-primary"
                >
                  <ArrowLeftRight className="h-3.5 w-3.5" />
                </button>
                <span className="text-foreground truncate">
                  {name}
                  {item.weight_grams != null && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      · {Math.round(item.weight_grams)} г
                    </span>
                  )}
                </span>
              </div>
              <span className="flex shrink-0 items-center gap-3 tabular-nums">
                <span className="text-xs text-muted-foreground">
                  Б {item.protein_g} · Ж {item.fat_g} · У {item.carbs_g}
                </span>
                <span className="w-14 text-right font-semibold">
                  {Math.round(item.calories)} ккал
                </span>
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-sm">
        <span className="text-muted-foreground">Итого</span>
        <span className="font-bold tabular-nums">
          {Math.round(totals.calories)} ккал
        </span>
      </div>

      {swappingItem && (
        <FoodSwapModal
          item={swappingItem}
          isOpen={Boolean(swappingItem)}
          onClose={() => setSwappingItem(null)}
        />
      )}
    </div>
  );
}
