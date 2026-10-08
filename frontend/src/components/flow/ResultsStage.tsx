"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  Scan,
  FileCode2,
  Activity,
  ClipboardList,
  Printer,
  FileCheck2,
  Wrench,
  Sparkles,
} from "lucide-react";
import { InspectionItem } from "@/lib/inspection-adapter";
import { Badge } from "@/components/ui/badge";
import { JsonViewer } from "./JsonViewer";
import { AnomalySlider } from "@/components/inspection/AnomalySlider";
import { TelemetryDeltaPanel } from "@/components/inspection/TelemetryDeltaPanel";

interface ResultsStageProps {
  activeItem: InspectionItem | null;
  allItems: InspectionItem[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  rawJson: Record<string, unknown> | null;
  isLoading: boolean;
  isBatch: boolean;
  gateDecision?: "GO" | "ADJUST" | "CRITICAL STOP";
  batchStats?: { total: number; passed: number; defective: number };
  onLoadQuickSample: () => void;
}

export function ResultsStage({
  activeItem,
  allItems,
  selectedIndex,
  onSelectIndex,
  rawJson,
  isLoading,
  isBatch,
  gateDecision,
  batchStats,
  onLoadQuickSample,
}: ResultsStageProps) {
  const [activeTab, setActiveTab] = useState<"visual" | "json" | "telemetry">("visual");
  const [acknowledged, setAcknowledged] = useState(false);

  // If currently loading/dispatching
  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#090B0E] font-mono text-center space-y-6">
        <div className="relative flex items-center justify-center">
          <div className="w-24 h-24 rounded-full border border-cyan-500/20 animate-ping motion-reduce:animate-none absolute" />
          <div className="w-16 h-16 rounded-full border-2 border-cyan-400/40 border-t-cyan-400 animate-spin flex items-center justify-center bg-cyan-950/20">
            <Scan aria-hidden="true" className="w-7 h-7 text-cyan-400" />
          </div>
        </div>

        <div className="space-y-2 max-w-md">
          <div className="text-sm font-bold text-slate-100 uppercase tracking-wider text-balance">
            Handing Off Payload to Backend Models…
          </div>
          <p className="text-xs text-slate-400 leading-relaxed text-balance">
            Calling Vision Model A (EfficientNet-B0) and PatchCore-lite on the remote server.
            Awaiting raw prediction JSON…
          </p>
        </div>

        <div className="p-3 rounded-lg border border-[#1E2330] bg-[#10131B] text-[11px] text-slate-400 space-y-1 text-left w-full max-w-sm">
          <div className="text-cyan-400 font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span>ACTIVE BACKEND PIPELINE</span>
          </div>
          <div className="text-slate-500 text-[10px]">
            Target: http://82.112.231.102/test/classify
          </div>
        </div>
      </div>
    );
  }

  // If no item has been analyzed yet (Idle State)
  if (!activeItem) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#090B0E] font-mono text-center space-y-6">
        <div className="p-4 rounded-2xl bg-[#12141D] border border-[#232938] text-cyan-400">
          <Scan aria-hidden="true" className="w-10 h-10" />
        </div>

        <div className="space-y-2 max-w-md">
          <h2 className="text-base font-bold text-slate-100 uppercase tracking-wider text-balance">
            Awaiting Component Intake
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed text-balance">
            Upload a single photo or multi-part batch on the left intake panel to trigger backend
            model evaluation and receive the returned JSON payload.
          </p>
        </div>

        {/* Visual Pipeline Schematic Card */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-lg text-left text-xs p-4 rounded-xl border border-[#1E2330] bg-[#0E1118]">
          <div className="space-y-1">
            <div className="text-[10px] text-cyan-400 uppercase font-semibold">1. Intake</div>
            <div className="text-slate-300 font-bold">Optical Capture</div>
            <p className="text-[10px] text-slate-500">Drop high-res casting impeller photo</p>
          </div>

          <div className="space-y-1">
            <div className="text-[10px] text-cyan-400 uppercase font-semibold">2. Hand-off</div>
            <div className="text-slate-300 font-bold">EfficientNet-B0</div>
            <p className="text-[10px] text-slate-500">Supervised classification & heatmap</p>
          </div>

          <div className="space-y-1">
            <div className="text-[10px] text-cyan-400 uppercase font-semibold">3. Returned JSON</div>
            <div className="text-slate-300 font-bold">Verdict & Payload</div>
            <p className="text-[10px] text-slate-500">Real-time JSON inspector & tolerances</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onLoadQuickSample}
          className="py-2 px-4 rounded-lg border border-cyan-500/40 bg-cyan-950/30 text-cyan-300 hover:bg-cyan-950/50 text-xs font-semibold flex items-center gap-2 transition-[background-color,border-color,transform] duration-150 active:scale-[0.97] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
        >
          <Sparkles aria-hidden="true" className="w-3.5 h-3.5" />
          <span>Quick-Start: Load & Inspect Calibrated Sample</span>
        </button>
      </div>
    );
  }

  const isDefective = activeItem.status === "DEFECTIVE";

  return (
    <div className="flex-1 flex flex-col bg-[#090B0E] overflow-y-auto">
      {/* 1. Executive Verdict & Model Output Header */}
      <div className="p-4 sm:p-5 border-b border-[#1E2330] bg-[#0F1119] space-y-4">
        {/* Top telemetry and model latency tag */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase text-slate-500">MODEL PIPELINE:</span>
            <span className="text-slate-200 font-semibold">
              Vision Model A: EfficientNet-B0
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-cyan-400 font-medium">Grad-CAM Overlay</span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span>INSPECTION ID: <strong className="text-slate-200">{activeItem.id}</strong></span>
            <span className="text-slate-600">•</span>
            <span>TIME: <strong className="text-slate-300">{activeItem.timestamp}</strong></span>
          </div>
        </div>

        {/* Primary Verdict Hero Card */}
        <div
          className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-mono ${
            isDefective
              ? "bg-rose-950/20 border-rose-800/40 shadow-lg shadow-rose-950/20"
              : "bg-emerald-950/20 border-emerald-800/40 shadow-lg shadow-emerald-950/20"
          }`}
        >
          {/* Left: Verdict Status Badge & Subtext */}
          <div className="flex items-start sm:items-center gap-3">
            <div
              className={`p-2.5 rounded-xl border ${
                isDefective
                  ? "bg-rose-950/60 border-rose-500/50 text-rose-400"
                  : "bg-emerald-950/60 border-emerald-500/50 text-emerald-400"
              }`}
            >
              {isDefective ? (
                <AlertTriangle aria-hidden="true" className="w-6 h-6" />
              ) : (
                <CheckCircle2 aria-hidden="true" className="w-6 h-6" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-lg font-bold text-slate-100 tracking-wider">
                  PREDICTION: {isDefective ? "DEFECTIVE" : "OK"}
                </span>
                <Badge
                  variant={isDefective ? "defective" : "nominal"}
                  size="md"
                  dot
                >
                  {isDefective ? activeItem.defectType.toUpperCase() : "SPEC NOMINAL"}
                </Badge>
              </div>

              <p className="text-xs text-slate-400 mt-0.5 text-balance">
                {isDefective
                  ? `Surface variance localized. Severity rated ${activeItem.severity}. Immediate line intervention required.`
                  : "All dimensional tolerances, surface contours, and visual densities pass factory quality threshold."}
              </p>
            </div>
          </div>

          {/* Right: Confidence Score & Metrics */}
          <div className="flex items-center gap-4 shrink-0 border-t sm:border-t-0 sm:border-l border-[#242A3A] pt-3 sm:pt-0 sm:pl-4">
            <div className="text-left sm:text-right">
              <div className="text-[10px] text-slate-500 uppercase">Model Confidence</div>
              <div
                className={`text-xl font-bold tabular-nums ${
                  isDefective ? "text-rose-400" : "text-emerald-400"
                }`}
              >
                {activeItem.confidenceScore.toFixed(1)}%
              </div>
            </div>

            <div className="h-8 w-[1px] bg-[#242A3A] hidden sm:block" />

            <div className="text-left sm:text-right">
              <div className="text-[10px] text-slate-500 uppercase">Part Serial</div>
              <div className="text-xs font-semibold text-slate-200">
                {activeItem.serialNumber}
              </div>
            </div>
          </div>
        </div>

        {/* Batch Scrubber (if multi-part batch is loaded) */}
        {isBatch && allItems.length > 1 && (
          <div className="pt-2 border-t border-[#1E2330] space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400 font-semibold uppercase text-[11px]">
                BATCH REEL PARTS ({allItems.length})
              </span>
              {batchStats && (
                <span className="text-slate-400 text-[11px] tabular-nums">
                  Yield: {batchStats.passed}/{batchStats.total} Passed
                  {gateDecision && (
                    <strong
                      className={`ml-2 px-1.5 py-0.5 rounded text-[10px] ${
                        gateDecision === "GO"
                          ? "bg-emerald-950 text-emerald-300"
                          : "bg-rose-950 text-rose-300"
                      }`}
                    >
                      {gateDecision}
                    </strong>
                  )}
                </span>
              )}
            </div>

            {/* Horizontal pill scrubber */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 font-mono text-xs">
              {allItems.map((item, idx) => {
                const isItemDefective = item.status === "DEFECTIVE";
                const isSelected = selectedIndex === idx;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectIndex(idx)}
                    aria-label={`Select part ${idx + 1}, status ${item.status}`}
                    aria-pressed={isSelected}
                    className={`py-1 px-2.5 rounded-lg border text-xs font-medium flex items-center gap-2 shrink-0 transition-[background-color,border-color,transform] duration-150 active:scale-[0.97] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                      isSelected
                        ? "bg-[#1E2332] border-cyan-400 text-cyan-200 shadow-sm"
                        : "bg-[#12141C] border-[#222736] text-slate-400 hover:text-slate-200 hover:bg-[#161924]"
                    }`}
                  >
                    <span className="text-[10px] text-slate-500 font-bold tabular-nums">
                      #{idx + 1}
                    </span>
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isItemDefective ? "bg-rose-400" : "bg-emerald-400"
                      }`}
                    />
                    <span>{item.partId}</span>
                    <span
                      className={`text-[10px] font-bold ${
                        isItemDefective ? "text-rose-400" : "text-emerald-400"
                      }`}
                    >
                      {item.status}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 2. Deep Inspector Navigation Tabs */}
      <div className="px-4 sm:px-6 border-b border-[#1E2330] bg-[#0C0E14] flex items-center justify-between text-xs font-mono">
        <div role="tablist" aria-label="Inspection inspection views" className="flex items-center gap-1">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "visual"}
            onClick={() => setActiveTab("visual")}
            className={`py-3 px-3.5 border-b-2 font-medium flex items-center gap-2 transition-[color,border-color] duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
              activeTab === "visual"
                ? "border-cyan-400 text-cyan-300 font-bold"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Scan aria-hidden="true" className="w-3.5 h-3.5" />
            <span>Visual Anomaly Reticle</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "json"}
            onClick={() => setActiveTab("json")}
            className={`py-3 px-3.5 border-b-2 font-medium flex items-center gap-2 transition-[color,border-color] duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
              activeTab === "json"
                ? "border-cyan-400 text-cyan-300 font-bold"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <FileCode2 aria-hidden="true" className="w-3.5 h-3.5" />
            <span>Returned JSON Payload</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "telemetry"}
            onClick={() => setActiveTab("telemetry")}
            className={`py-3 px-3.5 border-b-2 font-medium flex items-center gap-2 transition-[color,border-color] duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
              activeTab === "telemetry"
                ? "border-cyan-400 text-cyan-300 font-bold"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Activity aria-hidden="true" className="w-3.5 h-3.5" />
            <span>Telemetry & Protocol</span>
          </button>
        </div>
      </div>

      {/* 3. Tab Contents Stage */}
      <div className="p-4 sm:p-6 space-y-6">
        {/* TAB 1: VISUAL RETICLE & SLIDER */}
        {activeTab === "visual" && (
          <div className="space-y-6">
            <AnomalySlider item={activeItem} />

            {/* Quick action card underneath visual slider */}
            <div className="p-4 rounded-xl border border-[#1E2330] bg-[#10131B] font-mono text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-slate-400 font-semibold text-[11px] uppercase flex items-center gap-1.5">
                  <Wrench aria-hidden="true" className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Mandatory Operator Protocol</span>
                </div>
                <div className="text-slate-200 text-xs">
                  {activeItem.recommendedAction}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveTab("json")}
                  className="py-1.5 px-3 rounded-lg border border-[#272E3F] bg-[#141724] hover:bg-[#1A1F2D] text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-[background-color,border-color,transform] duration-150 active:scale-[0.97] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                >
                  <FileCode2 aria-hidden="true" className="w-3.5 h-3.5 text-cyan-400" />
                  <span>View Raw JSON</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: RETURNED JSON PAYLOAD VIEWER */}
        {activeTab === "json" && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-lg border border-cyan-800/40 bg-cyan-950/20 text-xs font-mono text-cyan-300 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileCode2 aria-hidden="true" className="w-4 h-4 text-cyan-400" />
                <span>
                  Exact structured JSON payload returned by backend model endpoint.
                </span>
              </div>
              <span className="text-[10px] text-slate-400 uppercase">HTTP 200 OK</span>
            </div>

            <JsonViewer
              data={rawJson}
              title={
                isBatch
                  ? "Batch Inspection Fusion Payload (JSON)"
                  : `Model Classification Result - ${activeItem.partId}`
              }
              maxHeight="600px"
            />
          </div>
        )}

        {/* TAB 3: TELEMETRY & DIAGNOSTICS */}
        {activeTab === "telemetry" && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
            {/* Left: Sensor Tolerance Bars */}
            <div className="min-h-[340px]">
              <TelemetryDeltaPanel telemetry={activeItem.telemetry} />
            </div>

            {/* Right: Diagnostic Ticket & Sign-Off */}
            <div className="p-5 rounded-xl border border-[#1E2330] bg-[#12141C] font-mono text-xs flex flex-col justify-between space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#1E2330]">
                  <div className="flex items-center gap-2">
                    <ClipboardList aria-hidden="true" className="w-4 h-4 text-cyan-400" />
                    <span className="font-bold text-slate-200 uppercase tracking-wider text-xs">
                      Plant Diagnostic Audit Slip
                    </span>
                  </div>
                  <Badge variant={isDefective ? "defective" : "nominal"} size="sm">
                    {activeItem.severity}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">
                    Incident Synthesis:
                  </div>
                  <div
                    className={`p-3 rounded-lg border text-xs leading-relaxed ${
                      isDefective
                        ? "bg-rose-950/20 border-rose-900/40 text-rose-200"
                        : "bg-emerald-950/20 border-emerald-900/40 text-emerald-200"
                    }`}
                  >
                    {activeItem.rootCauseSummary}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">
                    Action Mandate:
                  </div>
                  <div
                    className={`p-3 rounded-lg border text-xs font-semibold ${
                      isDefective
                        ? "bg-amber-950/30 border-amber-500/50 text-amber-100"
                        : "bg-cyan-950/30 border-cyan-500/40 text-cyan-100"
                    }`}
                  >
                    {activeItem.recommendedAction}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-[#1E2330] flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => window.print()}
                  aria-label="Print diagnostic audit slip"
                  className="py-1.5 px-3 rounded border border-[#272E3F] bg-[#151824] hover:bg-[#1B2030] text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-[background-color,border-color,transform] duration-150 active:scale-[0.97] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                >
                  <Printer aria-hidden="true" className="w-3.5 h-3.5" />
                  <span>Print Slip</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAcknowledged(!acknowledged)}
                  aria-pressed={acknowledged}
                  aria-label={acknowledged ? "Protocol acknowledged" : "Sign-off protocol"}
                  className={`py-1.5 px-4 rounded-lg font-bold text-xs flex items-center gap-2 transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.97] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                    acknowledged
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      : isDefective
                      ? "bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-950/50"
                      : "bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-950/50"
                  }`}
                >
                  <FileCheck2 aria-hidden="true" className="w-3.5 h-3.5" />
                  <span>
                    {acknowledged
                      ? "Protocol Acknowledged"
                      : isDefective
                      ? "Quarantine & Sign-Off"
                      : "Acknowledge & Release"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
