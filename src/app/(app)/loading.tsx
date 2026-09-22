export default function AppLoading() {
  return (
    <div className="min-h-dvh bg-background px-4 pt-6 animate-pulse pb-24">
      {/* Шапка */}
      <div className="mb-6 flex items-center justify-between">
        <div className="h-8 w-28 rounded-full bg-card border border-border" />
        <div className="flex gap-2">
          <div className="h-8 w-20 rounded-full bg-card border border-border" />
          <div className="h-8 w-20 rounded-full bg-card border border-border" />
        </div>
      </div>

      {/* Центральная карточка */}
      <div className="mb-6 flex flex-col items-center justify-center p-6 rounded-3xl bg-card border border-border">
        <div className="h-44 w-44 rounded-full border-8 border-muted/50 bg-background/50" />
      </div>

      {/* Карточки контента */}
      <div className="space-y-3">
        <div className="h-24 rounded-2xl bg-card border border-border" />
        <div className="h-24 rounded-2xl bg-card border border-border" />
        <div className="h-24 rounded-2xl bg-card border border-border" />
      </div>
    </div>
  );
}
