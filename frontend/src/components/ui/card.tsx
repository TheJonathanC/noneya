import * as React from "react";
import { clsx } from "clsx";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  accent?: "none" | "cyan" | "emerald" | "rose" | "amber";
  technicalCorners?: boolean;
}

export function Card({
  className,
  accent = "none",
  technicalCorners = false,
  children,
  ...props
}: CardProps) {
  const accentBorder = {
    none: "border-[#1F2430]",
    cyan: "border-cyan-500/40",
    emerald: "border-emerald-500/40",
    rose: "border-rose-500/40",
    amber: "border-amber-500/40",
  }[accent];

  return (
    <div
      className={clsx(
        "relative rounded-xl bg-[#12141C] border text-slate-100 shadow-xl overflow-hidden",
        accentBorder,
        className
      )}
      {...props}
    >
      {technicalCorners && (
        <div aria-hidden="true">
          <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-slate-600 pointer-events-none" />
          <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-slate-600 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-slate-600 pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-slate-600 pointer-events-none" />
        </div>
      )}
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "px-4 py-3 border-b border-[#1F2430] bg-[#161922] flex items-center justify-between",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={clsx(
        "text-xs font-semibold uppercase tracking-wider text-slate-300 font-mono flex items-center gap-2 text-balance",
        className
      )}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx("p-4", className)} {...props}>
      {children}
    </div>
  );
}
