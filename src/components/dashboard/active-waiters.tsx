"use client";

import { useState } from "react";
import { Users, ChevronDown } from "lucide-react";
import type { ActiveWaiter } from "@/lib/types";

/** Top-right — waiters currently active on the POS (presence). */
export function ActiveWaiters({ waiters }: { waiters: ActiveWaiter[] }) {
  const [open, setOpen] = useState(false);

  if (waiters.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-stone-500">
        <span className="flex size-2 rounded-full bg-stone-600" />
        <span className="hidden sm:inline">Sin meseros conectados</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-stone-300 transition-colors hover:bg-stone-800 hover:text-stone-100"
      >
        <span className="relative flex size-2.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-500 opacity-60" />
          <span className="relative inline-flex size-2.5 rounded-full bg-green-500" />
        </span>
        <span className="hidden max-w-[120px] truncate font-medium sm:inline">
          {waiters.length === 1 ? waiters[0].name : `${waiters.length} meseros`}
        </span>
        <ChevronDown className={`size-4 text-stone-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-lg border border-white/10 bg-stone-950 shadow-xl">
            <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
              <Users className="size-4 text-green-400" />
              <span className="text-sm font-semibold text-stone-200">
                Meseros conectados
              </span>
              <span className="ml-auto rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-400">
                {waiters.length}
              </span>
            </div>
            <ul className="max-h-60 overflow-y-auto py-1">
              {waiters.map((w) => (
                <li
                  key={w.name}
                  className="flex items-center gap-3 px-4 py-2.5"
                >
                  <div className="flex size-8 items-center justify-center rounded-full bg-green-500/10 text-xs font-semibold text-green-400">
                    {w.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-stone-200">
                      {w.name}
                    </p>
                    <p className="text-xs text-stone-500">
                      Conectado {timeAgo(w.joinedAt)}
                    </p>
                  </div>
                  <span className="flex size-2 rounded-full bg-green-500" />
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

/** Human-readable "x min ago" from an ISO timestamp. */
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins === 1) return "hace 1 min";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours === 1) return "hace 1 h";
  if (hours < 24) return `hace ${hours} h`;
  return "hace +1 d";
}
