import React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-2xl text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-r from-brand-1 via-indigo-500 to-brand-2 px-4 py-2.5 text-white shadow-[0_18px_40px_rgba(56,189,248,0.18)] hover:-translate-y-0.5",
        secondary:
          "border border-white/10 bg-white/5 px-4 py-2.5 text-foreground hover:bg-white/10",
        ghost: "px-3 py-2 text-muted hover:bg-white/5 hover:text-foreground"
      },
      size: {
        default: "",
        sm: "px-3 py-2 text-xs",
        lg: "px-5 py-3 text-base"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export function Button({ className, variant, size, asChild = false, ...props }) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}
