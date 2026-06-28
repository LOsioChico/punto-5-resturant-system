"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, Delete, Check } from "lucide-react";
import { signInWaiter } from "@/lib/auth";
import { useToast } from "@/components/ui/toast";

export default function WaiterLoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [cedula, setCedula] = useState("");
  const [pin, setPin] = useState("");
  const [step, setStep] = useState<"cedula" | "pin">("cedula");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { getCurrentRole } = await import("@/lib/auth");
      const role = await getCurrentRole();
      if (role === "waiter") router.replace("/pos");
    })();
  }, [router]);

  const handleCedulaSubmit = useCallback(() => {
    if (!cedula) return;
    setStep("pin");
  }, [cedula]);

  const handlePinSubmit = useCallback(async () => {
    if (pin.length !== 4 || loading) return;
    setLoading(true);

    try {
      const result = await signInWaiter(cedula, pin);
      if (!result.waiter.pin_changed) {
        // First login — must change PIN
        router.replace("/login/change-pin");
      } else {
        toast(`Bienvenido ${result.waiter.name}`, "success");
        router.replace("/pos");
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Credenciales inválidas", "error");
      setPin("");
    } finally {
      setLoading(false);
    }
  }, [cedula, pin, loading, router, toast]);

  const handleKeypadPress = useCallback((digit: string) => {
    if (step === "cedula") {
      setCedula((prev) => prev + digit);
    } else {
      if (pin.length < 4) setPin((prev) => prev + digit);
    }
  }, [step, pin]);

  const handleBackspace = useCallback(() => {
    if (step === "cedula") {
      setCedula((prev) => prev.slice(0, -1));
    } else {
      setPin((prev) => prev.slice(0, -1));
    }
  }, [step]);

  const handleClear = useCallback(() => {
    if (step === "cedula") setCedula("");
    else setPin("");
  }, [step]);

  // Auto-submit PIN when 4 digits entered
  useEffect(() => {
    if (step === "pin" && pin.length === 4 && !loading) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- async callback, setState happens after await
      handlePinSubmit();
    }
  }, [pin, step, loading, handlePinSubmit]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center p-6">
      <div className="w-full max-w-xs">
        <button
          onClick={() => {
            if (step === "pin") {
              setStep("cedula");
              setPin("");
            } else {
              router.push("/");
            }
          }}
          className="mb-6 flex items-center gap-2 text-sm text-stone-500 transition-colors hover:text-stone-300"
        >
          <ArrowLeft className="size-4" />
          {step === "pin" ? "Cambiar cédula" : "Volver"}
        </button>

        <div className="mb-8 flex flex-col items-center gap-3">
          <Image
            src="/icon-192.png"
            alt="Punto 5"
            width={56}
            height={56}
            className="rounded-xl"
            priority
          />
          <h1 className="text-2xl font-bold text-stone-100">Mesero</h1>
        </div>

        {step === "cedula" ? (
          <>
            <p className="mb-6 text-center text-sm text-stone-400">Ingresa tu cédula</p>
            <div className="mb-6 flex h-16 items-center justify-center rounded-lg border border-stone-800 bg-stone-950">
              <span className="text-2xl font-semibold tracking-widest text-stone-100">
                {cedula || <span className="text-stone-700">—</span>}
              </span>
            </div>
            <Keypad
              onPress={handleKeypadPress}
              onBackspace={handleBackspace}
              onClear={handleClear}
              onSubmit={handleCedulaSubmit}
              submitDisabled={!cedula}
            />
          </>
        ) : (
          <>
            <p className="mb-2 text-center text-sm text-stone-400">
              Hola, ingresa tu PIN
            </p>
            <p className="mb-6 text-center text-xs text-stone-600">Cédula: {cedula}</p>
            <div className="mb-6 flex h-16 items-center justify-center gap-3 rounded-lg border border-stone-800 bg-stone-950">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`size-3 rounded-full transition-colors ${
                    i < pin.length ? "bg-yellow-500" : "bg-stone-800"
                  }`}
                />
              ))}
            </div>
            <Keypad
              onPress={handleKeypadPress}
              onBackspace={handleBackspace}
              onClear={handleClear}
              loading={loading}
            />
          </>
        )}
      </div>
    </main>
  );
}

function Keypad({
  onPress,
  onBackspace,
  onClear,
  onSubmit,
  submitDisabled,
  loading,
}: {
  onPress: (digit: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  onSubmit?: () => void;
  submitDisabled?: boolean;
  loading?: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
        <button
          key={d}
          onClick={() => onPress(d)}
          disabled={loading}
          className="flex h-16 items-center justify-center rounded-xl border border-stone-800 bg-stone-900 text-xl font-semibold text-stone-100 transition-all hover:border-stone-700 hover:bg-stone-800 active:scale-95 disabled:opacity-50"
        >
          {d}
        </button>
      ))}
      <button
        onClick={onClear}
        disabled={loading}
        className="flex h-16 items-center justify-center rounded-xl border border-stone-800 bg-stone-900 text-sm text-stone-400 transition-all hover:border-stone-700 hover:bg-stone-800 active:scale-95 disabled:opacity-50"
      >
        Limpiar
      </button>
      <button
        onClick={() => onPress("0")}
        disabled={loading}
        className="flex h-16 items-center justify-center rounded-xl border border-stone-800 bg-stone-900 text-xl font-semibold text-stone-100 transition-all hover:border-stone-700 hover:bg-stone-800 active:scale-95 disabled:opacity-50"
      >
        0
      </button>
      {onSubmit ? (
        <button
          onClick={onSubmit}
          disabled={submitDisabled || loading}
          className="flex h-16 items-center justify-center rounded-xl border border-yellow-500/30 bg-yellow-500/10 text-sm font-semibold text-yellow-500 transition-all hover:bg-yellow-500/20 active:scale-95 disabled:opacity-50"
        >
          <Check className="size-5" />
        </button>
      ) : (
        <button
          onClick={onBackspace}
          disabled={loading}
          className="flex h-16 items-center justify-center rounded-xl border border-stone-800 bg-stone-900 text-stone-400 transition-all hover:border-stone-700 hover:bg-stone-800 active:scale-95 disabled:opacity-50"
        >
          <Delete className="size-5" />
        </button>
      )}
    </div>
  );
}
