import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";
import type { OrderStatus } from "@/lib/types";

const statusConfig: Record<OrderStatus, { label: string; className: string }> = {
  // Red = needs attention — new orders waiting to be sent to kitchen
  nueva: {
    label: "Nueva",
    className: "bg-red-500/15 text-red-400 ring-1 ring-inset ring-red-500/30",
  },
  // Amber = in progress — being prepared
  en_cocina: {
    label: "En cocina",
    className: "bg-amber-500/15 text-amber-400 ring-1 ring-inset ring-amber-500/30",
  },
  // Green = ready — waiting to be served
  lista: {
    label: "Lista",
    className: "bg-green-500/15 text-green-400 ring-1 ring-inset ring-green-500/30",
  },
  // Neutral = done
  servida: {
    label: "Servida",
    className: "bg-stone-800/50 text-stone-600 ring-1 ring-inset ring-stone-600/50",
  },
  // Blue = additional items added
  adicional: {
    label: "Adicional",
    className: "bg-blue-500/15 text-blue-400 ring-1 ring-inset ring-blue-500/30",
  },
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  const config = statusConfig[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        config.className,
      )}
    >
      {config.label}
    </span>
  );
}

export function Badge({
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-stone-900 px-2.5 py-0.5 text-xs font-medium text-stone-300",
        className,
      )}
      {...props}
    />
  );
}
