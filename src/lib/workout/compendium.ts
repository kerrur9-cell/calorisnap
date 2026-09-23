/**
 * Справочник физической активности Compendium of Physical Activities (Ainsworth et al.)
 * и уравнения ACSM (American College of Sports Medicine) для беговой дорожки.
 */

export interface CompendiumActivity {
  id: string;
  nameRu: string;
  nameEn: string;
  category: "cardio" | "strength" | "machine" | "bodyweight";
  defaultMet: number;
  metRange?: [number, number];
  description: string;
  speedRangeKmh?: [number, number];
}

/**
 * Стандартизированные значения MET из Compendium of Physical Activities
 */
export const COMPENDIUM_ACTIVITIES: Record<string, CompendiumActivity> = {
  // Ходьба
  walking_slow: {
    id: "walking_slow",
    nameRu: "Медленная прогулочная ходьба (< 3.5 км/ч)",
    nameEn: "Walking, slow / stroll (< 2.0 mph)",
    category: "cardio",
    defaultMet: 2.5,
    metRange: [2.0, 2.8],
    description: "Compendium code 17151: неспешная прогулка по ровной поверхности.",
    speedRangeKmh: [1.0, 3.5],
  },
  walking_moderate: {
    id: "walking_moderate",
    nameRu: "Ходьба в среднем темпе (4.0–5.0 км/ч)",
    nameEn: "Walking, moderate pace (2.5–3.0 mph)",
    category: "cardio",
    defaultMet: 3.5,
    metRange: [3.0, 4.0],
    description: "Compendium code 17170: обычная бытовая ходьба по ровной поверхности.",
    speedRangeKmh: [3.6, 5.0],
  },
  walking_brisk: {
    id: "walking_brisk",
    nameRu: "Быстрая ходьба (5.5–6.5 км/ч)",
    nameEn: "Walking, brisk pace (3.5–4.0 mph)",
    category: "cardio",
    defaultMet: 5.0,
    metRange: [4.5, 5.5],
    description: "Compendium code 17190/17200: энергичная ходьба, заметное учащение дыхания.",
    speedRangeKmh: [5.1, 6.5],
  },
  walking_very_brisk: {
    id: "walking_very_brisk",
    nameRu: "Очень быстрая ходьба (6.7–7.5 км/ч)",
    nameEn: "Walking, very brisk (4.2–4.5 mph)",
    category: "cardio",
    defaultMet: 5.8,
    metRange: [5.5, 6.5],
    description: "Compendium code 17220: спортивная ходьба на грани перехода на бег.",
    speedRangeKmh: [6.6, 7.5],
  },
  walking_uphill: {
    id: "walking_uphill",
    nameRu: "Ходьба в гору / на наклонной дорожке",
    nameEn: "Walking uphill (1–5% grade)",
    category: "cardio",
    defaultMet: 6.0,
    metRange: [5.3, 8.5],
    description: "Compendium code 17231: ходьба с подъёмом, активно включает ягодицы и икры.",
    speedRangeKmh: [3.5, 6.5],
  },

  // Бег
  running_jogging: {
    id: "running_jogging",
    nameRu: "Легкий бег трусцой (7.0–8.0 км/ч)",
    nameEn: "Jogging, general pace",
    category: "cardio",
    defaultMet: 7.0,
    metRange: [6.5, 8.0],
    description: "Compendium code 12020: неторопливый бег трусцой в аэробной зоне.",
    speedRangeKmh: [6.7, 8.0],
  },
  running_8kmh: {
    id: "running_8kmh",
    nameRu: "Бег 8.0–8.5 км/ч (темп 7:00–7:30 мин/км)",
    nameEn: "Running, 5.0–5.2 mph",
    category: "cardio",
    defaultMet: 8.5,
    metRange: [8.0, 9.0],
    description: "Compendium code 12030/12040: равномерный бег средней интенсивности.",
    speedRangeKmh: [8.1, 9.0],
  },
  running_10kmh: {
    id: "running_10kmh",
    nameRu: "Бег 10.0 км/ч (темп 6:00 мин/км)",
    nameEn: "Running, 6.0–6.2 mph",
    category: "cardio",
    defaultMet: 9.8,
    metRange: [9.5, 10.5],
    description: "Compendium code 12050: устойчивый темповый бег.",
    speedRangeKmh: [9.1, 10.5],
  },
  running_11kmh: {
    id: "running_11kmh",
    nameRu: "Бег 11.5–12.0 км/ч (темп 5:00 мин/км)",
    nameEn: "Running, 7.0–7.5 mph",
    category: "cardio",
    defaultMet: 11.5,
    metRange: [11.0, 12.0],
    description: "Compendium code 12070/12080: интенсивный беговой темп.",
    speedRangeKmh: [10.6, 12.5],
  },
  running_fast: {
    id: "running_fast",
    nameRu: "Быстрый бег / интервалы (> 13 км/ч)",
    nameEn: "Running, fast / intervals (> 8.0 mph)",
    category: "cardio",
    defaultMet: 12.8,
    metRange: [12.0, 15.0],
    description: "Compendium code 12100+: анаэробная беговая работа высокой интенсивности.",
    speedRangeKmh: [12.6, 20.0],
  },

  // Кардио-тренажеры
  elliptical_moderate: {
    id: "elliptical_moderate",
    nameRu: "Эллиптический тренажер (средний темп)",
    nameEn: "Elliptical trainer, moderate effort",
    category: "cardio",
    defaultMet: 5.0,
    metRange: [4.5, 6.0],
    description: "Compendium code 02048: плавная циклическая нагрузка без удара по суставам.",
  },
  elliptical_vigorous: {
    id: "elliptical_vigorous",
    nameRu: "Эллиптический тренажер (интенсивно)",
    nameEn: "Elliptical trainer, vigorous effort",
    category: "cardio",
    defaultMet: 7.5,
    metRange: [6.5, 8.5],
    description: "Высокое сопротивление и скорость на эллипсоиде.",
  },
  stationary_cycling_moderate: {
    id: "stationary_cycling_moderate",
    nameRu: "Велотренажер (умеренный темп, ~100 Вт)",
    nameEn: "Stationary cycling, moderate (90–100 watts)",
    category: "cardio",
    defaultMet: 5.5,
    metRange: [4.8, 6.5],
    description: "Compendium code 02012: равномерное кручение педалей с умеренным усилием.",
  },
  stationary_cycling_vigorous: {
    id: "stationary_cycling_vigorous",
    nameRu: "Велотренажер / Сайклинг (интенсивно, > 150 Вт)",
    nameEn: "Stationary cycling, vigorous (150+ watts)",
    category: "cardio",
    defaultMet: 8.8,
    metRange: [7.5, 10.5],
    description: "Compendium code 02014: сайклинг высокой мощности или интервалы.",
  },
  stair_climber: {
    id: "stair_climber",
    nameRu: "Степпер / лестничный тренажер (StairMaster)",
    nameEn: "Stair-treadmill / StairMaster",
    category: "cardio",
    defaultMet: 9.0,
    metRange: [8.0, 10.0],
    description: "Compendium code 17130: подъем по лестнице, мощная нагрузка на ноги и сердце.",
  },
  rowing_machine_moderate: {
    id: "rowing_machine_moderate",
    nameRu: "Гребной тренажер (умеренно, ~100 Вт)",
    nameEn: "Rowing machine, moderate (100 watts)",
    category: "cardio",
    defaultMet: 6.0,
    metRange: [5.0, 7.0],
    description: "Compendium code 02070: одновременная работа ног, спины и плечевого пояса.",
  },
  rowing_machine_vigorous: {
    id: "rowing_machine_vigorous",
    nameRu: "Гребной тренажер (интенсивно, > 150 Вт)",
    nameEn: "Rowing machine, vigorous (150+ watts)",
    category: "cardio",
    defaultMet: 8.5,
    metRange: [7.5, 10.0],
    description: "Compendium code 02072: соревновательный или интервальный гребной спринт.",
  },
  jump_rope: {
    id: "jump_rope",
    nameRu: "Прыжки на скакалке",
    nameEn: "Rope jumping, moderate pace",
    category: "cardio",
    defaultMet: 10.0,
    metRange: [9.0, 12.0],
    description: "Compendium code 15551: интенсивная плиометрическая нагрузка.",
  },
  swimming_moderate: {
    id: "swimming_moderate",
    nameRu: "Плавание (брасс / кроль, средний темп)",
    nameEn: "Swimming laps, moderate",
    category: "cardio",
    defaultMet: 6.0,
    metRange: [5.5, 7.0],
    description: "Compendium code 18240: оздоровительное плавание в бассейне.",
  },

  // Силовые и функциональные нагрузки
  strength_general: {
    id: "strength_general",
    nameRu: "Силовая тренировка в зале (общая / тренажеры)",
    nameEn: "Resistance training, general",
    category: "strength",
    defaultMet: 3.5,
    metRange: [3.0, 4.5],
    description: "Compendium code 02052: подходы с паузами отдыха 1–2 мин между сетами.",
  },
  strength_circuit_vigorous: {
    id: "strength_circuit_vigorous",
    nameRu: "Круговая силовая / Кроссфит (высокая интенсивность)",
    nameEn: "Circuit training / CrossFit, vigorous",
    category: "strength",
    defaultMet: 6.0,
    metRange: [5.0, 7.5],
    description: "Compendium code 02054: упражнения с минимальными паузами отдыха.",
  },
  bodyweight_calisthenics: {
    id: "bodyweight_calisthenics",
    nameRu: "Гимнастика / собственный вес (отжимания, подтягивания, приседы)",
    nameEn: "Calisthenics, moderate effort",
    category: "bodyweight",
    defaultMet: 3.8,
    metRange: [3.5, 5.0],
    description: "Compendium code 02020: работа с весом собственного тела.",
  },
  yoga_pilates: {
    id: "yoga_pilates",
    nameRu: "Йога / Пилатес / Растяжка",
    nameEn: "Yoga / Pilates / Stretching",
    category: "bodyweight",
    defaultMet: 3.0,
    metRange: [2.3, 3.8],
    description: "Compendium code 02150/02160: укрепление постуральных мышц и мобильность.",
  },
};

/**
 * Валидированные уравнения ACSM (American College of Sports Medicine) для беговой дорожки.
 *
 * Формула ходьбы (для скоростей 1.9–6.7 км/ч):
 * VO2 (мл/кг/мин) = 3.5 + 0.1 * S + 1.8 * S * G
 * где S = скорость в м/мин (км/ч * 1000 / 60)
 * G = уклон в долях единицы (напр. 3% = 0.03)
 * MET = VO2 / 3.5
 *
 * Формула бега (для скоростей > 6.7 км/ч):
 * VO2 (мл/кг/мин) = 3.5 + 0.2 * S + 0.9 * S * G
 * MET = VO2 / 3.5
 */
export function calculateAcsmTreadmillMet(params: {
  speedKmh: number;
  inclinePercent?: number | null;
  mode?: "walking" | "running" | "auto";
}): { met: number; formula: string; modeUsed: "walking" | "running" } {
  const { speedKmh, inclinePercent = 0, mode = "auto" } = params;
  const grade = Math.max(0, (inclinePercent ?? 0) / 100);
  const speedMpm = (speedKmh * 1000) / 60; // метры в минуту

  let isRunning = false;
  if (mode === "running") {
    isRunning = true;
  } else if (mode === "walking") {
    isRunning = false;
  } else {
    // В режиме auto граница обычно 6.7–7.0 км/ч
    isRunning = speedKmh > 6.7;
  }

  let vo2: number;
  let formula: string;

  if (isRunning) {
    // Беговое уравнение ACSM
    const horizontalVo2 = 0.2 * speedMpm;
    const verticalVo2 = 0.9 * speedMpm * grade;
    vo2 = 3.5 + horizontalVo2 + verticalVo2;
    formula = `ACSM Бег: VO2 = 3.5 + 0.2×${speedMpm.toFixed(1)} м/мин + 0.9×${speedMpm.toFixed(1)}×${grade} = ${vo2.toFixed(1)} мл/кг/мин → MET ${(vo2 / 3.5).toFixed(1)}`;
  } else {
    // Шаговое уравнение ACSM
    const horizontalVo2 = 0.1 * speedMpm;
    const verticalVo2 = 1.8 * speedMpm * grade;
    vo2 = 3.5 + horizontalVo2 + verticalVo2;
    formula = `ACSM Ходьба: VO2 = 3.5 + 0.1×${speedMpm.toFixed(1)} м/мин + 1.8×${speedMpm.toFixed(1)}×${grade} = ${vo2.toFixed(1)} мл/кг/мин → MET ${(vo2 / 3.5).toFixed(1)}`;
  }

  const met = Math.max(1.0, Math.round((vo2 / 3.5) * 10) / 10);
  return {
    met,
    formula,
    modeUsed: isRunning ? "running" : "walking",
  };
}

/**
 * Подбор наиболее подходящего MET по названию активности и параметрам
 */
export function resolveMetForActivity(params: {
  activityId?: string;
  name?: string;
  speedKmh?: number | null;
  inclinePercent?: number | null;
  category?: "cardio" | "strength" | "machine" | "bodyweight";
}): {
  met: number;
  source: "acsm" | "compendium" | "fallback";
  activityKey: string;
  explanation: string;
} {
  const { activityId, name = "", speedKmh, inclinePercent, category = "cardio" } = params;
  const lowerName = name.toLowerCase();

  // 1. Если прямо передан ID из Compendium
  if (activityId && COMPENDIUM_ACTIVITIES[activityId]) {
    const act = COMPENDIUM_ACTIVITIES[activityId];
    return {
      met: act.defaultMet,
      source: "compendium",
      activityKey: act.id,
      explanation: `${act.nameRu}: ${act.defaultMet} MET (${act.description})`,
    };
  }

  // 2. Если есть беговая дорожка со скоростью (и возможно уклоном) — используем валидированное уравнение ACSM
  const isTreadmill = /дорожк|treadmill/i.test(lowerName);
  const isWalkOrRun = /ходьб|walk|бег|run|джог|jog/i.test(lowerName) || category === "cardio";

  if ((isTreadmill || isWalkOrRun) && speedKmh && speedKmh > 0 && speedKmh <= 30) {
    const explicitWalk = /ходьб|walk|шаг/i.test(lowerName) && !/бег|run/i.test(lowerName);
    const explicitRun = /бег|run|спринт|sprint/i.test(lowerName) && !/ходьб|walk/i.test(lowerName);
    const mode = explicitRun ? "running" : explicitWalk ? "walking" : "auto";

    // Специальный справочный случай: быстрая ходьба около 6.7 км/ч без уклона по Compendium оценивается в 5.8 MET
    if (explicitWalk && Math.abs(speedKmh - 6.7) <= 0.3 && (!inclinePercent || inclinePercent === 0)) {
      return {
        met: 5.8,
        source: "compendium",
        activityKey: "walking_very_brisk",
        explanation: "Compendium code 17220 (быстрая спортивная ходьба ~6.7 км/ч): 5.8 MET",
      };
    }

    const acsm = calculateAcsmTreadmillMet({ speedKmh, inclinePercent, mode });
    return {
      met: acsm.met,
      source: "acsm",
      activityKey: acsm.modeUsed === "running" ? "running_treadmill" : "walking_treadmill",
      explanation: acsm.formula,
    };
  }

  // 3. Сопоставление по ключевым словам в Compendium
  if (/скакалк|прыжк|rope/i.test(lowerName)) {
    const a = COMPENDIUM_ACTIVITIES.jump_rope;
    return { met: a.defaultMet, source: "compendium", activityKey: a.id, explanation: `${a.nameRu} (Compendium: ${a.defaultMet} MET)` };
  }
  if (/степпер|лестниц|stair/i.test(lowerName)) {
    const a = COMPENDIUM_ACTIVITIES.stair_climber;
    return { met: a.defaultMet, source: "compendium", activityKey: a.id, explanation: `${a.nameRu} (Compendium: ${a.defaultMet} MET)` };
  }
  if (/гребл|гребн|row/i.test(lowerName)) {
    const a = COMPENDIUM_ACTIVITIES.rowing_machine_moderate;
    return { met: a.defaultMet, source: "compendium", activityKey: a.id, explanation: `${a.nameRu} (Compendium: ${a.defaultMet} MET)` };
  }
  if (/эллипс|ellipt/i.test(lowerName)) {
    const a = COMPENDIUM_ACTIVITIES.elliptical_moderate;
    return { met: a.defaultMet, source: "compendium", activityKey: a.id, explanation: `${a.nameRu} (Compendium: ${a.defaultMet} MET)` };
  }
  if (/вело|bike|cycl/i.test(lowerName)) {
    const a = COMPENDIUM_ACTIVITIES.stationary_cycling_moderate;
    return { met: a.defaultMet, source: "compendium", activityKey: a.id, explanation: `${a.nameRu} (Compendium: ${a.defaultMet} MET)` };
  }
  if (/плаван|swim|бассейн/i.test(lowerName)) {
    const a = COMPENDIUM_ACTIVITIES.swimming_moderate;
    return { met: a.defaultMet, source: "compendium", activityKey: a.id, explanation: `${a.nameRu} (Compendium: ${a.defaultMet} MET)` };
  }
  if (/йог|пилатес|растяжк|стретч/i.test(lowerName)) {
    const a = COMPENDIUM_ACTIVITIES.yoga_pilates;
    return { met: a.defaultMet, source: "compendium", activityKey: a.id, explanation: `${a.nameRu} (Compendium: ${a.defaultMet} MET)` };
  }
  if (/в гор|наклон|подъем|uphill/i.test(lowerName)) {
    const a = COMPENDIUM_ACTIVITIES.walking_uphill;
    return { met: a.defaultMet, source: "compendium", activityKey: a.id, explanation: `${a.nameRu} (Compendium: ${a.defaultMet} MET)` };
  }
  if (/трусц|джог|jog/i.test(lowerName)) {
    const a = COMPENDIUM_ACTIVITIES.running_jogging;
    return { met: a.defaultMet, source: "compendium", activityKey: a.id, explanation: `${a.nameRu} (Compendium: ${a.defaultMet} MET)` };
  }
  if (/бег|run|спринт|sprint/i.test(lowerName)) {
    const a = COMPENDIUM_ACTIVITIES.running_8kmh;
    return { met: a.defaultMet, source: "compendium", activityKey: a.id, explanation: `${a.nameRu} (Compendium: ${a.defaultMet} MET)` };
  }
  if (/ходьб|walk|прогулк|шаги/i.test(lowerName)) {
    const a = COMPENDIUM_ACTIVITIES.walking_moderate;
    return { met: a.defaultMet, source: "compendium", activityKey: a.id, explanation: `${a.nameRu} (Compendium: ${a.defaultMet} MET)` };
  }

  // 4. Силовые нагрузки
  if (category === "strength" || category === "machine") {
    const a = COMPENDIUM_ACTIVITIES.strength_general;
    return { met: a.defaultMet, source: "compendium", activityKey: a.id, explanation: `${a.nameRu} (Compendium: ${a.defaultMet} MET)` };
  }
  if (category === "bodyweight") {
    const a = COMPENDIUM_ACTIVITIES.bodyweight_calisthenics;
    return { met: a.defaultMet, source: "compendium", activityKey: a.id, explanation: `${a.nameRu} (Compendium: ${a.defaultMet} MET)` };
  }

  return {
    met: 4.0,
    source: "fallback",
    activityKey: "general_physical_activity",
    explanation: "Общая физическая активность средней интенсивности: 4.0 MET",
  };
}
