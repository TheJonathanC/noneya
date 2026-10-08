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
  Thermometer,
  Gauge,
  Waves,
  Zap,
} from "lucide-react";
import { InspectionItem, SensorTelemetry } from "@/lib/inspection-adapter";
import { Badge } from "@/components/ui/badge";
import { LinenJsonViewer } from "./LinenJsonViewer";
import { LinenSlider } from "./LinenSlider";

interface LinenResultsProps {
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

export function LinenResults({
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
}: LinenResultsProps) {
  const [activeTab, setActiveTab] = useState<"visual" | "json" | "telemetry">("visual");
  const [acknowledged, setAcknowledged] = useState(false);

  // If currently dispatching
  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#FAF8F5] font-mono text-center space-y-6">
        <div className="relative flex items-center justify-center">
          <div className="w-24 h-24 rounded-full border border-[#EA580C]/20 animate-ping motion-reduce:animate-none absolute" />
          <div className="w-16 h-16 rounded-full border-2 border-[#EA580C]/30 border-t-[#EA580C] animate-spin flex items-center justify-center bg-[#FDF2E9]">
            <Scan aria-hidden="true" className="w-7 h-7 text-[#9A3412]" />
          </div>
        </div>

        <div className="space-y-2 max-w-md">
          <h2 className="text-sm font-bold text-[#1C1917] uppercase tracking-wider text-balance">
            Handing Off Payload to Backend Models…
          </h2>
          <p className="text-xs text-[#78716A] leading-relaxed text-balance">
            Dispatching component capture to Vision Model A (EfficientNet-B0) and PatchCore-lite on
            82.112.231.102. Awaiting raw classification JSON…
          </p>
        </div>

        <div className="p-3.5 rounded-xl border border-[#E6E0D3] bg-[#FFFFFF] text-[11px] text-[#78716A] space-y-1 text-left w-full max-w-sm shadow-xs">
          <div className="text-[#9A3412] font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#EA580C] animate-pulse" />
            <span>ACTIVE BACKEND PIPELINE</span>
          </div>
          <div className="text-[#A8A29E] text-[10px]">
            Target: http://82.112.231.102/test/classify
          </div>
        </div>
      </div>
    );
  }

  // If idle and no item has been analyzed yet
  if (!activeItem) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 sm:p-12 bg-[#FAF8F5] font-mono text-center space-y-6">
        <div className="p-5 rounded-2xl bg-[#FFFFFF] border border-[#E4DDD1] text-[#9A3412] shadow-xs">
          <Scan aria-hidden="true" className="w-10 h-10" />
        </div>

        <div className="space-y-2 max-w-md">
          <h2 className="text-base font-bold text-[#1C1917] uppercase tracking-wider text-balance">
            Awaiting Component Intake
          </h2>
          <p className="text-xs text-[#78716A] leading-relaxed text-balance">
            Stage a component photo on the left intake station to run model inference and receive the
            complete diagnostic JSON response here.
          </p>
        </div>

        {/* Visual Pipeline Schematic Card */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-xl text-left text-xs p-5 rounded-2xl border border-[#E5DFD3] bg-[#FFFFFF] shadow-xs">
          <div className="space-y-1">
            <div className="text-[10px] text-[#9A3412] uppercase font-semibold">1. Intake</div>
            <div className="text-[#1C1917] font-bold">Optical Capture</div>
            <p className="text-[10px] text-[#78716A]">Drop high-resolution casting impeller capture</p>
          </div>

          <div className="space-y-1">
            <div className="text-[10px] text-[#9A3412] uppercase font-semibold">2. Hand-off</div>
            <div className="text-[#1C1917] font-bold">EfficientNet-B0</div>
            <p className="text-[10px] text-[#78716A]">Supervised vision model & Grad-CAM heatmap</p>
          </div>

          <div className="space-y-1">
            <div className="text-[10px] text-[#9A3412] uppercase font-semibold">3. Returned JSON</div>
            <div className="text-[#1C1917] font-bold">Verdict & Payload</div>
            <p className="text-[10px] text-[#78716A]">Real-time JSON inspector & line tolerances</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onLoadQuickSample}
          className="py-2.5 px-4 rounded-xl border border-[#D8CFBF] bg-[#FFFFFF] hover:bg-[#F9F7F2] text-[#9A3412] text-xs font-semibold flex items-center gap-2 transition-[background-color,border-color,transform] duration-150 active:scale-[0.97] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A3412] shadow-xs"
        >
          <Sparkles aria-hidden="true" className="w-3.5 h-3.5" />
          <span>Quick-Start: Load & Inspect Calibrated Sample</span>
        </button>
      </div>
    );
  }

  const isDefective = activeItem.status === "DEFECTIVE";

  return (
    <div className="flex-1 flex flex-col bg-[#FAF8F5] overflow-y-auto">
      {/* 1. Executive Verdict & Model Output Header */}
      <div className="p-4 sm:p-6 border-b border-[#E6E0D3] bg-[#FAF8F5] space-y-4">
        {/* Top telemetry and model latency tag */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase text-[#78716A] font-semibold">MODEL PIPELINE:</span>
            <span className="text-[#1C1917] font-semibold">
              Vision Model A: EfficientNet-B0
            </span>
            <span className="text-[#D6CEBF]">•</span>
            <span className="text-[#9A3412] font-semibold">Grad-CAM Overlay</span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-[#78716A]">
            <span>INSPECTION ID: <strong className="text-[#1C1917]">{activeItem.id}</strong></span>
            <span className="text-[#D6CEBF]">•</span>
            <span>TIME: <strong className="text-[#1C1917] tabular-nums">{activeItem.timestamp}</strong></span>
          </div>
        </div>

        {/* Primary Verdict Hero Card */}
        <div
          className={`p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-5 font-mono shadow-xs ${
            isDefective
              ? "bg-[#FEF6F3] border-[#FBD5C0]"
              : "bg-[#F3FAF4] border-[#CCEBD0]"
          }`}
        >
          {/* Left: Verdict Status Badge & Subtext */}
          <div className="flex items-start sm:items-center gap-3.5">
            <div
              className={`p-3 rounded-xl border ${
                isDefective
                  ? "bg-[#FDF2E9] border-[#FCD6C2] text-[#9A3412]"
                  : "bg-[#EDF7EE] border-[#C6E6C8] text-[#166534]"
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
                <span className="text-lg font-bold text-[#1C1917] tracking-wider">
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

              <p className="text-xs text-[#57534E] mt-1 text-balance">
                {isDefective
                  ? `Surface variance localized. Severity rated ${activeItem.severity}. Line intervention protocol active.`
                  : "All dimensional tolerances, surface contours, and visual densities pass factory quality specification."}
              </p>
            </div>
          </div>

          {/* Right: Confidence Score & Metrics */}
          <div className="flex items-center gap-5 shrink-0 border-t sm:border-t-0 sm:border-l border-[#E2DBD0] pt-3 sm:pt-0 sm:pl-5">
            <div className="text-left sm:text-right">
              <div className="text-[10px] text-[#78716A] uppercase font-semibold">Model Confidence</div>
              <div
                className={`text-2xl font-bold tabular-nums ${
                  isDefective ? "text-[#9A3412]" : "text-[#166534]"
                }`}
              >
                {activeItem.confidenceScore.toFixed(1)}%
              </div>
            </div>

            <div className="h-9 w-[1px] bg-[#E2DBD0] hidden sm:block" />

            <div className="text-left sm:text-right">
              <div className="text-[10px] text-[#78716A] uppercase font-semibold">Part Serial</div>
              <div className="text-xs font-semibold text-[#1C1917]">
                {activeItem.serialNumber}
              </div>
            </div>
          </div>
        </div>

        {/* Batch Scrubber (if multi-part batch is loaded) */}
        {isBatch && allItems.length > 1 && (
          <div className="pt-3 border-t border-[#E6E0D3] space-y-2.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-[#57534E] font-semibold uppercase text-[11px]">
                BATCH REEL PARTS ({allItems.length})
              </span>
              {batchStats && (
                <span className="text-[#78716A] text-[11px] tabular-nums">
                  Yield: {batchStats.passed}/{batchStats.total} Passed
                  {gateDecision && (
                    <strong
                      className={`ml-2 px-2 py-0.5 rounded text-[10px] font-bold ${
                        gateDecision === "GO"
                          ? "bg-[#EDF7EE] text-[#166534] border border-[#C6E6C8]"
                          : "bg-[#FDF2E9] text-[#9A3412] border border-[#FCD6C2]"
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
                    className={`py-1.5 px-3 rounded-xl border text-xs font-medium flex items-center gap-2 shrink-0 transition-[background-color,border-color,box-shadow,transform] duration-150 active:scale-[0.97] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A3412] ${
                      isSelected
                        ? "bg-[#FFFFFF] border-[#9A3412] text-[#9A3412] shadow-sm font-bold"
                        : "bg-[#F7F4EC] border-[#E4DDD1] text-[#78716A] hover:text-[#1C1917] hover:bg-[#FFFFFF]"
                    }`}
                  >
                    <span className="text-[10px] text-[#A8A29E] font-bold tabular-nums">
                      #{idx + 1}
                    </span>
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isItemDefective ? "bg-[#EA580C]" : "bg-[#16A34A]"
                      }`}
                    />
                    <span>{item.partId}</span>
                    <span
                      className={`text-[10px] font-bold ${
                        isItemDefective ? "text-[#9A3412]" : "text-[#166534]"
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
      <div className="px-4 sm:px-6 border-b border-[#E6E0D3] bg-[#FAF8F5] flex items-center justify-between text-xs font-mono">
        <div role="tablist" aria-label="Inspection inspection views" className="flex items-center gap-2">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "visual"}
            onClick={() => setActiveTab("visual")}
            className={`py-3 px-3.5 border-b-2 font-medium flex items-center gap-2 transition-[color,border-color] duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A3412] ${
              activeTab === "visual"
                ? "border-[#9A3412] text-[#9A3412] font-bold"
                : "border-transparent text-[#78716A] hover:text-[#1C1917]"
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
            className={`py-3 px-3.5 border-b-2 font-medium flex items-center gap-2 transition-[color,border-color] duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A3412] ${
              activeTab === "json"
                ? "border-[#9A3412] text-[#9A3412] font-bold"
                : "border-transparent text-[#78716A] hover:text-[#1C1917]"
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
            className={`py-3 px-3.5 border-b-2 font-medium flex items-center gap-2 transition-[color,border-color] duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A3412] ${
              activeTab === "telemetry"
                ? "border-[#9A3412] text-[#9A3412] font-bold"
                : "border-transparent text-[#78716A] hover:text-[#1C1917]"
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
            <LinenSlider item={activeItem} />

            {/* Quick action card underneath visual slider */}
            <div className="p-4 sm:p-5 rounded-2xl border border-[#E5DFD3] bg-[#FFFFFF] font-mono text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
              <div className="space-y-1">
                <div className="text-[#78716A] font-semibold text-[11px] uppercase flex items-center gap-1.5">
                  <Wrench aria-hidden="true" className="w-3.5 h-3.5 text-[#9A3412]" />
                  <span>Mandatory Line Action Protocol</span>
                </div>
                <div className="text-[#1C1917] text-xs font-medium">
                  {activeItem.recommendedAction}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveTab("json")}
                  className="py-2 px-3.5 rounded-xl border border-[#D8CFBF] bg-[#FAF8F5] hover:bg-[#F3EFE6] text-[#78350F] text-xs font-semibold flex items-center gap-1.5 transition-[background-color,border-color,transform] duration-150 active:scale-[0.97] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A3412] shadow-xs"
                >
                  <FileCode2 aria-hidden="true" className="w-3.5 h-3.5 text-[#9A3412]" />
                  <span>Inspect Returned JSON</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: RETURNED JSON PAYLOAD VIEWER */}
        {activeTab === "json" && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl border border-[#E5DFD3] bg-[#F7F4EC] text-xs font-mono text-[#57534E] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileCode2 aria-hidden="true" className="w-4 h-4 text-[#9A3412]" />
                <span>
                  Exact structured JSON response returned from the backend models.
                </span>
              </div>
              <span className="text-[10px] text-[#166534] font-semibold px-2 py-0.5 rounded bg-[#EDF7EE] border border-[#C6E6C8]">
                HTTP 200 OK
              </span>
            </div>

            <LinenJsonViewer
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
            <div className="p-5 rounded-2xl border border-[#E5DFD3] bg-[#FFFFFF] font-mono text-xs space-y-4 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-[#E6E0D3]">
                <div className="flex items-center gap-2">
                  <Activity aria-hidden="true" className="w-4 h-4 text-[#9A3412]" />
                  <span className="font-bold text-[#1C1917] uppercase tracking-wider text-xs">
                    Process Telemetry & Tolerances
                  </span>
                </div>
                <span className="text-[10px] text-[#78716A]">NOMINAL BAND COMPARISON</span>
              </div>

              <div className="space-y-3">
                {activeItem.telemetry.map((sensor: SensorTelemetry) => {
                  const isSensorCritical = sensor.status === "critical";
                  const isSensorWarning = sensor.status === "warning";
                  const deltaSign = sensor.delta >= 0 ? "+" : "";

                  return (
                    <div
                      key={sensor.id}
                      className="p-3 rounded-xl border border-[#E8E2D6] bg-[#FAF8F5] space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="p-1 rounded bg-[#EFEAE0] text-[#78350F] shrink-0">
                            {sensor.name.toLowerCase().includes("temp") ? (
                              <Thermometer aria-hidden="true" className="w-3.5 h-3.5 text-[#C2410C]" />
                            ) : sensor.name.toLowerCase().includes("press") ? (
                              <Gauge aria-hidden="true" className="w-3.5 h-3.5 text-[#D97706]" />
                            ) : sensor.name.toLowerCase().includes("cool") ? (
                              <Waves aria-hidden="true" className="w-3.5 h-3.5 text-[#0D9488]" />
                            ) : (
                              <Zap aria-hidden="true" className="w-3.5 h-3.5 text-[#7C3AED]" />
                            )}
                          </div>
                          <div className="truncate">
                            <span className="font-semibold text-[#1C1917] block truncate">
                              {sensor.name}
                            </span>
                            <span className="text-[10px] text-[#78716A] tabular-nums">
                              BAND: {sensor.nominalMin} – {sensor.nominalMax} {sensor.unit}
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0 flex items-center gap-2">
                          <span className="text-xs font-bold text-[#1C1917] tabular-nums">
                            {sensor.recordedValue} {sensor.unit}
                          </span>
                          <Badge
                            variant={isSensorCritical ? "defective" : isSensorWarning ? "warning" : "nominal"}
                            size="sm"
                          >
                            {deltaSign}{sensor.delta.toFixed(1)} {sensor.unit}
                          </Badge>
                        </div>
                      </div>

                      {/* Visual band bar */}
                      <div aria-hidden="true" className="relative h-2 w-full rounded-full bg-[#E5DFD3] overflow-hidden">
                        <div
                          className="absolute top-0 bottom-0 bg-[#86EFAC] border-x border-[#4ADE80]"
                          style={{ left: "30%", width: "40%" }}
                        />
                        <div
                          className={`absolute top-0 bottom-0 w-2 -ml-1 rounded-full shadow-xs ${
                            isSensorCritical
                              ? "bg-[#DC2626]"
                              : isSensorWarning
                              ? "bg-[#D97706]"
                              : "bg-[#16A34A]"
                          }`}
                          style={{
                            left: isSensorCritical ? "85%" : isSensorWarning ? "75%" : "50%",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Diagnostic Ticket & Sign-Off */}
            <div className="p-5 rounded-2xl border border-[#E5DFD3] bg-[#FFFFFF] font-mono text-xs flex flex-col justify-between space-y-4 shadow-xs">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#E6E0D3]">
                  <div className="flex items-center gap-2">
                    <ClipboardList aria-hidden="true" className="w-4 h-4 text-[#9A3412]" />
                    <span className="font-bold text-[#1C1917] uppercase tracking-wider text-xs">
                      Plant Diagnostic Audit Slip
                    </span>
                  </div>
                  <Badge variant={isDefective ? "defective" : "nominal"} size="sm">
                    {activeItem.severity}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <div className="text-[10px] text-[#78716A] uppercase font-semibold">
                    Incident Synthesis:
                  </div>
                  <div
                    className={`p-3.5 rounded-xl border text-xs leading-relaxed ${
                      isDefective
                        ? "bg-[#FDF2E9] border-[#FCD6C2] text-[#9A3412]"
                        : "bg-[#EDF7EE] border-[#C6E6C8] text-[#166534]"
                    }`}
                  >
                    {activeItem.rootCauseSummary}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-[10px] text-[#78716A] uppercase font-semibold">
                    Action Mandate:
                  </div>
                  <div
                    className={`p-3.5 rounded-xl border text-xs font-semibold ${
                      isDefective
                        ? "bg-[#FEF9E7] border-[#FDE68A] text-[#92400E]"
                        : "bg-[#F5F1E8] border-[#E5DFD3] text-[#78350F]"
                    }`}
                  >
                    {activeItem.recommendedAction}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-[#E6E0D3] flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => window.print()}
                  aria-label="Print diagnostic audit slip"
                  className="py-2 px-3.5 rounded-xl border border-[#D8CFBF] bg-[#FAF8F5] hover:bg-[#F3EFE6] text-[#78716A] hover:text-[#1C1917] text-xs font-medium flex items-center gap-1.5 transition-[background-color,border-color,transform] duration-150 active:scale-[0.97] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A3412]"
                >
                  <Printer aria-hidden="true" className="w-3.5 h-3.5" />
                  <span>Print Slip</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAcknowledged(!acknowledged)}
                  aria-pressed={acknowledged}
                  aria-label={acknowledged ? "Protocol acknowledged" : "Sign-off protocol"}
                  className={`py-2 px-4 rounded-xl font-bold text-xs flex items-center gap-2 transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.97] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A3412] ${
                    acknowledged
                      ? "bg-[#EDF7EE] text-[#166534] border border-[#C6E6C8]"
                      : isDefective
                      ? "bg-[#9A3412] hover:bg-[#7C2D12] text-[#FFFFFF] shadow-sm"
                      : "bg-[#166534] hover:bg-[#14532D] text-[#FFFFFF] shadow-sm"
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
