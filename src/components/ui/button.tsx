import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500/50 disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        default: "bg-yellow-500 text-stone-950 hover:bg-yellow-400",
        secondary: "bg-stone-800 text-stone-100 hover:bg-stone-700",
        outline:
          "border border-stone-700 bg-transparent hover:border-stone-600 hover:bg-stone-800",
        ghost: "hover:bg-stone-800",
        destructive: "bg-red-500 text-white hover:bg-red-600",
      },
      size: {
        default: "h-10 px-4 text-sm",
        sm: "h-8 px-3 text-sm",
        lg: "h-12 px-6 text-base",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({
  className,
  variant,
  size,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
