import Link from "next/link";
import { UtensilsCrossed, LayoutDashboard } from "lucide-react";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-10 p-8">
      <div className="flex flex-col items-center gap-2">
        <div className="h-1 w-16 rounded-full bg-red-500" />
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-yellow-500 text-lg font-bold text-stone-950">
            P5
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-stone-100">
            Punto 5
          </h1>
        </div>
        <p className="text-base text-stone-500">
          Sistema de pedidos en tiempo real
        </p>
      </div>

      <div className="grid w-full max-w-md gap-3 sm:grid-cols-2">
        <Link
          href="/pos"
          className="group flex flex-col items-center gap-3 rounded-xl border border-stone-800 bg-stone-950 p-8 transition-all hover:border-yellow-500/50 hover:bg-stone-900/50 active:scale-[0.98]"
        >
          <div className="flex size-12 items-center justify-center rounded-xl bg-stone-900 transition-colors group-hover:bg-yellow-500/15">
            <UtensilsCrossed className="size-6 text-stone-500 transition-colors group-hover:text-yellow-500" />
          </div>
          <span className="text-base font-semibold text-stone-100">Mesero (POS)</span>
          <span className="text-sm text-stone-500">
            Toma pedidos desde la tablet
          </span>
        </Link>

        <Link
          href="/dashboard"
          className="group flex flex-col items-center gap-3 rounded-xl border border-stone-800 bg-stone-950 p-8 transition-all hover:border-yellow-500/50 hover:bg-stone-900/50 active:scale-[0.98]"
        >
          <div className="flex size-12 items-center justify-center rounded-xl bg-stone-900 transition-colors group-hover:bg-yellow-500/15">
            <LayoutDashboard className="size-6 text-stone-500 transition-colors group-hover:text-yellow-500" />
          </div>
          <span className="text-base font-semibold text-stone-100">Panel principal</span>
          <span className="text-sm text-stone-500">
            Pedidos en tiempo real
          </span>
        </Link>
      </div>
    </main>
  );
}
