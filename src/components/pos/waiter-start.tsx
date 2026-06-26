"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Waiter start screen — enter a name, no auth. */
export function WaiterStart({ onStart }: { onStart: (name: string) => void }) {
  const [name, setName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) return;
    onStart(trimmed);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <div className="flex flex-col items-center gap-3">
        <div className="h-1 w-16 rounded-full bg-red-500" />
        <div className="flex size-14 items-center justify-center rounded-xl bg-yellow-500 text-2xl font-bold text-stone-950">
          P5
        </div>
        <h1 className="text-2xl font-bold text-stone-100">Punto 5 — Mesero</h1>
        <p className="text-sm text-stone-500">Ingresa tu nombre para comenzar</p>
      </div>

      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-3">
        <input
          autoFocus
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tu nombre"
          className="h-12 rounded-lg border border-stone-700 bg-stone-950 px-4 text-base text-stone-100 placeholder:text-stone-600 transition-colors focus:border-yellow-500/50 focus:outline-none"
          minLength={2}
          maxLength={30}
        />
        <Button
          type="submit"
          size="lg"
          disabled={name.trim().length < 2}
          className="h-12 transition-all active:scale-[0.98]"
        >
          Comenzar
        </Button>
      </form>
    </div>
  );
}
