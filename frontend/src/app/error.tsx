"use client";

import React, { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#FAF8F5] text-center space-y-4">
      <div className="p-3.5 rounded-2xl bg-[#FEF2F2] border border-[#FCA5A5] text-[#991B1B]">
        <AlertTriangle className="w-8 h-8" />
      </div>

      <div className="space-y-1.5 max-w-md">
        <h2 className="text-base font-bold text-[#1C1917]">
          Application Encountered an Error
        </h2>
        <p className="text-xs text-[#57534E] leading-relaxed">
          {error?.message || "An unexpected error occurred. Please try reloading."}
        </p>
      </div>

      <button
        type="button"
        onClick={() => reset()}
        className="py-2 px-4 rounded-xl bg-[#1C1917] hover:bg-[#2C2724] text-[#FAF8F5] text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        <span>Try Again</span>
      </button>
    </div>
  );
}
