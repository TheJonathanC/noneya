"use client";

import React from "react";
import {
  RotateCcw,
  ToggleLeft,
  ToggleRight,
  Server,
} from "lucide-react";

interface LinenHeaderProps {
  useMockFallback: boolean;
  onToggleMockFallback: () => void;
  onResetAll: () => void;
  serverOnline: boolean;
}

export function LinenHeader({
  useMockFallback,
  onToggleMockFallback,
  onResetAll,
  serverOnline,
}: LinenHeaderProps) {
  return (
    <header className="border-b border-[#E6E0D3] bg-[#FAF8F5]/90 sticky top-0 z-40 backdrop-blur-md">
      <div className="max-w-[1900px] mx-auto px-4 sm:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
        {/* Brand & Station Header */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#1C1917] text-[#FAF8F5] flex items-center justify-center font-mono font-bold text-xs shadow-xs">
              A4
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold tracking-wider text-[#1C1917] uppercase">
                  Aura Quality Lab
                </h1>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#EFEAE0] text-[#78716A] border border-[#DDD5C7]">
                  Cell 04
                </span>
              </div>
              <p className="text-[11px] text-[#78716A] tracking-normal font-sans">
                Automated Casting Inspection & Diagnostic Studio
              </p>
            </div>
          </div>

          <div className="h-4 w-[1px] bg-[#E2DBD0] hidden sm:block" />

          {/* Flow breadcrumb */}
          <div className="hidden md:flex items-center gap-2 text-xs font-mono text-[#78716A]">
            <span className="text-[#A8A29E]">1. Intake</span>
            <span className="text-[#D6CEBF]">→</span>
            <span className="text-[#A8A29E]">2. Model Inference</span>
            <span className="text-[#D6CEBF]">→</span>
            <span className="text-[#9A3412] font-semibold">3. Returned JSON</span>
          </div>
        </div>

        {/* Right: Server Status, Engine Switch, and Reset */}
        <div className="flex items-center gap-3 font-mono text-xs">
          {/* Live Backend Connection Indicator */}
          <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-[#FFFFFF] border border-[#E4DDD1] shadow-xs">
            <Server aria-hidden="true" className="w-3.5 h-3.5 text-[#A8A29E]" />
            <span className="text-[#78716A] text-[11px]">82.112.231.102:</span>
            <span
              className={`font-semibold text-[11px] flex items-center gap-1.5 ${
                serverOnline ? "text-[#166534]" : "text-[#B45309]"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  serverOnline ? "bg-[#16A34A]" : "bg-[#D97706]"
                }`}
              />
              {serverOnline ? "ONLINE" : "STANDBY"}
            </span>
          </div>

          {/* Engine Mode Toggle Button */}
          <button
            type="button"
            onClick={onToggleMockFallback}
            aria-label={`Toggle backend mode: currently ${
              useMockFallback ? "mock resilient" : "live backend"
            }`}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#FFFFFF] hover:bg-[#F9F7F2] border border-[#E4DDD1] text-[#78716A] hover:text-[#1C1917] transition-[background-color,color,transform] duration-150 active:scale-[0.97] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A3412] shadow-xs"
            title="Toggle between live server calls and resilient offline mock engine"
          >
            {useMockFallback ? (
              <ToggleRight aria-hidden="true" className="w-4 h-4 text-[#C2410C]" />
            ) : (
              <ToggleLeft aria-hidden="true" className="w-4 h-4 text-[#A8A29E]" />
            )}
            <span className="text-[11px]">ENGINE:</span>
            <span
              className={`text-[11px] font-bold ${
                useMockFallback ? "text-[#C2410C]" : "text-[#166534]"
              }`}
            >
              {useMockFallback ? "MOCK RESILIENT" : "LIVE BACKEND"}
            </span>
          </button>

          {/* Reset Flow Button */}
          <button
            type="button"
            onClick={onResetAll}
            aria-label="Reset inspection flow"
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#FFFFFF] hover:bg-[#F9F7F2] border border-[#E4DDD1] text-[#78716A] hover:text-[#1C1917] transition-[background-color,color,transform] duration-150 active:scale-[0.97] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A3412] shadow-xs text-[11px]"
            title="Reset current inspection and staged queue"
          >
            <RotateCcw aria-hidden="true" className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>
    </header>
  );
}
