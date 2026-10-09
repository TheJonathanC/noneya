"use client";

import React, { useEffect } from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import Link from "next/link";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard caught error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#FAF8F5] text-center space-y-4">
      <div className="p-3.5 rounded-2xl bg-[#FEF2F2] border border-[#FCA5A5] text-[#991B1B]">
        <AlertTriangle className="w-8 h-8" />
      </div>

      <div className="space-y-1.5 max-w-md">
        <h2 className="text-base font-bold text-[#1C1917]">
          Inspection Workspace Error
        </h2>
        <p className="text-xs text-[#57534E] leading-relaxed">
          {error?.message || "An unexpected error occurred while rendering the inspection dashboard."}
        </p>
      </div>

      <div className="flex items-center gap-2 pt-2">
        <button
          type="button"
          onClick={() => reset()}
          className="py-2 px-4 rounded-xl bg-[#1C1917] hover:bg-[#2C2724] text-[#FAF8F5] text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reload Interface</span>
        </button>

        <Link
          href="/"
          className="py-2 px-4 rounded-xl border border-[#DDD5C7] bg-[#FFFFFF] hover:bg-[#F3EFE6] text-[#1C1917] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Home className="w-3.5 h-3.5" />
          <span>Back to Home</span>
        </Link>
      </div>
    </div>
  );
}
