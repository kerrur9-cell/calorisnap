"use client";

import type { MealWithItems, MealType } from "@/types/database";
import { mealTypeMeta } from "@/hooks/useDayLog";
import { sumTotals } from "@/lib/nutrition/macros";
import { ImageIcon, Trash2, ArrowLeftRight, SunMedium, Utensils, Moon, Apple } from "lucide-react";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { dayQueryKey } from "@/hooks/useDayLog";
import Image from "next/image";
import dynamic from "next/dynamic";
import type { FoodSwapItem } from "@/lib/nutrition/swap";
import { useFriendView } from "@/context/FriendViewContext";

const FoodSwapModal = dynamic(
  () => import("./FoodSwapModal").then((mod) => mod.FoodSwapModal),
  { ssr: false }
);

export function MealIcon({ type, className = "h-4 w-4" }: { type: MealType; className?: string }) {
  switch (type) {
    case "breakfast":
      return <SunMedium className={className} />;
    case "lunch":
      return <Utensils className={className} />;
    case "dinner":
      return <Moon className={className} />;
    case "snack":
    default:
      return <Apple className={className} />;
  }
}

/**
 * Карточка приёма пищи: единый стиль, Lucide иконка, список продуктов и сумма БЖУ.
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
  const { isGuestView } = useFriendView();
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
    if (isGuestView) return;
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
    <div className="glass-card glossy-sheen scroll-sway rounded-3xl p-4 shadow-sm transition-all duration-300 animate-blur-reveal">
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary-soft text-primary border border-primary/20 shrink-0">
            <MealIcon type={meal.meal_type} className="h-4 w-4 stroke-[2]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground leading-tight">{meta.label}</h3>
            <span className="text-[11px] text-muted-foreground">{displayedAt}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {meal.photo_storage_path && (
            <button
              onClick={showPhoto}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
            >
              <ImageIcon className="h-3.5 w-3.5 text-primary" /> фото
            </button>
          )}
          {!isGuestView && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              aria-label="Удалить приём пищи"
              className="rounded-lg p-1.5 text-muted-foreground/70 transition-colors hover:bg-danger-soft hover:text-danger active:scale-95"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {error && <p role="alert" className="text-danger text-xs mb-2">{error}</p>}
      {photoUrl && (
        <Image
          src={photoUrl}
          unoptimized
          width={1280}
          height={960}
          alt="Фото приёма пищи"
          className="mb-3 h-auto w-full rounded-2xl border border-border/50 object-cover max-h-60"
          onError={() => {
            setPhotoUrl(null);
            setError("Ссылка на фото истекла. Нажмите «фото» ещё раз.");
          }}
        />
      )}

      <ul className="space-y-1">
        {meal.meal_items.map((item) => {
          const name = item.custom_food_name ?? "Продукт";
          return (
            <li
              key={item.id}
              className="group flex items-center justify-between gap-2 rounded-xl px-2 py-1.5 text-sm transition-colors hover:bg-muted/30"
            >
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                {!isGuestView && (
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
                    className="rounded-md p-1 text-muted-foreground/50 transition-colors hover:bg-primary-soft hover:text-primary shrink-0"
                  >
                    <ArrowLeftRight className="h-3.5 w-3.5" />
                  </button>
                )}
                <span className="text-foreground truncate text-xs sm:text-sm font-medium">
                  {name}
                  {item.weight_grams != null && (
                    <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                      · {Math.round(item.weight_grams)} г
                    </span>
                  )}
                </span>
              </div>

              <div className="flex items-center gap-2.5 shrink-0 tabular-nums">
                <span className="hidden sm:inline-block text-[11px] text-muted-foreground">
                  Б {item.protein_g} · Ж {item.fat_g} · У {item.carbs_g}
                </span>
                <span className="text-right text-xs sm:text-sm font-semibold text-foreground">
                  {Math.round(item.calories)} <span className="text-[10px] font-normal text-muted-foreground">ккал</span>
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2 text-xs">
        <span className="text-muted-foreground font-medium">
          Б {Math.round(totals.proteinG)}г · Ж {Math.round(totals.fatG)}г · У {Math.round(totals.carbsG)}г
        </span>
        <span className="font-bold tabular-nums text-foreground">
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
