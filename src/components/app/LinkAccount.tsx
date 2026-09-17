"use client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LinkAccount() {
  const { data: user } = useQuery({ queryKey: ["auth-user"], queryFn: async () => (await createClient().auth.getUser()).data.user });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!user?.is_anonymous) return null;
  return <section className="mb-4 rounded-2xl bg-card p-5">
    <p className="mb-3 text-sm">Вы вошли как гость. Привяжите Google, чтобы сохранить доступ к дневнику после выхода или смены устройства.</p>
    <button disabled={busy} className="text-primary" onClick={async () => {
      setBusy(true);
      const { error } = await createClient().auth.linkIdentity({ provider: "google", options: { redirectTo: `${location.origin}/auth/callback` } });
      if (error) { setError(error.message); setBusy(false); }
    }}>Привязать Google</button>
    {error && <p role="alert" className="text-danger">{error}</p>}
  </section>;
}
