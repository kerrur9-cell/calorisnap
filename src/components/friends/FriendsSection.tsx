"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useFriendView } from "@/context/FriendViewContext";
import { formatFriendCodeInput, isValidFriendCode, normalizeFriendCode } from "@/lib/friends/code";
import {
  Users,
  Copy,
  Check,
  Share2,
  RefreshCw,
  UserPlus,
  ShieldAlert,
  ArrowRight,
  UserMinus,
  Loader2,
  UserCheck,
} from "lucide-react";

interface FriendItem {
  owner_id: string;
  display_name: string;
  avatar_url?: string | null;
  connected_at: string;
}

interface ViewerItem {
  viewer_id: string;
  display_name: string;
  avatar_url?: string | null;
  connected_at: string;
}

export function FriendsSection() {
  const queryClient = useQueryClient();
  const { enterGuestView } = useFriendView();

  const [inputCode, setInputCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connectSuccess, setConnectSuccess] = useState<string | null>(null);

  // 1. Мой код доступа
  const { data: myCode, isLoading: codeLoading } = useQuery({
    queryKey: ["my-friend-code"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("generate_or_get_friend_code");
      if (error) throw error;
      return (data ?? "") as string;
    },
    staleTime: 60 * 1000,
  });

  // 2. Список друзей (к чьим данным у меня есть доступ)
  const { data: friends = [], isLoading: friendsLoading } = useQuery<FriendItem[]>({
    queryKey: ["my-friends"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("get_my_friends");
      if (error) throw error;
      return (data ?? []) as FriendItem[];
    },
  });

  // 3. Список зрителей (кто имеет доступ ко мне)
  const { data: viewers = [], isLoading: viewersLoading } = useQuery<ViewerItem[]>({
    queryKey: ["my-viewers"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("get_my_viewers");
      if (error) throw error;
      return (data ?? []) as ViewerItem[];
    },
  });

  // Мутация: обновить код
  const refreshMutation = useMutation({
    mutationFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("refresh_friend_code");
      if (error) throw error;
      return (data ?? "") as string;
    },
    onSuccess: (newCode) => {
      queryClient.setQueryData(["my-friend-code"], newCode);
    },
  });

  // Мутация: подключиться по коду
  const connectMutation = useMutation({
    mutationFn: async (code: string) => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("connect_friend_by_code", {
        p_code: code.trim().toUpperCase(),
      });
      if (error) throw error;
      return data as { owner_id: string; display_name: string; code: string };
    },
    onSuccess: (data) => {
      setConnectError(null);
      setConnectSuccess(`Вы успешно подключились к пользователю ${data.display_name}!`);
      setInputCode("");
      queryClient.invalidateQueries({ queryKey: ["my-friends"] });
    },
    onError: (err: Error) => {
      setConnectSuccess(null);
      setConnectError(err.message || "Не удалось подключиться к другу");
    },
  });

  // Мутация: отключиться от друга
  const disconnectMutation = useMutation({
    mutationFn: async (ownerId: string) => {
      const supabase = createClient();
      const { error } = await supabase.rpc("disconnect_from_friend", {
        p_owner_id: ownerId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-friends"] });
    },
  });

  // Мутация: отозвать доступ у зрителя
  const revokeMutation = useMutation({
    mutationFn: async (viewerId: string) => {
      const supabase = createClient();
      const { error } = await supabase.rpc("revoke_viewer_access", {
        p_viewer_id: viewerId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-viewers"] });
    },
  });

  const handleCopyCode = async () => {
    if (!myCode) return;
    try {
      await navigator.clipboard.writeText(myCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleShareCode = async () => {
    if (!myCode) return;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "CaloriSnap — Код друга",
          text: `Мой код в CaloriSnap для совместного отслеживания питания и тренировок: ${myCode}`,
        });
      } catch {
        // отмена пользователем
      }
    } else {
      await handleCopyCode();
    }
  };

  const handleRefreshCode = () => {
    if (confirm("Вы уверены, что хотите обновить свой код? Прежний код станет недействителен для новых подключений.")) {
      refreshMutation.mutate();
    }
  };

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    setConnectError(null);
    setConnectSuccess(null);

    const trimmed = normalizeFriendCode(inputCode);
    if (!trimmed) {
      setConnectError("Введите код друга");
      return;
    }

    if (!isValidFriendCode(trimmed)) {
      setConnectError("Неверный формат кода. Ожидается CAL-XXXX-XXXX");
      return;
    }

    if (trimmed === myCode) {
      setConnectError("Нельзя добавить свой собственный код");
      return;
    }

    connectMutation.mutate(trimmed);
  };

  return (
    <section className="glass-card glossy-sheen scroll-sway mb-4 rounded-3xl p-5 shadow-md space-y-5">
      <div className="flex items-center gap-2 font-semibold text-foreground">
        <Users className="h-5 w-5 text-primary" />
        <h2 className="text-base font-bold">Друзья и гостевой доступ</h2>
      </div>

      {/* Блок 1: Мой персональный код */}
      <div className="rounded-2xl bg-muted/40 p-4 border border-border/60 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Ваш персональный код
          </span>
          <button
            onClick={handleRefreshCode}
            disabled={refreshMutation.isPending || codeLoading}
            title="Обновить код"
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
            Обновить код
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 rounded-xl bg-background/90 px-3.5 py-2.5 border border-border">
          <span className="font-mono text-base font-bold tracking-widest text-primary tabular-nums">
            {codeLoading ? "CAL-••••-••••" : myCode || "—"}
          </span>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleCopyCode}
              disabled={!myCode}
              className="btn-glossy spring-press flex items-center gap-1 rounded-lg bg-primary-soft border border-primary/20 px-2.5 py-1 text-xs font-semibold text-primary shadow-2xs hover:bg-primary hover:text-primary-foreground transition-colors"
              title="Скопировать код"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Скопирован" : "Копировать"}
            </button>
            <button
              onClick={handleShareCode}
              disabled={!myCode}
              className="btn-glossy spring-press flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-muted-foreground border border-border hover:text-foreground transition-colors"
              title="Поделиться кодом"
            >
              <Share2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Передайте этот код другу, чтобы он мог просматривать ваш дневник питания, тренировки и динамику веса в режиме чтения.
        </p>
      </div>

      {/* Блок 2: Ввести код друга */}
      <form onSubmit={handleConnect} className="space-y-2">
        <label htmlFor="friend-code-input" className="block text-xs font-semibold text-muted-foreground">
          Подключиться по коду друга
        </label>
        <div className="flex gap-2">
          <input
            id="friend-code-input"
            type="text"
            placeholder="CAL-XXXX-XXXX"
            value={inputCode}
            onChange={(e) => {
              const val = e.target.value;
              setInputCode(val.length > inputCode.length ? formatFriendCodeInput(val) : val.toUpperCase());
              setConnectError(null);
            }}
            maxLength={13}
            className="flex-1 rounded-2xl border border-border bg-background/80 px-3.5 py-2.5 font-mono text-sm tracking-wider uppercase outline-none focus:border-primary shadow-2xs"
          />
          <button
            type="submit"
            disabled={connectMutation.isPending || !inputCode.trim()}
            className="btn-glossy spring-press flex items-center gap-1.5 rounded-2xl bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-xs disabled:opacity-50"
          >
            {connectMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            Подключить
          </button>
        </div>

        {connectError && (
          <p role="alert" className="text-xs text-danger flex items-center gap-1 mt-1">
            <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
            {connectError}
          </p>
        )}

        {connectSuccess && (
          <p className="text-xs text-success flex items-center gap-1 mt-1">
            <Check className="h-3.5 w-3.5 shrink-0" />
            {connectSuccess}
          </p>
        )}
      </form>

      {/* Блок 3: Мои друзья (к чьим профилям у меня есть доступ) */}
      <div className="space-y-2 pt-2 border-t border-border/50">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Мои друзья ({friends.length})
          </h3>
          <span className="text-[11px] text-muted-foreground">
            Чьи профили доступны для просмотра
          </span>
        </div>

        {friendsLoading ? (
          <div className="py-4 text-center text-xs text-muted-foreground">Загрузка друзей…</div>
        ) : friends.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 p-4 text-center text-xs text-muted-foreground">
            У вас пока нет подключённых друзей. Введите код друга выше, чтобы наблюдать за его дневником.
          </div>
        ) : (
          <div className="space-y-2">
            {friends.map((f) => (
              <div
                key={f.owner_id}
                className="flex items-center justify-between gap-2 rounded-2xl bg-muted/30 border border-border/50 p-3 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-soft text-primary font-bold text-sm shrink-0 border border-primary/20">
                    {(f.display_name || "Д").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-xs text-foreground truncate">
                      {f.display_name}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Доступ с {new Date(f.connected_at).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" })}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() =>
                      enterGuestView({
                        id: f.owner_id,
                        displayName: f.display_name,
                      })
                    }
                    className="btn-glossy spring-press flex items-center gap-1 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-2xs"
                  >
                    Перейти
                    <ArrowRight className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Отключиться от профиля «${f.display_name}»?`)) {
                        disconnectMutation.mutate(f.owner_id);
                      }
                    }}
                    title="Отключиться"
                    className="spring-press flex h-7 w-7 items-center justify-center rounded-xl text-muted-foreground hover:bg-danger-soft hover:text-danger transition-colors"
                  >
                    <UserMinus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Блок 4: Кто имеет доступ ко мне */}
      <div className="space-y-2 pt-2 border-t border-border/50">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Кто имеет доступ ко мне ({viewers.length})
          </h3>
          <span className="text-[11px] text-muted-foreground">
            Зрители вашего дневника
          </span>
        </div>

        {viewersLoading ? (
          <div className="py-4 text-center text-xs text-muted-foreground">Загрузка зрителей…</div>
        ) : viewers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 p-4 text-center text-xs text-muted-foreground">
            Ни у кого нет доступа к вашему профилю. Поделитесь своим кодом, чтобы открыть просмотр.
          </div>
        ) : (
          <div className="space-y-2">
            {viewers.map((v) => (
              <div
                key={v.viewer_id}
                className="flex items-center justify-between gap-2 rounded-2xl bg-muted/30 border border-border/50 p-3 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-secondary-foreground font-bold text-sm shrink-0 border border-border">
                    <UserCheck className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-xs text-foreground truncate">
                      {v.display_name}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Подключён {new Date(v.connected_at).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" })}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (confirm(`Отозвать доступ у пользователя «${v.display_name}»? Он больше не сможет видеть ваши данные.`)) {
                      revokeMutation.mutate(v.viewer_id);
                    }
                  }}
                  className="spring-press flex items-center gap-1 rounded-xl bg-danger-soft/80 border border-danger/20 px-2.5 py-1 text-xs font-medium text-danger hover:bg-danger-soft transition-colors"
                >
                  <UserMinus className="h-3 w-3" />
                  Отозвать
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
