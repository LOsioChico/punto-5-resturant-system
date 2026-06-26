"use client";

import type { ActiveWaiter } from "@/lib/types";

/** Top-right — waiters currently active on the POS (presence), as inline pills. */
export function ActiveWaiters({ waiters }: { waiters: ActiveWaiter[] }) {
  if (waiters.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-stone-500">
        <span className="flex size-2 rounded-full bg-stone-600" />
        Sin meseros conectados
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="flex items-center gap-1.5 text-xs font-medium text-stone-600">
        <span className="flex size-2 rounded-full bg-green-500" />
        Meseros
      </span>
      <ul className="flex flex-wrap gap-1.5">
        {waiters.map((w) => (
          <li
            key={w.name}
            className="flex items-center gap-1.5 rounded-full border border-green-500/20 bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-400"
          >
            {w.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
