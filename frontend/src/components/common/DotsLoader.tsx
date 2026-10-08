"use client";

import React from "react";
import { DotSwarm } from "dots-swarm";

interface DotsLoaderProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  shape?: "loader" | "atom" | "lattice" | "orb";
}

/**
 * Lightweight particle swarm loader using dots-swarm for analyzing & processing states.
 * Respects measured container bounds and seamlessly loops.
 */
export function DotsLoader({
  size = "md",
  className = "",
  shape = "loader",
}: DotsLoaderProps) {
  const sizeClasses = {
    sm: "w-5 h-5",
    md: "w-16 h-16",
    lg: "w-28 h-28",
  };

  const count = size === "sm" ? 180 : size === "md" ? 450 : 700;
  const dotSize = size === "sm" ? 1.4 : size === "md" ? 1.8 : 2.0;

  return (
    <div
      role="status"
      aria-label="Loading..."
      className={`relative inline-flex items-center justify-center shrink-0 ${sizeClasses[size]} ${className}`}
    >
      <DotSwarm
        shape={shape}
        count={count}
        color="#1C1917"
        speed={1.2}
        dotSize={dotSize}
        choreography="flow"
        className="w-full h-full"
      />
    </div>
  );
}

export default DotsLoader;
