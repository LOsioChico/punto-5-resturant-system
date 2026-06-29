"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UtensilsCrossed, LayoutDashboard, Loader2 } from "lucide-react";
import Image from "next/image";
import { useAuth } from "@/lib/hooks/use-auth";

export default function HomePage() {
  const router = useRouter();
  const { user, role, loading } = useAuth();

  // Redirect authenticated users to their app — skip the role selector
  useEffect(() => {
    if (loading) return;
    if (role === "waiter") router.replace("/pos");
    else if (role === "admin") router.replace("/dashboard");
  }, [role, loading, router]);

  // Show spinner while checking auth state — prevents flashing the
  // role selector for already-authenticated users
  if (loading || user) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-stone-950">
        <Loader2 className="size-8 animate-spin text-stone-600" />
      </div>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-10 bg-stone-950 p-8">
      <div className="flex flex-col items-center gap-2">
        <div className="h-1 w-16 rounded-full bg-red-500" />
        <div className="flex items-center gap-3">
          <Image
            src="/icon-192.png"
            alt="Punto 5"
            width={48}
            height={48}
            className="rounded-lg"
            priority
          />
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
          href="/login/waiter"
          className="group flex flex-col items-center gap-3 rounded-xl border border-stone-800 bg-stone-950 p-8 transition-all hover:border-yellow-500/50 hover:bg-stone-900/50 active:scale-[0.98]"
        >
          <div className="flex size-12 items-center justify-center rounded-xl bg-stone-900 transition-colors group-hover:bg-yellow-500/15">
            <UtensilsCrossed className="size-6 text-stone-500 transition-colors group-hover:text-yellow-500" />
          </div>
          <span className="text-base font-semibold text-stone-100">Mesero</span>
          <span className="text-sm text-stone-500">
            Toma pedidos desde la tablet
          </span>
        </Link>

        <Link
          href="/login/admin"
          className="group flex flex-col items-center gap-3 rounded-xl border border-stone-800 bg-stone-950 p-8 transition-all hover:border-yellow-500/50 hover:bg-stone-900/50 active:scale-[0.98]"
        >
          <div className="flex size-12 items-center justify-center rounded-xl bg-stone-900 transition-colors group-hover:bg-yellow-500/15">
            <LayoutDashboard className="size-6 text-stone-500 transition-colors group-hover:text-yellow-500" />
          </div>
          <span className="text-base font-semibold text-stone-100">Administrador</span>
          <span className="text-sm text-stone-500">
            Panel de pedidos en tiempo real
          </span>
        </Link>
      </div>
    </main>
  );
}
