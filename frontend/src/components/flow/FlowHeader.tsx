"use client";

import React from "react";
import {
  Layers,
  RotateCcw,
  ToggleLeft,
  ToggleRight,
  Server,
} from "lucide-react";

interface FlowHeaderProps {
  useMockFallback: boolean;
  onToggleMockFallback: () => void;
  onResetAll: () => void;
  serverOnline: boolean;
}

export function FlowHeader({
  useMockFallback,
  onToggleMockFallback,
  onResetAll,
  serverOnline,
}: FlowHeaderProps) {
  return (
    <header className="border-b border-[#1E2330] bg-[#0E1017] sticky top-0 z-40 backdrop-blur-md font-mono">
      <div className="max-w-[1900px] mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Left: Station Identity & Pipeline Label */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-slate-100">
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="animate-ping motion-reduce:animate-none absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
            </span>
            <span className="font-bold tracking-wider text-slate-100 uppercase">
              Terminal 04
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-400 text-[11px]">Casting Cell B</span>
          </div>

          <div className="h-3 w-[1px] bg-[#2A3142]" />

          <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
            <Layers aria-hidden="true" className="w-3.5 h-3.5 text-slate-500" />
            <span>FLOW:</span>
            <span className="text-cyan-300 font-semibold">
              Intake ➔ Backend Model ➔ Returned JSON
            </span>
          </div>
        </div>

        {/* Right: Server Status, Engine Switch, and Reset */}
        <div className="flex items-center gap-3">
          {/* Live Backend Connection Indicator */}
          <div className="flex items-center gap-1.5 text-[11px]">
            <Server aria-hidden="true" className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-400">82.112.231.102:</span>
            <span
              className={`font-semibold flex items-center gap-1 ${
                serverOnline ? "text-emerald-400" : "text-amber-400"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  serverOnline ? "bg-emerald-400" : "bg-amber-400"
                }`}
              />
              {serverOnline ? "ONLINE" : "STANDBY"}
            </span>
          </div>

          <div className="h-3 w-[1px] bg-[#2A3142]" />

          {/* Engine Mode Toggle Button */}
          <button
            type="button"
            onClick={onToggleMockFallback}
            aria-label={`Toggle backend mode: currently ${
              useMockFallback ? "mock resilient" : "live backend"
            }`}
            className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-200 transition-[color,transform] duration-150 active:scale-[0.97] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 rounded px-1.5 py-0.5"
            title="Toggle between live server calls and resilient offline mock engine"
          >
            {useMockFallback ? (
              <ToggleRight aria-hidden="true" className="w-4 h-4 text-cyan-400" />
            ) : (
              <ToggleLeft aria-hidden="true" className="w-4 h-4 text-slate-500" />
            )}
            <span>ENGINE:</span>
            <span
              className={
                useMockFallback
                  ? "text-cyan-300 font-semibold"
                  : "text-emerald-400 font-semibold"
              }
            >
              {useMockFallback ? "MOCK RESILIENT" : "LIVE BACKEND"}
            </span>
          </button>

          <div className="h-3 w-[1px] bg-[#2A3142]" />

          {/* Reset Flow Button */}
          <button
            type="button"
            onClick={onResetAll}
            aria-label="Reset inspection flow"
            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-cyan-300 transition-[color,transform] duration-150 active:scale-[0.97] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 px-2 py-0.5 rounded border border-[#272E3F] bg-[#141724]"
            title="Reset current inspection and staged queue"
          >
            <RotateCcw aria-hidden="true" className="w-3 h-3" />
            <span>Reset Flow</span>
          </button>
        </div>
      </div>
    </header>
  );
}
