"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

export interface ViewedFriend {
  id: string;
  displayName: string;
  code?: string;
  avatarUrl?: string | null;
}

interface FriendViewContextType {
  isGuestView: boolean;
  viewedFriend: ViewedFriend | null;
  targetUserId: string | null;
  enterGuestView: (friend: ViewedFriend) => void;
  exitGuestView: () => void;
}

const FriendViewContext = createContext<FriendViewContextType>({
  isGuestView: false,
  viewedFriend: null,
  targetUserId: null,
  enterGuestView: () => {},
  exitGuestView: () => {},
});

const STORAGE_KEY = "calorisnap_viewed_friend";

export function FriendViewProvider({ children }: { children: React.ReactNode }) {
  const [viewedFriend, setViewedFriend] = useState<ViewedFriend | null>(null);
  const router = useRouter();

  // Инициализация из sessionStorage
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        const stored = sessionStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && typeof parsed.id === "string") {
            queueMicrotask(() => {
              setViewedFriend(parsed);
            });
          }
        }
      }
    } catch {
      // игнорируем ошибку чтения sessionStorage
    }
  }, []);

  const enterGuestView = useCallback((friend: ViewedFriend) => {
    setViewedFriend(friend);
    try {
      if (typeof window !== "undefined") {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(friend));
      }
    } catch {
      // игнорируем ошибку записи sessionStorage
    }
    router.push("/day");
  }, [router]);

  const exitGuestView = useCallback(() => {
    setViewedFriend(null);
    try {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // игнорируем ошибку удаления sessionStorage
    }
    router.push("/profile");
  }, [router]);

  return (
    <FriendViewContext.Provider
      value={{
        isGuestView: !!viewedFriend,
        viewedFriend,
        targetUserId: viewedFriend ? viewedFriend.id : null,
        enterGuestView,
        exitGuestView,
      }}
    >
      {children}
    </FriendViewContext.Provider>
  );
}

export function useFriendView() {
  return useContext(FriendViewContext);
}
