"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle, Info, X, Clock, ChefHat, Utensils, PlusCircle } from "lucide-react";
import {
  loadNotifications,
  markAllNotificationsRead,
  clearNotifications as clearStoredNotifications,
  type StoredNotification,
} from "@/lib/notifications/db";

type ToastVariant = "success" | "error" | "info" | "status-nueva" | "status-en_cocina" | "status-servida" | "status-finalizada" | "status-adicional";

export interface NotificationItem {
  id: number;
  message: string;
  variant: ToastVariant;
  tableNumber?: number;
  timestamp: number;
  read: boolean;
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant, tableNumber?: number) => void;
  notifications: NotificationItem[];
  unreadCount: number;
  markAllRead: () => void;
  clearNotifications: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const variantConfig: Record<
  ToastVariant,
  { icon: ReactNode; className: string }
> = {
  success: {
    icon: <CheckCircle2 className="size-5 text-green-400" />,
    className: "border-green-500/30",
  },
  error: {
    icon: <XCircle className="size-5 text-red-400" />,
    className: "border-red-500/30",
  },
  info: {
    icon: <Info className="size-5 text-stone-600" />,
    className: "border-stone-700",
  },
  "status-nueva": {
    icon: <Clock className="size-5 text-red-400" />,
    className: "border-red-500/30",
  },
  "status-en_cocina": {
    icon: <ChefHat className="size-5 text-amber-400" />,
    className: "border-amber-500/30",
  },
  "status-servida": {
    icon: <CheckCircle2 className="size-5 text-green-400" />,
    className: "border-green-500/30",
  },
  "status-finalizada": {
    icon: <Utensils className="size-5 text-stone-600" />,
    className: "border-stone-700",
  },
  "status-adicional": {
    icon: <PlusCircle className="size-5 text-blue-400" />,
    className: "border-blue-500/30",
  },
};

/** Map a stored push notification (from IndexedDB) to a NotificationItem. */
function storedToItem(n: StoredNotification): NotificationItem {
  // Parse variant from the tag (e.g. "order-abc-servida") or body text
  const text = `${n.tag} ${n.body}`.toLowerCase();
  let variant: ToastVariant = "info";
  if (text.includes("recibido")) variant = "status-nueva";
  else if (text.includes("cocina")) variant = "status-en_cocina";
  else if (text.includes("finalizado")) variant = "status-finalizada";
  else if (text.includes("servida") || text.includes("servido")) variant = "status-servida";
  else if (text.includes("adicional")) variant = "status-adicional";

  // Extract table number from title (e.g. "Mesa 5" → 5)
  const tableMatch = n.title.match(/Mesa\s+(\d+)/);
  const tableNumber = tableMatch ? parseInt(tableMatch[1], 10) : undefined;

  return {
    id: n.id ?? Date.now(),
    message: `${n.title} — ${n.body}`,
    variant,
    tableNumber,
    timestamp: n.timestamp,
    read: n.read,
  };
}

/** Normalize a message for dedup comparison (strip whitespace, lowercase). */
function normalizeMsg(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

let toastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<NotificationItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // Load persisted notifications from IndexedDB on mount.
  // Deduplicate against notifications already in the list (from realtime
  // channel) by comparing normalized message text within a 10-second window.
  useEffect(() => {
    loadNotifications().then((stored) => {
      if (stored.length === 0) return;
      setNotifications((prev) => {
        const existing = prev.map((n) => ({
          msg: normalizeMsg(n.message),
          ts: n.timestamp,
        }));
        const isDup = (item: NotificationItem) =>
          existing.some(
            (e) =>
              e.msg === normalizeMsg(item.message) &&
              Math.abs(e.ts - item.timestamp) < 10_000,
          );
        const mapped = stored.map(storedToItem).filter((item) => !isDup(item));
        const merged = [...prev, ...mapped];
        return merged.sort((a, b) => b.timestamp - a.timestamp).slice(0, 50);
      });
    });
  }, []);

  // No PUSH_RECEIVED handler — the realtime channel handles foreground
  // notifications (with proper colored icons). IndexedDB handles background
  // notifications (loaded on mount above). This avoids duplicates.

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, variant: ToastVariant = "success", tableNumber?: number) => {
      const id = ++toastId;
      const item: NotificationItem = {
        id,
        message,
        variant,
        tableNumber,
        timestamp: Date.now(),
        read: false,
      };
      setToasts((prev) => [...prev, item]);
      setNotifications((prev) => [item, ...prev].slice(0, 50));
      setTimeout(() => dismiss(id), 4000);
    },
    [dismiss],
  );

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    markAllNotificationsRead();
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    clearStoredNotifications();
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <ToastContext.Provider value={{ toast, notifications, unreadCount, markAllRead, clearNotifications }}>
      {children}
      {/* Toast container — fixed top-right */}
      <div className="pointer-events-none fixed right-4 top-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => {
          const config = variantConfig[t.variant];
          return (
            <div
              key={t.id}
              className={cn(
                "pointer-events-auto flex items-center gap-3 rounded-lg border bg-stone-950 px-4 py-3 shadow-lg animate-in slide-in-from-right",
                config.className,
              )}
            >
              {config.icon}
              <span className="text-sm font-medium text-stone-100">
                {t.message}
              </span>
              <button
                onClick={() => dismiss(t.id)}
                className="ml-2 text-stone-600 hover:text-stone-300"
              >
                <X className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
