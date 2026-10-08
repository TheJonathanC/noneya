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
    none: "border-[#E5DFD3]",
    cyan: "border-[#9A3412]/40",
    emerald: "border-[#166534]/40",
    rose: "border-[#9A3412]/50",
    amber: "border-[#D97706]/40",
  }[accent];

  return (
    <div
      className={clsx(
        "relative rounded-2xl bg-[#FFFFFF] border text-[#1C1917] shadow-xs overflow-hidden",
        accentBorder,
        className
      )}
      {...props}
    >
      {technicalCorners && (
        <div aria-hidden="true">
          <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-[#A8A29E] pointer-events-none" />
          <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-[#A8A29E] pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-[#A8A29E] pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-[#A8A29E] pointer-events-none" />
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
        "px-4 py-3 border-b border-[#E6E0D3] bg-[#F7F4EC] flex items-center justify-between",
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
        "text-xs font-semibold uppercase tracking-wider text-[#1C1917] font-mono flex items-center gap-2 text-balance",
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
