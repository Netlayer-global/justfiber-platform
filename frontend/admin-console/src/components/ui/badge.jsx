import React from "react";
import { cn } from "@/lib/utils";

export function Badge({ className, tone = "default", ...props }) {
  const tones = {
    default: "border-cyan-400/20 bg-cyan-400/10 text-cyan-200",
    success: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
    warning: "border-amber-400/20 bg-amber-400/10 text-amber-200",
    danger: "border-rose-400/20 bg-rose-400/10 text-rose-200"
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.24em]",
        tones[tone],
        className
      )}
      {...props}
    />
  );
}
