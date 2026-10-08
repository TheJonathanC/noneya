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
      "bg-[#EDF7EE] text-[#166534] border-[#C6E6C8] shadow-xs",
    defective:
      "bg-[#FDF2E9] text-[#9A3412] border-[#FCD6C2] shadow-xs",
    warning:
      "bg-[#FEF9E7] text-[#B45309] border-[#FDE68A] shadow-xs",
    cyan: "bg-[#F3EFE6] text-[#7C2D12] border-[#E2DBD0] shadow-xs",
    neutral:
      "bg-[#EFEAE0] text-[#57534E] border-[#DED6C8] shadow-xs",
  }[variant];

  const sizeStyles = {
    sm: "px-2 py-0.5 text-[10px]",
    md: "px-2.5 py-0.5 text-xs font-semibold",
    lg: "px-3 py-1 text-xs tracking-wider font-semibold",
  }[size];

  const dotColors = {
    nominal: "bg-[#16A34A]",
    defective: "bg-[#DC2626] animate-pulse motion-reduce:animate-none",
    warning: "bg-[#D97706]",
    cyan: "bg-[#C2410C]",
    neutral: "bg-[#78716A]",
  }[variant];

  return (
    <div
      className={clsx(
        "inline-flex items-center gap-1.5 font-mono font-medium rounded-md border uppercase select-none tracking-wide",
        variantStyles,
        sizeStyles,
        className
      )}
      {...props}
    >
      {dot && <span aria-hidden="true" className={clsx("w-1.5 h-1.5 rounded-full shrink-0", dotColors)} />}
      {children}
    </div>
  );
}
