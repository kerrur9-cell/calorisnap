"use client";

import { useEffect } from "react";

/**
 * Высокопроизводительный контроллер физики скролла (Scroll Inertia & Sway Physics).
 * 
 * Особенности:
 * - 0% влияния на CPU/батарею при отсутствии скролла (RAF останавливается при затухании).
 * - Пассивный слушатель скролла ({ passive: true }), не блокирующий 120 FPS прокрутку.
 * - Прямая запись в CSS-переменные (:root --scroll-tilt, --scroll-shift), без перерендеров React.
 * - Полное GPU-ускорение (translate3d, rotate) через Compositor Thread браузера.
 * - Автоматически отключается при prefers-reduced-motion.
 */
export function ScrollPhysics() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Уважение настроек пользователя по отключению анимаций
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    let lastScrollY = window.scrollY;
    let lastTime = performance.now();
    let currentTilt = 0;
    let currentShift = 0;
    let targetTilt = 0;
    let targetShift = 0;
    let isRunning = false;
    let rafId: number | null = null;

    const rootStyle = document.documentElement.style;

    function tick() {
      // Плавная интерполяция к целевому значению
      const springLerp = 0.22;
      currentTilt += (targetTilt - currentTilt) * springLerp;
      currentShift += (targetShift - currentShift) * springLerp;

      // Пружинящее затухание скорости к 0
      targetTilt *= 0.82;
      targetShift *= 0.82;

      // Запись в CSS переменные без Reflow
      rootStyle.setProperty("--scroll-tilt", `${currentTilt.toFixed(3)}deg`);
      rootStyle.setProperty("--scroll-shift", `${currentShift.toFixed(2)}px`);

      // Если покачивание почти затухло, сбрасываем и глушим цикл (0% CPU в покое)
      if (
        Math.abs(currentTilt) < 0.015 &&
        Math.abs(targetTilt) < 0.015 &&
        Math.abs(currentShift) < 0.04
      ) {
        rootStyle.setProperty("--scroll-tilt", "0deg");
        rootStyle.setProperty("--scroll-shift", "0px");
        isRunning = false;
        rafId = null;
        return;
      }

      rafId = requestAnimationFrame(tick);
    }

    function onScroll() {
      const now = performance.now();
      const currentScrollY = window.scrollY;
      const dt = Math.max(10, now - lastTime);
      const deltaY = currentScrollY - lastScrollY;

      lastScrollY = currentScrollY;
      lastTime = now;

      // Нормализация скорости скролла
      const velocity = (deltaY / dt) * 16.67;

      // Ограничение максимального наклона: до ±3.2° и смещения до ±6px
      targetTilt = Math.max(-3.2, Math.min(3.2, velocity * 0.1));
      targetShift = Math.max(-6, Math.min(6, velocity * 0.18));

      if (!isRunning) {
        isRunning = true;
        rafId = requestAnimationFrame(tick);
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafId) cancelAnimationFrame(rafId);
      rootStyle.setProperty("--scroll-tilt", "0deg");
      rootStyle.setProperty("--scroll-shift", "0px");
    };
  }, []);

  return null;
}
