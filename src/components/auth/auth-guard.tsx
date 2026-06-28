"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/lib/hooks/use-auth";
import type { AuthRole } from "@/lib/types";

/**
 * Auth guard — wraps a page and ensures the user is authenticated
 * with the required role. Redirects to the appropriate login page
 * if not authenticated.
 */
export function AuthGuard({
  role,
  children,
}: {
  role: AuthRole;
  children: ReactNode;
}) {
  const router = useRouter();
  const { user, role: userRole, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(role === "admin" ? "/login/admin" : "/login/waiter");
      return;
    }
    if (userRole !== role) {
      // Wrong role — redirect to correct page
      if (userRole === "admin") router.replace("/dashboard");
      else if (userRole === "waiter") router.replace("/pos");
      else router.replace("/");
    }
  }, [user, userRole, role, loading, router]);

  if (loading || !user || userRole !== role) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4">
        <Image
          src="/icon-192.png"
          alt="Punto 5"
          width={48}
          height={48}
          className="rounded-lg animate-pulse"
        />
        <p className="text-sm text-stone-500">Cargando...</p>
      </main>
    );
  }

  return <>{children}</>;
}
