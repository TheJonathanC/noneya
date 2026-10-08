"use client";

import React from "react";
import {
  Activity,
  Layers,
  Play,
  RefreshCw,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { StationStats } from "@/lib/inspection-adapter";

interface StationHeaderProps {
  stats: StationStats;
  sampleSize: number;
  onSampleSizeChange: (size: number) => void;
  isRunning: boolean;
  onRunBatch: () => void;
  useMockFallback: boolean;
  onToggleMockFallback: () => void;
}

export function StationHeader({
  stats,
  sampleSize,
  onSampleSizeChange,
  isRunning,
  onRunBatch,
  useMockFallback,
  onToggleMockFallback,
}: StationHeaderProps) {
  const isHealthyYield = stats.yieldPercentage >= 85;

  return (
    <header className="border-b border-[#1F2430] bg-[#0E1017] sticky top-0 z-40 backdrop-blur-md">
      {/* Top Telemetry & Station Bar */}
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 py-2.5 border-b border-[#1A1E29] flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 font-mono">
        {/* Left: Line Context & Station Meta */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-slate-200">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
            </span>
            <span className="font-semibold text-slate-100">{stats.stationId}</span>
          </div>

          <div className="h-3 w-[1px] bg-[#2A3142]" />

          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-slate-500" />
            <span>LOT:</span>
            <span className="text-slate-200 font-bold">{stats.lotCode}</span>
          </div>

          <div className="h-3 w-[1px] bg-[#2A3142]" />

          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>SHIFT:</span>
            <span className="text-slate-300">{stats.shift}</span>
          </div>

          <div className="h-3 w-[1px] bg-[#2A3142]" />

          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>CALIBRATION:</span>
            <span className="text-cyan-300">{stats.targetTolerance}</span>
          </div>
        </div>

        {/* Right: Mode & Engine Status */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleMockFallback}
            type="button"
            className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            title="Toggle between live server calls and resilient offline mock engine"
          >
            {useMockFallback ? (
              <ToggleRight className="w-4 h-4 text-cyan-400" />
            ) : (
              <ToggleLeft className="w-4 h-4 text-slate-500" />
            )}
            <span>DATA ENGINE:</span>
            <span
              className={
                useMockFallback ? "text-cyan-300 font-semibold" : "text-emerald-400 font-semibold"
              }
            >
              {useMockFallback ? "MOCK RESILIENT" : "LIVE BACKEND"}
            </span>
          </button>

          <div className="h-3 w-[1px] bg-[#2A3142]" />

          <div className="flex items-center gap-1.5 text-emerald-400">
            <Activity className="w-3.5 h-3.5 animate-pulse" />
            <span>STATION ONLINE</span>
          </div>
        </div>
      </div>

      {/* Main Operational Controls Bar */}
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 py-3 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Title & Yield Stats */}
        <div className="flex items-center gap-6">
          <div>
            <div className="text-[10px] tracking-widest text-slate-500 uppercase font-mono">
              PRECISION INDUSTRIAL INSPECTION TERMINAL // REV 4.2
            </div>
            <h1 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              Automated Casting Quality Station
            </h1>
          </div>

          {/* Live Yield Metrics Capsule */}
          <div className="flex items-center gap-3 bg-[#12151E] border border-[#232938] rounded-lg px-3 py-1.5">
            <div className="text-right font-mono">
              <div className="text-[10px] text-slate-400 uppercase">Batch Yield</div>
              <div
                className={`text-base font-bold ${
                  isHealthyYield ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {stats.yieldPercentage}%
              </div>
            </div>

            <div className="h-7 w-[1px] bg-[#232938]" />

            <div className="font-mono text-xs flex flex-col justify-center space-y-0.5">
              <div className="flex items-center gap-1.5 text-emerald-400">
                <CheckCircle2 className="w-3 h-3" />
                <span>{stats.passedCount} Passed</span>
              </div>
              <div className="flex items-center gap-1.5 text-rose-400">
                <AlertTriangle className="w-3 h-3" />
                <span>{stats.defectiveCount} Defective</span>
              </div>
            </div>

            <div className="h-7 w-[1px] bg-[#232938]" />

            <div className="font-mono text-xs text-slate-400 flex flex-col justify-center">
              <span className="text-[10px] uppercase text-slate-500">Total Run</span>
              <span className="text-slate-200 font-semibold">{stats.totalInspected} Parts</span>
            </div>
          </div>
        </div>

        {/* Batch Size & Action Button */}
        <div className="flex items-center gap-4">
          {/* Sample Batch Size Selector */}
          <div className="flex items-center gap-2 bg-[#12151E] border border-[#232938] rounded-lg px-3 py-1.5 font-mono text-xs">
            <Sliders className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">BATCH SIZE:</span>
            <div className="flex items-center gap-1">
              {[3, 5, 8, 10].map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => onSampleSizeChange(sz)}
                  className={`px-2 py-0.5 rounded text-xs transition-colors cursor-pointer ${
                    sampleSize === sz
                      ? "bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>
          </div>

          {/* Primary Action Button */}
          <button
            type="button"
            onClick={onRunBatch}
            disabled={isRunning}
            className={`px-4 py-2 rounded-lg font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all duration-150 cursor-pointer shadow-lg ${
              isRunning
                ? "bg-cyan-950/60 text-cyan-400 border border-cyan-800/60 cursor-not-allowed"
                : "bg-cyan-500 hover:bg-cyan-400 text-[#090C12] shadow-cyan-500/20 active:scale-[0.98]"
            }`}
          >
            {isRunning ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                <span>Scanning Batch...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Run Batch Inspection</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
