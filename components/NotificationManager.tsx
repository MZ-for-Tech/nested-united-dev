"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Bell, Volume2, X } from "lucide-react";

interface LiveNotification {
  id: string;
  kind: "message" | "system";
  title: string;
  body: string;
  createdAt: string;
  href: string;
}

interface LiveNotificationResponse {
  events: LiveNotification[];
  cursor: string;
}

const POLL_INTERVAL_MS = 5_000;
const MAX_SEEN_IDS = 500;
const TOAST_LIFETIME_MS = 12_000;

export function NotificationManager() {
  const { data: session, status } = useSession();
  const userId = session?.user?.id;
  const [toasts, setToasts] = useState<LiveNotification[]>([]);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const cursorRef = useRef<string | null>(null);
  const seenRef = useRef<Set<string>>(new Set());
  const audioContextRef = useRef<AudioContext | null>(null);
  const isPollingRef = useRef(false);

  const seenStorageKey = userId ? `nested-notifications-seen:${userId}` : null;

  const rememberSeen = useCallback((ids: string[]) => {
    if (!seenStorageKey || ids.length === 0) return;

    for (const id of ids) seenRef.current.add(id);
    const bounded = Array.from(seenRef.current).slice(-MAX_SEEN_IDS);
    seenRef.current = new Set(bounded);

    try {
      window.localStorage.setItem(seenStorageKey, JSON.stringify(bounded));
    } catch {
      // Notifications still work when storage is disabled; only cross-reload
      // duplicate suppression is unavailable.
    }
  }, [seenStorageKey]);

  const playSound = useCallback(async () => {
    try {
      const AudioContextClass = window.AudioContext
        || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;

      const context = audioContextRef.current || new AudioContextClass();
      audioContextRef.current = context;
      if (context.state === "suspended") await context.resume();
      if (context.state !== "running") return;

      const now = context.currentTime;
      for (const [offset, frequency] of [[0, 880], [0.16, 660]] as const) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.type = "sine";
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.24, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.01, now + offset + 0.12);
        oscillator.start(now + offset);
        oscillator.stop(now + offset + 0.12);
      }
    } catch (error) {
      console.warn("[Notifications] Sound could not be played", error);
    }
  }, []);

  const showEvent = useCallback((event: LiveNotification) => {
    setToasts((current) => {
      if (current.some((item) => item.id === event.id)) return current;
      return [...current, event].slice(-4);
    });

    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== event.id));
    }, TOAST_LIFETIME_MS);

    if ("Notification" in window && Notification.permission === "granted") {
      const notification = new Notification(event.title, {
        body: event.body,
        icon: "/api/company/logo",
        tag: event.id,
      });
      notification.onclick = () => {
        window.focus();
        window.location.assign(event.href);
        notification.close();
      };
    }
  }, []);

  const poll = useCallback(async () => {
    if (!userId || isPollingRef.current) return;
    isPollingRef.current = true;

    try {
      const params = cursorRef.current
        ? `?since=${encodeURIComponent(cursorRef.current)}`
        : "";
      const response = await fetch(`/api/notifications/live${params}`, {
        cache: "no-store",
        credentials: "same-origin",
      });

      if (!response.ok) return;
      const data = await response.json() as LiveNotificationResponse;
      cursorRef.current = data.cursor;

      const fresh = data.events.filter((event) => !seenRef.current.has(event.id));
      if (fresh.length === 0) return;

      rememberSeen(fresh.map((event) => event.id));
      fresh.forEach(showEvent);
      await playSound();
    } catch (error) {
      console.warn("[Notifications] Poll failed", error);
    } finally {
      isPollingRef.current = false;
    }
  }, [playSound, rememberSeen, showEvent, userId]);

  useEffect(() => {
    if (status !== "authenticated" || !userId || !seenStorageKey) return;

    cursorRef.current = null;
    try {
      const stored = JSON.parse(window.localStorage.getItem(seenStorageKey) || "[]");
      seenRef.current = new Set(Array.isArray(stored) ? stored.slice(-MAX_SEEN_IDS) : []);
    } catch {
      seenRef.current = new Set();
    }

    setPermission("Notification" in window ? Notification.permission : "unsupported");
    void poll();
    const timer = window.setInterval(() => void poll(), POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [poll, seenStorageKey, status, userId]);

  const enableNotifications = async () => {
    await playSound();
    if (!("Notification" in window)) {
      setPermission("unsupported");
      return;
    }

    if (Notification.permission === "default") {
      setPermission(await Notification.requestPermission());
    } else {
      setPermission(Notification.permission);
    }
  };

  if (status !== "authenticated") return null;

  return (
    <>
      {permission !== "granted" && permission !== "unsupported" && (
        <button
          type="button"
          onClick={enableNotifications}
          className="fixed bottom-4 left-4 z-[70] flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-xl hover:bg-slate-800"
        >
          <Volume2 className="h-4 w-4" />
          {permission === "denied" ? "تشغيل صوت التنبيهات" : "تفعيل الصوت وإشعارات ويندوز"}
        </button>
      )}

      <div className="fixed left-4 top-20 z-[70] flex w-[min(390px,calc(100vw-2rem))] flex-col gap-3">
        {toasts.map((notification) => (
          <article
            key={notification.id}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-start gap-3 p-4">
              <button
                type="button"
                className="mt-0.5 rounded-lg bg-blue-50 p-2 text-blue-700"
                onClick={() => window.location.assign(notification.href)}
                aria-label="فتح الإشعار"
              >
                <Bell className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => window.location.assign(notification.href)}
                className="min-w-0 flex-1 text-right"
              >
                <span className="block font-bold text-slate-900">{notification.title}</span>
                <span className="mt-1 block line-clamp-3 text-sm text-slate-600">{notification.body}</span>
              </button>
              <button
                type="button"
                onClick={() => setToasts((current) => current.filter((item) => item.id !== notification.id))}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="إغلاق الإشعار"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
