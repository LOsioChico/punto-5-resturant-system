import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/** Reusable empty state with icon, title, and description. */
export function EmptyState({
  icon,
  title,
  description,
  className,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-full flex-col items-center justify-center gap-3 p-8 text-center",
        className,
      )}
    >
      <div className="flex size-16 items-center justify-center rounded-full bg-stone-900">
        {icon && <span className="text-stone-600">{icon}</span>}
      </div>
      <p className="text-sm font-medium text-stone-600">{title}</p>
      {description && (
        <p className="max-w-xs text-xs text-stone-600">{description}</p>
      )}
    </div>
  );
}
