"use client";

import { useState } from "react";
import Image from "next/image";
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
    <div className="flex min-h-dvh flex-col items-center justify-center gap-10 p-8">
      <div className="flex flex-col items-center gap-4">
        <div className="h-1.5 w-20 rounded-full bg-red-500" />
        <Image
          src="/icon-192.png"
          alt="Punto 5"
          width={80}
          height={80}
          className="rounded-xl"
          priority
        />
        <h1 className="text-3xl font-bold text-stone-100">Punto 5 — Mesero</h1>
        <p className="text-base text-stone-500">Ingresa tu nombre para comenzar</p>
      </div>

      <form onSubmit={handleSubmit} className="flex w-full max-w-md flex-col gap-4">
        <input
          autoFocus
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tu nombre"
          className="h-16 rounded-xl border border-stone-700 bg-stone-950 px-5 text-lg text-stone-100 placeholder:text-stone-600 transition-colors focus:border-yellow-500/50 focus:outline-none"
          minLength={2}
          maxLength={30}
        />
        <Button
          type="submit"
          size="lg"
          disabled={name.trim().length < 2}
          className="h-16 text-lg transition-all active:scale-[0.98]"
        >
          Comenzar
        </Button>
      </form>
    </div>
  );
}
