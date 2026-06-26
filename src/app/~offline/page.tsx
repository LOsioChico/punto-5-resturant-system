export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-stone-950 p-8 text-center text-stone-100">
      <div className="flex size-14 items-center justify-center rounded-xl bg-yellow-500 text-2xl font-bold text-stone-950">
        P5
      </div>
      <h1 className="text-2xl font-bold text-stone-100">Sin conexión</h1>
      <p className="text-stone-500">
        No hay conexión a internet. Conéctate de nuevo para continuar usando el
        sistema.
      </p>
    </div>
  );
}
