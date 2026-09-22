import { macrosForWeight, type MacroTargets, type Per100 } from "./macros";

export interface FoodSwapItem {
  name: string;
  weightGrams: number;
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
}

export interface SwapOption {
  type: "lighter" | "higher_protein" | "portion_reduction";
  title: string;
  newName: string;
  newWeightGrams: number;
  newCalories: number;
  newMacros: MacroTargets;
  deltaCalories: number;
  deltaProteinG: number;
  deltaFatG: number;
  deltaCarbsG: number;
  reason: string;
}

/**
 * Базовые пары умных замен для частых высококалорийных продуктов.
 */
const COMMON_SWAP_RULES: Array<{
  pattern: RegExp;
  lighter?: { name: string; per100: Per100; servingMultiplier: number; reason: string };
  higherProtein?: { name: string; per100: Per100; servingMultiplier: number; reason: string };
}> = [
  {
    pattern: /(майонез|майонезн)/iu,
    lighter: {
      name: "Греческий йогурт 2% с горчицей",
      per100: { calories: 75, protein: 9.5, fat: 2.2, carbs: 4.0 },
      servingMultiplier: 1.0,
      reason: "Идеальная альтернатива соусу: в 8 раз меньше жиров при том же вкусе и кремовой текстуре.",
    },
  },
  {
    pattern: /(свинин|колбас|сосиск|бекон)/iu,
    lighter: {
      name: "Куриная ветчина или филе индейки",
      per100: { calories: 105, protein: 21.0, fat: 2.0, carbs: 0.5 },
      servingMultiplier: 1.0,
      reason: "Снижает насыщенные жиры в 5 раз при сохранении мясного вкуса и объема.",
    },
    higherProtein: {
      name: "Куриное филе на гриле",
      per100: { calories: 115, protein: 24.0, fat: 2.0, carbs: 0 },
      servingMultiplier: 1.0,
      reason: "Максимальная концентрация чистого белка без скрытых жиров.",
    },
  },
  {
    pattern: /(кола|пепси|лимонад|сок|газировк)/iu,
    lighter: {
      name: "Напиток без сахара (Zero) или вода с лимоном",
      per100: { calories: 1, protein: 0, fat: 0, carbs: 0.1 },
      servingMultiplier: 1.0,
      reason: "Полная экономия быстрых сахаров и жидких калорий.",
    },
  },
  {
    pattern: /(шоколад|торт|пирожн|печенье)/iu,
    higherProtein: {
      name: "Протеиновый батончик без сахара",
      per100: { calories: 340, protein: 35.0, fat: 12.0, carbs: 15.0 },
      servingMultiplier: 0.7,
      reason: "Удовлетворяет тягу к сладкому, но даёт +15–20 г чистого белка вместо пустых сахаров.",
    },
  },
  {
    pattern: /(пицца|бургер|фастфуд)/iu,
    higherProtein: {
      name: "Домашний ролл в лаваше с курицей и овощами",
      per100: { calories: 145, protein: 14.0, fat: 4.5, carbs: 12.0 },
      servingMultiplier: 0.85,
      reason: "Тот же насыщенный вкус фастфуда, но с чистым мясом и обилием клетчатки.",
    },
  },
  {
    pattern: /(картофел.*фри|чипс)/iu,
    lighter: {
      name: "Запеченный картофель дольками без масла",
      per100: { calories: 90, protein: 2.2, fat: 0.3, carbs: 19.0 },
      servingMultiplier: 1.0,
      reason: "В 3 раза меньше калорий за счёт отсутствия фритюрного масла.",
    },
  },
];

/**
 * Генерирует варианты замены блюда:
 * 1. Более легкий аналог (если найден).
 * 2. Более белковый аналог (если найден).
 * 3. Разумная оптимизация порции (-25%).
 */
export function generateFoodSwaps(original: FoodSwapItem): SwapOption[] {
  const options: SwapOption[] = [];

  // Поиск по паттернам замен
  for (const rule of COMMON_SWAP_RULES) {
    if (rule.pattern.test(original.name)) {
      if (rule.lighter) {
        const newWeight = Math.round(original.weightGrams * rule.lighter.servingMultiplier);
        const newM = macrosForWeight(rule.lighter.per100, newWeight);
        options.push({
          type: "lighter",
          title: "Легче по калориям",
          newName: rule.lighter.name,
          newWeightGrams: newWeight,
          newCalories: newM.calories,
          newMacros: { proteinG: newM.proteinG, fatG: newM.fatG, carbsG: newM.carbsG },
          deltaCalories: newM.calories - original.calories,
          deltaProteinG: Math.round((newM.proteinG - original.proteinG) * 10) / 10,
          deltaFatG: Math.round((newM.fatG - original.fatG) * 10) / 10,
          deltaCarbsG: Math.round((newM.carbsG - original.carbsG) * 10) / 10,
          reason: rule.lighter.reason,
        });
      }

      if (rule.higherProtein) {
        const newWeight = Math.round(original.weightGrams * rule.higherProtein.servingMultiplier);
        const newM = macrosForWeight(rule.higherProtein.per100, newWeight);
        options.push({
          type: "higher_protein",
          title: "Больше белка",
          newName: rule.higherProtein.name,
          newWeightGrams: newWeight,
          newCalories: newM.calories,
          newMacros: { proteinG: newM.proteinG, fatG: newM.fatG, carbsG: newM.carbsG },
          deltaCalories: newM.calories - original.calories,
          deltaProteinG: Math.round((newM.proteinG - original.proteinG) * 10) / 10,
          deltaFatG: Math.round((newM.fatG - original.fatG) * 10) / 10,
          deltaCarbsG: Math.round((newM.carbsG - original.carbsG) * 10) / 10,
          reason: rule.higherProtein.reason,
        });
      }
      break;
    }
  }

  // Опция 3: Оптимизация порции (сокращение на 25%) доступна всегда для любого блюда
  if (original.weightGrams >= 100) {
    const reducedWeight = Math.round(original.weightGrams * 0.75);
    const ratio = reducedWeight / original.weightGrams;
    const newCalories = Math.round(original.calories * ratio);
    const newProtein = Math.round(original.proteinG * ratio * 10) / 10;
    const newFat = Math.round(original.fatG * ratio * 10) / 10;
    const newCarbs = Math.round(original.carbsG * ratio * 10) / 10;

    options.push({
      type: "portion_reduction",
      title: "Оптимизация порции (-25%)",
      newName: `${original.name} (умеренная порция)`,
      newWeightGrams: reducedWeight,
      newCalories,
      newMacros: { proteinG: newProtein, fatG: newFat, carbsG: newCarbs },
      deltaCalories: newCalories - original.calories,
      deltaProteinG: Math.round((newProtein - original.proteinG) * 10) / 10,
      deltaFatG: Math.round((newFat - original.fatG) * 10) / 10,
      deltaCarbsG: Math.round((newCarbs - original.carbsG) * 10) / 10,
      reason: `Уменьшение порции до ${reducedWeight} г сохраняет привычное блюдо, но моментально экономит ${Math.abs(
        newCalories - original.calories
      )} ккал.`,
    });
  }

  return options;
}
