import Image from "next/image";

export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-stone-950 p-8 text-center text-stone-100">
      <Image
        src="/icon-192.png"
        alt="Punto 5"
        width={56}
        height={56}
        className="rounded-xl"
      />
      <h1 className="text-2xl font-bold text-stone-100">Sin conexión</h1>
      <p className="text-stone-500">
        No hay conexión a internet. Conéctate de nuevo para continuar usando el
        sistema.
      </p>
    </div>
  );
}
