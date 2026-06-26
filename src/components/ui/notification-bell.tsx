"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Bell, X, Clock, ChefHat, CheckCircle2, Utensils, Info } from "lucide-react";
import { useToast, type NotificationItem } from "./toast";

const variantIcon: Record<string, React.ReactNode> = {
  success: <CheckCircle2 className="size-4 text-green-400" />,
  error: <X className="size-4 text-red-400" />,
  info: <Info className="size-4 text-stone-600" />,
  "status-nueva": <Clock className="size-4 text-blue-400" />,
  "status-en_cocina": <ChefHat className="size-4 text-amber-400" />,
  "status-lista": <CheckCircle2 className="size-4 text-green-400" />,
  "status-servida": <Utensils className="size-4 text-stone-600" />,
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "ahora";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} h`;
  return `${Math.floor(hr / 24)} d`;
}

export function NotificationBell() {
  const { notifications, unreadCount, markAllRead, clearNotifications } = useToast();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          setOpen(!open);
          if (!open && unreadCount > 0) markAllRead();
        }}
        className="relative flex size-9 items-center justify-center rounded-lg text-stone-600 transition-colors hover:bg-stone-900 hover:text-stone-200"
      >
        <Bell className="size-5" />
        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-lg border border-white/10 bg-stone-950 shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <span className="text-sm font-semibold text-stone-100">
              Notificaciones
            </span>
            {notifications.length > 0 && (
              <button
                onClick={clearNotifications}
                className="text-xs text-stone-500 transition-colors hover:text-stone-300"
              >
                Limpiar
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
                <Bell className="size-6 text-stone-700" />
                <p className="text-sm text-stone-600">Sin notificaciones</p>
              </div>
            ) : (
              <ul className="divide-y divide-white/5">
                {notifications.map((n: NotificationItem) => (
                  <li
                    key={n.id}
                    className={cn(
                      "flex items-start gap-3 px-4 py-3",
                      !n.read && "bg-stone-900/30",
                    )}
                  >
                    <span className="mt-0.5 shrink-0">
                      {variantIcon[n.variant] ?? <Info className="size-4 text-stone-600" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-stone-200">{n.message}</p>
                      <p className="mt-0.5 text-xs text-stone-600">
                        {timeAgo(n.timestamp)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
