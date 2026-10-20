"use client";

import { usePathname } from "next/navigation";

export function AppFooter() {
  const pathname = usePathname();
  // На странице AI-сериалов не показываем лишний футер, чтобы видео не пряталось под таб-бар
  if (pathname.startsWith("/dramas")) return null;

  return (
    <footer className="px-4 pb-2 text-center text-xs text-muted-foreground">
      Данные о части продуктов:{" "}
      <a href="https://world.openfoodfacts.org" className="underline">
        Open Food Facts
      </a>{" "}
      (ODbL)
    </footer>
  );
}
