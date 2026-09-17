"use client";

import { AlertCircle, Copy } from "lucide-react";

/**
 * Экран инструкции — показывается когда Supabase не настроен.
 * Не рендерится в продакшене, только при первом запуске.
 */
export default function SetupPage() {
  return (
    <main className="min-h-dvh bg-background px-6 py-12">
      <div className="mx-auto max-w-md">
        <div className="mb-8 flex items-center gap-3">
          <AlertCircle className="h-8 w-8 text-warning" />
          <h1 className="text-2xl font-bold">Настройка проекта</h1>
        </div>

        <p className="mb-6 text-muted-foreground">
          Для работы CaloriSnap нужно подключить Supabase и получить ключ API
          Gemini. Следуйте инструкции:
        </p>

        <ol className="space-y-6">
          <Step
            num={1}
            title="Supabase"
            items={[
              "Зарегистрируйтесь на supabase.com и создайте проект",
              "Откройте SQL Editor и выполните SQL из файла supabase/migrations/0001_init.sql",
              "В seed/0001_foods.sql найдёте базу продуктов (~100 позиций) — тоже выполните",
              'Project Settings → API → скопируйте "Project URL" и "anon public key"',
            ]}
          />

          <Step
            num={2}
            title="Gemini (AI)"
            items={[
              'Перейдите в aistudio.google.com → "Get API key"',
              "Скопируйте ключ",
            ]}
          />

          <Step
            num={3}
            title="Файл .env.local"
            items={[
              "Скопируйте .env.example → .env.local",
              "Впишите три значения:",
            ]}
          />

          <div className="rounded-xl bg-card p-4 font-mono text-sm">
            <code className="block whitespace-pre text-foreground">
              {`NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
GEMINI_API_KEY=AIza...`}
            </code>
            <CopyButton />
          </div>

          <Step
            num={4}
            title="Запуск"
            items={[
              "Перезапустите dev-сервер: npm run dev",
              "Откройте http://localhost:3000",
            ]}
          />
        </ol>
      </div>
    </main>
  );
}

function Step({
  num,
  title,
  items,
}: {
  num: number;
  title: string;
  items: string[];
}) {
  return (
    <li>
      <div className="mb-1 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
          {num}
        </span>
        <h2 className="font-semibold">{title}</h2>
      </div>
      <ul className="ml-8 mt-1 list-disc space-y-1 text-sm text-muted-foreground">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </li>
  );
}

function CopyButton() {
  return (
    <button
      onClick={() =>
        navigator.clipboard.writeText(
          "NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co\nNEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...\nGEMINI_API_KEY=AIza...",
        )
      }
      className="mt-3 flex items-center gap-1 rounded-lg bg-muted px-3 py-1 text-xs text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
    >
      <Copy className="h-3 w-3" /> Копировать шаблон
    </button>
  );
}
