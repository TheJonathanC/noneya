import * as React from "react";
import { clsx } from "clsx";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "nominal" | "defective" | "warning" | "neutral" | "cyan";
  size?: "sm" | "md" | "lg";
  dot?: boolean;
}

export function Badge({
  className,
  variant = "neutral",
  size = "md",
  dot = false,
  children,
  ...props
}: BadgeProps) {
  const variantStyles = {
    nominal:
      "bg-emerald-950/60 text-emerald-300 border-emerald-500/40 shadow-emerald-950/20",
    defective:
      "bg-rose-950/70 text-rose-300 border-rose-500/50 shadow-rose-950/30",
    warning:
      "bg-amber-950/60 text-amber-300 border-amber-500/40 shadow-amber-950/20",
    cyan: "bg-cyan-950/60 text-cyan-300 border-cyan-500/40 shadow-cyan-950/20",
    neutral:
      "bg-slate-900/80 text-slate-300 border-slate-700/60 shadow-slate-950/20",
  }[variant];

  const sizeStyles = {
    sm: "px-1.5 py-0.5 text-[10px]",
    md: "px-2 py-0.5 text-xs",
    lg: "px-2.5 py-1 text-xs tracking-wider",
  }[size];

  const dotColors = {
    nominal: "bg-emerald-400",
    defective: "bg-rose-400 animate-pulse",
    warning: "bg-amber-400",
    cyan: "bg-cyan-400",
    neutral: "bg-slate-400",
  }[variant];

  return (
    <div
      className={clsx(
        "inline-flex items-center gap-1.5 font-mono font-medium rounded border uppercase select-none",
        variantStyles,
        sizeStyles,
        className
      )}
      {...props}
    >
      {dot && <span className={clsx("w-1.5 h-1.5 rounded-full shrink-0", dotColors)} />}
      {children}
    </div>
  );
}
