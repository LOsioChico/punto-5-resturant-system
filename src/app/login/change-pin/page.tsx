"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Delete, ArrowLeft } from "lucide-react";
import { changeWaiterPin, getCurrentWaiter, signOut } from "@/lib/auth";
import { useToast } from "@/components/ui/toast";

export default function ChangePinPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState<"new" | "confirm">("new");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [waiterName, setWaiterName] = useState("");

  useEffect(() => {
    // Verify the user is logged in as a waiter
    (async () => {
      const w = await getCurrentWaiter();
      if (!w) {
        router.replace("/login/waiter");
        return;
      }
      setWaiterName(w.name);
    })();
  }, [router]);

  const handleChangePin = useCallback(async (newPinValue: string, confirmPinValue: string) => {
    if (newPinValue !== confirmPinValue) {
      toast("Los PINs no coinciden", "error");
      setConfirmPin("");
      setStep("new");
      setNewPin("");
      return;
    }

    if (newPinValue === "0000") {
      toast("El PIN no puede ser 0000", "error");
      setConfirmPin("");
      setStep("new");
      setNewPin("");
      return;
    }

    setLoading(true);
    try {
      await changeWaiterPin(newPinValue);
      toast("PIN cambiado correctamente", "success");
      router.replace("/pos");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error al cambiar PIN", "error");
      setConfirmPin("");
      setStep("new");
      setNewPin("");
    } finally {
      setLoading(false);
    }
  }, [router, toast]);

  const handleKeypadPress = useCallback((digit: string) => {
    if (step === "new") {
      if (newPin.length < 4) {
        const newPinValue = newPin + digit;
        setNewPin(newPinValue);
        // Auto-advance to confirm when 4 digits reached
        if (newPinValue.length === 4) {
          setTimeout(() => setStep("confirm"), 200);
        }
      }
    } else {
      if (confirmPin.length < 4) {
        const newConfirm = confirmPin + digit;
        setConfirmPin(newConfirm);
        // Auto-submit when 4 digits reached
        if (newConfirm.length === 4 && !loading) {
          handleChangePin(newPin, newConfirm);
        }
      }
    }
  }, [step, newPin, confirmPin, loading, handleChangePin]);

  const handleBackspace = useCallback(() => {
    if (step === "new") setNewPin((prev) => prev.slice(0, -1));
    else setConfirmPin((prev) => prev.slice(0, -1));
  }, [step]);

  const currentPin = step === "new" ? newPin : confirmPin;

  return (
    <div className="flex min-h-dvh flex-col bg-stone-950">
      {/* Top bar */}
      <div className="flex items-center gap-3 border-b border-white/5 px-6 py-4">
        <button
          onClick={async () => {
            await signOut();
            router.replace("/login/waiter");
          }}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-stone-300 transition-colors hover:bg-stone-900 hover:text-stone-100"
        >
          <ArrowLeft className="size-4" />
          Cerrar sesión
        </button>
      </div>

      {/* Change PIN form */}
      <main className="flex flex-1 flex-col items-center justify-center p-6">
        <div className="w-full max-w-xs">
          <div className="mb-8 flex flex-col items-center gap-3">
            <Image
              src="/icon-192.png"
              alt="Punto 5"
              width={56}
              height={56}
              className="rounded-xl"
              priority
            />
            <h1 className="text-2xl font-bold text-stone-100">Cambiar PIN</h1>
          </div>

        <p className="mb-2 text-center text-sm text-stone-400">
          {step === "new" ? "Ingresa tu nuevo PIN de 4 dígitos" : "Confirma tu nuevo PIN"}
        </p>
        {waiterName && (
          <p className="mb-6 text-center text-xs text-stone-600">{waiterName}</p>
        )}

        <div className="mb-6 flex h-16 items-center justify-center gap-3 rounded-lg border border-stone-800 bg-stone-950">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`size-3 rounded-full transition-colors ${
                i < currentPin.length ? "bg-yellow-500" : "bg-stone-800"
              }`}
            />
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <button
              key={d}
              onClick={() => handleKeypadPress(d)}
              disabled={loading}
              className="flex h-16 items-center justify-center rounded-xl border border-stone-800 bg-stone-900 text-xl font-semibold text-stone-100 transition-all hover:border-stone-700 hover:bg-stone-800 active:scale-95 disabled:opacity-50"
            >
              {d}
            </button>
          ))}
          <div className="flex h-16 items-center justify-center rounded-xl border border-stone-800 bg-stone-900/50 text-sm text-stone-600">
            {step === "confirm" ? "Confirmar" : ""}
          </div>
          <button
            onClick={() => handleKeypadPress("0")}
            disabled={loading}
            className="flex h-16 items-center justify-center rounded-xl border border-stone-800 bg-stone-900 text-xl font-semibold text-stone-100 transition-all hover:border-stone-700 hover:bg-stone-800 active:scale-95 disabled:opacity-50"
          >
            0
          </button>
          <button
            onClick={handleBackspace}
            disabled={loading}
            className="flex h-16 items-center justify-center rounded-xl border border-stone-800 bg-stone-900 text-stone-400 transition-all hover:border-stone-700 hover:bg-stone-800 active:scale-95 disabled:opacity-50"
          >
            <Delete className="size-5" />
          </button>
        </div>
        </div>
      </main>
    </div>
  );
}
