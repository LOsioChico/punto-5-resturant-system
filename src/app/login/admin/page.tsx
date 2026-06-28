"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";
import { signInAdmin } from "@/lib/auth";
import { useToast } from "@/components/ui/toast";

export default function AdminLoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Redirect to dashboard if already logged in as admin
  useEffect(() => {
    (async () => {
      const { getCurrentRole } = await import("@/lib/auth");
      const role = await getCurrentRole();
      if (role === "admin") router.replace("/dashboard");
    })();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);

    try {
      await signInAdmin(email.trim(), password);
      toast("Bienvenido", "success");
      router.replace("/dashboard");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Credenciales inválidas", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-stone-950">
      {/* Top bar */}
      <div className="flex items-center gap-3 border-b border-white/5 px-6 py-4">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-stone-300 transition-colors hover:bg-stone-900 hover:text-stone-100"
        >
          <ArrowLeft className="size-4" />
          Volver
        </button>
      </div>

      {/* Login form */}
      <main className="flex flex-1 flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center gap-3">
            <Image
              src="/icon-192.png"
              alt="Punto 5"
              width={56}
              height={56}
              className="rounded-xl"
              priority
            />
            <div>
              <h1 className="text-center text-2xl font-bold text-stone-100">Panel Admin</h1>
              <p className="text-center text-sm text-stone-500">Inicia sesión con tu correo y contraseña</p>
            </div>
          </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-stone-300">
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-stone-800 bg-stone-950 px-4 py-3 text-stone-100 outline-none transition-colors focus:border-yellow-500/50 focus:bg-stone-900"
              placeholder="admin@punto5.co"
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-stone-300">
              Contraseña
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-stone-800 bg-stone-950 px-4 py-3 pr-12 text-stone-100 outline-none transition-colors focus:border-yellow-500/50 focus:bg-stone-900"
                placeholder="••••••••"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 transition-colors hover:text-stone-300"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full rounded-lg bg-yellow-500 px-4 py-3 font-semibold text-stone-950 transition-colors hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Ingresando..." : "Iniciar sesión"}
          </button>
        </form>
        </div>
      </main>
    </div>
  );
}
