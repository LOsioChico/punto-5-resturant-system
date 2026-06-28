"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, UserPlus, UserX, UserCheck, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/hooks/use-auth";
import { useToast } from "@/components/ui/toast";
import { createSupabaseClient } from "@/lib/supabase/client";
import type { Waiter } from "@/lib/types";

export default function WaitersManagementPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const supabase = createSupabaseClient();

  const [waiters, setWaiters] = useState<Waiter[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCedula, setNewCedula] = useState("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const loadWaiters = useCallback(async () => {
    if (!supabase) return;
    // Call the edge function to list waiters
    const { data: session } = await supabase.auth.getSession();
    if (!session.session?.access_token) return;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const res = await fetch(`${supabaseUrl}/functions/v1/manage-waiters/list-waiters`, {
      headers: { Authorization: `Bearer ${session.session.access_token}` },
    });

    if (!res.ok) {
      toast("Error al cargar meseros", "error");
      setLoading(false);
      return;
    }

    const data = await res.json();
    setWaiters(data as Waiter[]);
    setLoading(false);
  }, [supabase, toast]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login/admin");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async data fetch, setState happens after await
    loadWaiters();
  }, [user, authLoading, router, loadWaiters]);

  async function handleCreate() {
    if (!supabase || !newCedula || !newName) return;
    setCreating(true);

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.access_token) return;

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/manage-waiters/create-waiter`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cedula: newCedula.trim(), name: newName.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast(data.error ?? "Error al crear mesero", "error");
        return;
      }

      toast(`Mesero creado. PIN inicial: 0000`, "success");
      setNewCedula("");
      setNewName("");
      setShowCreateForm(false);
      loadWaiters();
    } catch {
      toast("Error al crear mesero", "error");
    } finally {
      setCreating(false);
    }
  }

  async function handleToggle(waiter: Waiter) {
    if (!supabase) return;
    setTogglingId(waiter.id);

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.access_token) return;

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/manage-waiters/toggle-waiter`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ waiter_id: waiter.id, is_active: !waiter.is_active }),
      });

      if (!res.ok) {
        toast("Error al cambiar estado", "error");
        return;
      }

      toast(waiter.is_active ? "Mesero desactivado" : "Mesero activado", "success");
      loadWaiters();
    } finally {
      setTogglingId(null);
    }
  }

  if (authLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-stone-500">
        Cargando...
      </div>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col bg-stone-950">
      {/* Top bar */}
      <div className="flex items-center justify-between bg-stone-900 px-6 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-2 text-sm text-stone-500 transition-colors hover:text-stone-300"
          >
            <ArrowLeft className="size-4" />
            Volver
          </button>
        </div>
        <div className="flex items-center gap-3">
          <Image src="/icon-192.png" alt="Punto 5" width={28} height={28} className="rounded-lg" />
          <h1 className="text-base font-bold text-stone-100">Gestión de Meseros</h1>
        </div>
      </div>

      <div className="mx-auto w-full max-w-2xl flex-1 p-6">
        {/* Create button */}
        <div className="mb-6">
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="flex items-center gap-2 rounded-lg bg-yellow-500 px-4 py-2.5 font-semibold text-stone-950 transition-colors hover:bg-yellow-400"
          >
            <UserPlus className="size-5" />
            Nuevo mesero
          </button>
        </div>

        {/* Create form */}
        {showCreateForm && (
          <div className="mb-6 rounded-xl border border-stone-800 bg-stone-900 p-6">
            <h2 className="mb-4 text-lg font-semibold text-stone-100">Crear nuevo mesero</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-stone-300">
                  Cédula
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="\d*"
                  value={newCedula}
                  onChange={(e) => setNewCedula(e.target.value.replace(/\D/g, ""))}
                  className="w-full rounded-lg border border-stone-800 bg-stone-950 px-4 py-3 text-stone-100 outline-none focus:border-yellow-500/50"
                  placeholder="1234567890"
                  disabled={creating}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-stone-300">
                  Nombre completo
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full rounded-lg border border-stone-800 bg-stone-950 px-4 py-3 text-stone-100 outline-none focus:border-yellow-500/50"
                  placeholder="Juan Pérez"
                  disabled={creating}
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleCreate}
                  disabled={creating || !newCedula || !newName}
                  className="flex items-center gap-2 rounded-lg bg-yellow-500 px-4 py-2.5 font-semibold text-stone-950 transition-colors hover:bg-yellow-400 disabled:opacity-50"
                >
                  {creating ? <Loader2 className="size-5 animate-spin" /> : <UserCheck className="size-5" />}
                  Crear
                </button>
                <button
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewCedula("");
                    setNewName("");
                  }}
                  className="rounded-lg border border-stone-800 px-4 py-2.5 text-stone-400 transition-colors hover:bg-stone-800"
                  disabled={creating}
                >
                  Cancelar
                </button>
              </div>
              <p className="text-sm text-stone-500">
                El PIN inicial es <span className="font-mono font-semibold text-stone-300">0000</span>.
                El mesero deberá cambiarlo en su primer ingreso.
              </p>
            </div>
          </div>
        )}

        {/* Waiters list */}
        {loading ? (
          <div className="flex items-center justify-center py-12 text-stone-500">
            <Loader2 className="size-6 animate-spin" />
          </div>
        ) : waiters.length === 0 ? (
          <div className="py-12 text-center text-stone-500">
            No hay meseros registrados. Crea el primero con el botón de arriba.
          </div>
        ) : (
          <div className="space-y-2">
            {waiters.map((w) => (
              <div
                key={w.id}
                className="flex items-center justify-between rounded-xl border border-stone-800 bg-stone-900 px-5 py-4"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`flex size-10 items-center justify-center rounded-full ${
                      w.is_active ? "bg-green-500/10 text-green-400" : "bg-stone-800 text-stone-600"
                    }`}
                  >
                    {w.is_active ? <UserCheck className="size-5" /> : <UserX className="size-5" />}
                  </div>
                  <div>
                    <p className="font-semibold text-stone-100">{w.name}</p>
                    <p className="text-sm text-stone-500">
                      Cédula: {w.cedula}
                      {!w.pin_changed && (
                        <span className="ml-2 rounded bg-yellow-500/10 px-2 py-0.5 text-xs text-yellow-500">
                          PIN sin cambiar
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleToggle(w)}
                  disabled={togglingId === w.id}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
                    w.is_active
                      ? "border border-stone-700 text-stone-400 hover:bg-stone-800"
                      : "bg-green-500/10 text-green-400 hover:bg-green-500/20"
                  }`}
                >
                  {togglingId === w.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : w.is_active ? (
                    "Desactivar"
                  ) : (
                    "Activar"
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
