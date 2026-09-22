"use client";

import { AlertTriangle, AlertCircle, Info, X, ChevronRight } from "lucide-react";
import type { SmartAlert } from "@/hooks/useSmartAlerts";

interface SmartAlertBannerProps {
  alert: SmartAlert | null;
  onDismiss: (id: string) => void;
  onAction?: (actionType?: string) => void;
}

export function SmartAlertBanner({ alert, onDismiss, onAction }: SmartAlertBannerProps) {
  if (!alert) return null;

  const isWarning = alert.severity === "warning";
  const isDanger = alert.severity === "danger";

  const containerClasses = isDanger
    ? "bg-danger-soft border-danger/30 text-danger"
    : isWarning
    ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
    : "bg-primary-soft/60 border-primary/20 text-primary";

  const icon = isDanger ? (
    <AlertCircle className="h-4 w-4 shrink-0 text-danger mt-0.5" />
  ) : isWarning ? (
    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
  ) : (
    <Info className="h-4 w-4 shrink-0 text-primary mt-0.5" />
  );

  return (
    <aside
      className={`mb-5 flex flex-col gap-2 rounded-2xl border p-3.5 shadow-xs transition-all ${containerClasses}`}
      role="alert"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5">
          {icon}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider">{alert.title}</h3>
            <p className="mt-0.5 text-xs text-foreground/90 font-normal leading-relaxed">
              {alert.message}
            </p>
          </div>
        </div>

        <button
          onClick={() => onDismiss(alert.id)}
          aria-label="Скрыть предупреждение"
          className="rounded-full p-1 text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {alert.actionType === "open_balancer" && (
        <div className="flex justify-end pt-1">
          <button
            onClick={() => onAction?.(alert.actionType)}
            className="flex items-center gap-1 text-xs font-semibold underline hover:opacity-80 transition-opacity"
          >
            <span>{alert.actionLabel ?? "Сбалансировать БЖУ"}</span>
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      )}
    </aside>
  );
}
