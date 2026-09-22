"use client";

import { useState } from "react";
import { todayKey } from "@/lib/utils";
import {
  evaluateExperiment,
  type ActiveExperiment,
  type ExperimentDayLog,
  type ExperimentEvaluation,
} from "@/lib/experiments/engine";

const STORAGE_KEY = "calorisnap_active_experiment";

function getStoredExperiment(): ActiveExperiment | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function useExperiments(dayLogs: ExperimentDayLog[] = [], currentWeightKg?: number) {
  const [activeExperiment, setActiveExperiment] = useState<ActiveExperiment | null>(getStoredExperiment);

  function startExperiment(protocolId: string, startWeight?: number) {
    const newExp: ActiveExperiment = {
      protocolId,
      startDate: todayKey(),
      startWeightKg: startWeight,
      completedDays: 0,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newExp));
      setActiveExperiment(newExp);
    } catch {
      // Игнорируем
    }
  }

  function cancelExperiment() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      setActiveExperiment(null);
    } catch {
      // Игнорируем
    }
  }

  const evaluation: ExperimentEvaluation | null =
    activeExperiment
      ? evaluateExperiment(activeExperiment, dayLogs, currentWeightKg)
      : null;

  return {
    isLoaded: true,
    activeExperiment,
    evaluation,
    startExperiment,
    cancelExperiment,
  };
}
