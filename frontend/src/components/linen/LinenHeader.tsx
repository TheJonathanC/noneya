"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { RotateCcw, LayoutDashboard, PlayCircle, Database } from "lucide-react";

interface LinenHeaderProps {
  onResetAll?: () => void;
  hasActiveInspection?: boolean;
}

export function LinenHeader({
  onResetAll,
  hasActiveInspection = false,
}: LinenHeaderProps) {
  const pathname = usePathname();

  return (
    <header className="border-b border-[#EAE4D7] bg-[#FAF8F5]/90 sticky top-0 z-40 backdrop-blur-md">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-8 py-3 flex items-center justify-between gap-4">
        {/* Brand */}
        <Link href="/" aria-label="Qastra home" className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-[#1C1917] flex items-center justify-center p-1 shadow-xs shrink-0 select-none">
            <svg
              viewBox="0 0 32 32"
              fill="none"
              className="w-full h-full"
              aria-hidden="true"
            >
              <circle
                cx="15"
                cy="14.5"
                r="7"
                stroke="#FAF8F5"
                strokeWidth="2.75"
              />
              <path
                d="M18.5 18L24 23.5"
                stroke="#FAF8F5"
                strokeWidth="2.75"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-[#1C1917]">
              Qastra
            </h1>
            <p className="text-[11px] text-[#78716A]">
              Automated Component Quality Analysis
            </p>
          </div>
        </Link>

        {/* Studio vs Simulation Nav Switcher */}
        <nav className="flex items-center gap-1 bg-[#F3EFE6] p-1 rounded-xl border border-[#E5DFD3] text-xs">
          <Link
            href="/dashboard"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
              pathname === "/dashboard"
                ? "bg-[#1C1917] text-[#FAF8F5] shadow-xs font-semibold"
                : "text-[#57534E] hover:text-[#1C1917] hover:bg-[#FAF8F5]"
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Inspection Studio</span>
          </Link>

          <Link
            href="/simulation"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
              pathname === "/simulation"
                ? "bg-[#1C1917] text-[#FAF8F5] shadow-xs font-semibold"
                : "text-[#57534E] hover:text-[#1C1917] hover:bg-[#FAF8F5]"
            }`}
          >
            <PlayCircle className="w-3.5 h-3.5" />
            <span>Pipeline Simulation</span>
          </Link>

          <Link
            href="/data"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
              pathname === "/data"
                ? "bg-[#1C1917] text-[#FAF8F5] shadow-xs font-semibold"
                : "text-[#57534E] hover:text-[#1C1917] hover:bg-[#FAF8F5]"
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Process Data</span>
          </Link>
        </nav>

        {/* Action: Clean Reset button */}
        {hasActiveInspection && onResetAll && (
          <button
            type="button"
            onClick={onResetAll}
            aria-label="New inspection"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FFFFFF] hover:bg-[#F3EFE6] border border-[#DDD5C7] text-[#57534E] hover:text-[#1C1917] text-xs font-medium transition-[background-color,color,transform] duration-150 active:scale-[0.97] cursor-pointer shadow-xs"
          >
            <RotateCcw aria-hidden="true" className="w-3.5 h-3.5 text-[#78716A]" />
            <span>New Inspection</span>
          </button>
        )}
      </div>
    </header>
  );
}
