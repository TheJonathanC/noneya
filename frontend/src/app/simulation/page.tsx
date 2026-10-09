"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import {
  Upload,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Flame,
  Layers,
  Cpu,
  Activity,
  FileText,
  Database,
  Sparkles,
  LayoutDashboard,
  Server,
  Filter,
  Check,
  ChevronRight,
  Eye,
} from "lucide-react";
import { LinenHeader } from "@/components/linen/LinenHeader";
import { DotSwarm } from "dots-swarm";
import { inspectBatchPhotos, generateFallbackInspection } from "@/lib/api";
import { InspectionItem } from "@/lib/inspection-adapter";

export type PipelineStage =
  | "idle"
  | "pilot_batch"
  | "model1"
  | "model2"
  | "process_data"
  | "model3"
  | "gemini_struct"
  | "gatekeeper"
  | "gemini_report"
  | "dashboard";

export interface BatchSimulationItem {
  id: string;
  file: File;
  previewUrl: string;
  isDefective: boolean;
  defectType: string;
  confidence: number;
  heatmapUrl: string | null;
  sensorReadings: Array<{ name: string; val: number; unit: string; drift: boolean }>;
  gateVerdict: "GO" | "ADJUST" | "CRITICAL STOP";
  summary: string;
  rawJson?: Record<string, unknown>;
  inspectionItem?: InspectionItem;
}

export default function SimulationPage() {
  const [stage, setStage] = useState<PipelineStage>("idle");
  const [batchItems, setBatchItems] = useState<BatchSimulationItem[]>([]);
  const [activeItemIndex, setActiveItemIndex] = useState<number>(0);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Overall batch verdicts
  const [batchVerdict, setBatchVerdict] = useState<"GO" | "ADJUST" | "CRITICAL STOP">("GO");
  const [batchSummary, setBatchSummary] = useState<string>("");
  const [defectsCount, setDefectsCount] = useState<number>(0);
  const [overlayActive, setOverlayActive] = useState<boolean>(true);

  // Active item reference
  const currentItem: BatchSimulationItem | null =
    batchItems.length > 0 ? batchItems[activeItemIndex] || batchItems[0] : null;

  // Process batch of images through the architectural flowchart
  const processBatch = async (files: File[]) => {
    if (files.length === 0) return;

    // 1. Initial items setup
    const initialItems: BatchSimulationItem[] = files.map((file, idx) => ({
      id: `sim-part-${Date.now()}-${idx}`,
      file,
      previewUrl: URL.createObjectURL(file),
      isDefective: false,
      defectType: "nominal",
      confidence: 99.0,
      heatmapUrl: null,
      sensorReadings: [],
      gateVerdict: "GO",
      summary: "Processing component through architecture...",
    }));

    setBatchItems(initialItems);
    setActiveItemIndex(0);
    setStage("pilot_batch");

    // 2. Dispatch batch inspection to live backend (with fallback)
    const dispatchPromise = inspectBatchPhotos(files, { useMockFallback: true }).catch((err) => {
      console.warn("Batch model dispatch fallback:", err);
      const fallbackItems = files.map((f, i) => generateFallbackInspection(f, `P-SIM-0${i + 1}`));
      return {
        items: fallbackItems,
        rawJson: { status: "fallback", batch_id: `BATCH-${Date.now()}` },
        batchId: `BATCH-${Date.now()}`,
        gateDecision: fallbackItems.some((i) => i.status === "DEFECTIVE")
          ? ("CRITICAL STOP" as const)
          : ("GO" as const),
        defectsCount: fallbackItems.filter((i) => i.status === "DEFECTIVE").length,
        passedCount: fallbackItems.filter((i) => i.status !== "DEFECTIVE").length,
        latencyMs: 150,
        source: "resilient-engine" as const,
      };
    });

    // Ingest step: Pilot Batch
    await new Promise((r) => setTimeout(r, 1400));

    // Await API completion
    const batchResult = await dispatchPromise;
    const evaluatedItems: BatchSimulationItem[] = files.map((file, idx) => {
      const item = batchResult.items[idx] || batchResult.items[0];
      const hasDefect = item.status === "DEFECTIVE";
      const determinedDefect = item.defectType || (hasDefect ? "Defect" : "Nominal");
      const determinedConf = item.confidenceScore || (hasDefect ? 94.8 : 99.1);
      const determinedHeatmap =
        item.heatmapImageUrl ||
        item.visionResults?.heatmap_png_url ||
        item.visionResults?.heatmap_image_base64 ||
        null;

      const readings = (item.telemetry || []).slice(0, 4).map((s) => ({
        name: s.name,
        val: s.recordedValue,
        unit: s.unit,
        drift: s.isOutOfTolerance,
      }));

      const itemDecision =
        item.status === "DEFECTIVE"
          ? item.severity === "Critical"
            ? "CRITICAL STOP"
            : "ADJUST"
          : "GO";

      const summary =
        item.rootCauseSummary ||
        (hasDefect
          ? `${determinedDefect.toUpperCase()} identified. Telemetry corridors deviated during casting cycle.`
          : "Part verified nominal. Dimensions meet Six Sigma tolerances.");

      return {
        id: `sim-part-${Date.now()}-${idx}`,
        file,
        previewUrl: item.rawImageUrl || URL.createObjectURL(file),
        isDefective: hasDefect,
        defectType: determinedDefect,
        confidence: determinedConf,
        heatmapUrl: determinedHeatmap,
        sensorReadings: readings,
        gateVerdict: itemDecision,
        summary,
        inspectionItem: item,
      };
    });

    setBatchItems(evaluatedItems);
    setDefectsCount(batchResult.defectsCount);
    setBatchVerdict(batchResult.gateDecision);

    const rawBatchData = batchResult.rawJson as Record<string, unknown>;
    const supervisorSum =
      (typeof rawBatchData?.supervisor_summary === "string" ? rawBatchData.supervisor_summary : null) ||
      (typeof rawBatchData?.batch_analysis === "object" &&
      typeof (rawBatchData.batch_analysis as Record<string, unknown>)?.review === "string"
        ? (rawBatchData.batch_analysis as Record<string, unknown>).review
        : null) ||
      `${files.length} part(s) analyzed (${batchResult.passedCount} nominal, ${batchResult.defectsCount} defective).`;
    setBatchSummary(String(supervisorSum));

    // 3. Flow through the system architecture nodes sequentially
    for (let i = 0; i < evaluatedItems.length; i++) {
      setActiveItemIndex(i);
      const item = evaluatedItems[i];

      // Node: Model 1: filter (EfficientNet + Grad-CAM)
      setStage("model1");
      await new Promise((r) => setTimeout(r, 1600));

      if (item.isDefective) {
        // Node: Model 2: categorize (ResNet18)
        setStage("model2");
        await new Promise((r) => setTimeout(r, 1600));
      } else {
        // Direct bypass down to gatekeeper
        await new Promise((r) => setTimeout(r, 600));
      }

      // Node: Process data (Telemetry & Historical data)
      setStage("process_data");
      await new Promise((r) => setTimeout(r, 1000));

      // Node: Model 3: root cause (XGBoost)
      setStage("model3");
      await new Promise((r) => setTimeout(r, 1300));

      // Node: Gemini: structure (Clean JSON)
      setStage("gemini_struct");
      await new Promise((r) => setTimeout(r, 1200));
    }

    // Node: Pilot-batch gatekeeper (GO, ADJUST or CRITICAL STOP)
    setStage("gatekeeper");
    await new Promise((r) => setTimeout(r, 1600));

    // Node: Gemini: incident report (3-sentence supervisor summary)
    setStage("gemini_report");
    await new Promise((r) => setTimeout(r, 1500));

    // Node: Next.js dashboard
    setStage("dashboard");
  };

  const handleReset = () => {
    setStage("idle");
    setBatchItems([]);
    setActiveItemIndex(0);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
    if (droppedFiles.length > 0) {
      processBatch(droppedFiles);
    }
  };

  // Node active states
  const isPilotActive = stage === "pilot_batch";
  const isM1Active = stage === "model1";
  const isM2Active = stage === "model2";
  const isProcessActive = stage === "process_data";
  const isM3Active = stage === "model3";
  const isGeminiStructActive = stage === "gemini_struct";
  const isGatekeeperActive = stage === "gatekeeper";
  const isIncidentReportActive = stage === "gemini_report";
  const isDashboardActive = stage === "dashboard";

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F5] text-[#1C1917]">
      <LinenHeader />

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
        {/* Header Bar */}
        <div className="flex items-center justify-between gap-4 pb-3 border-b border-[#EAE4D7]">
          <div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-[#1C1917]">
              Pipeline Simulation
            </h1>
            <p className="text-xs text-[#78716A]">
              System architecture flowchart: External Inputs → FastAPI Core → Gatekeeper → Gemini Report → Dashboard.
            </p>
          </div>

          {stage !== "idle" && (
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#DDD5C7] bg-[#FFFFFF] hover:bg-[#F3EFE6] text-xs font-medium text-[#1C1917] transition-colors shadow-xs cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#78716A]" />
              <span>Reset Flow</span>
            </button>
          )}
        </div>

        {/* =========================================================================
            THE SYSTEM ARCHITECTURE FLOWCHART DIAGRAM
        ========================================================================= */}
        <div className="w-full flex-1 flex flex-col items-center justify-center py-2">
          <div className="w-full max-w-4xl flex flex-col items-center gap-5">
            {/* -------------------------------------------------------------------
                1. EXTERNAL INPUT NODES (TOP ROW)
            ------------------------------------------------------------------- */}
            <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
              {/* Top-Left Box: Pilot batch */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => {
                  if (stage === "idle") fileInputRef.current?.click();
                }}
                className={`rounded-xl border p-4 bg-white transition-all shadow-xs relative flex flex-col justify-between min-h-[110px] ${
                  isPilotActive
                    ? "border-[#00E5FF] ring-2 ring-[#00E5FF]/40 bg-[#F0FDFA]"
                    : stage !== "idle"
                    ? "border-[#1C1917] bg-[#FAF8F5]"
                    : "border-[#DDD5C7] hover:border-[#1C1917] cursor-pointer"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-[#1C1917] flex items-center justify-center text-white">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-[#1C1917]">Pilot batch</h3>
                      <p className="text-[11px] text-[#78716A]">5 impeller images</p>
                    </div>
                  </div>

                  <span
                    className={`font-mono text-[9px] font-bold px-2 py-0.5 rounded-full ${
                      isPilotActive
                        ? "bg-[#CCFBF1] text-[#0F766E]"
                        : batchItems.length > 0
                        ? "bg-[#F0FDF4] text-[#166534]"
                        : "bg-[#F3EFE6] text-[#78716A]"
                    }`}
                  >
                    {isPilotActive
                      ? "DISPATCHING"
                      : batchItems.length > 0
                      ? `${batchItems.length} LOADED`
                      : "CLICK TO UPLOAD"}
                  </span>
                </div>

                {/* Queue Thumbnails inside Pilot Batch box */}
                {batchItems.length > 0 ? (
                  <div className="flex items-center gap-1.5 pt-2 border-t border-[#F2ECE1] overflow-x-auto">
                    {batchItems.map((item, idx) => (
                      <div
                        key={item.id}
                        className={`w-7 h-7 rounded overflow-hidden border shrink-0 relative ${
                          idx === activeItemIndex
                            ? "border-[#00E5FF] ring-1 ring-[#00E5FF]"
                            : "border-[#E5DFD3] opacity-60"
                        }`}
                      >
                        <img src={item.previewUrl} alt="Thumbnail" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-[10px] text-[#A8A29E] pt-2 border-t border-[#F2ECE1]">
                    <span>Drop files or click</span>
                    <Upload className="w-3.5 h-3.5" />
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length > 0) processBatch(files);
                  }}
                  className="hidden"
                />
              </div>

              {/* Top-Right Container: Process data (Dashed border box) */}
              <div
                className={`rounded-xl border-2 border-dashed p-3 transition-all relative ${
                  isProcessActive
                    ? "border-[#F59E0B] bg-[#FFFBEB]/50 shadow-xs"
                    : "border-[#DDD5C7] bg-[#FCFBF8]"
                }`}
              >
                {/* Top edge badge label */}
                <div className="absolute -top-2.5 left-4 px-2 py-0.5 rounded bg-[#FAF8F5] border border-[#DDD5C7] text-[10px] font-mono font-bold text-[#78716A] uppercase tracking-wider">
                  Process data
                </div>

                <div className="flex flex-col gap-2 mt-1">
                  {/* Top Stacked Box: Telemetry */}
                  <div
                    className={`rounded-lg border p-2 flex items-center justify-between text-xs transition-colors ${
                      isProcessActive
                        ? "border-[#F59E0B] bg-white text-[#92400E] font-semibold"
                        : "border-[#E5DFD3] bg-white text-[#1C1917]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Activity className="w-3.5 h-3.5 text-[#F59E0B]" />
                      <span className="font-medium">Telemetry</span>
                    </div>
                    <span className="font-mono text-[10px] text-[#78716A]">6-axis PLC</span>
                  </div>

                  {/* Bottom Stacked Box: Historical data */}
                  <div
                    className={`rounded-lg border p-2 flex items-center justify-between text-xs transition-colors ${
                      isProcessActive || isM3Active
                        ? "border-[#F59E0B] bg-white text-[#92400E] font-semibold"
                        : "border-[#E5DFD3] bg-white text-[#1C1917]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Database className="w-3.5 h-3.5 text-[#78716A]" />
                      <span className="font-medium">Historical data</span>
                    </div>
                    <span className="font-mono text-[10px] text-[#78716A]">MongoDB Atlas</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Connecting Flow Indicator (Top -> Middle) */}
            <div className="w-full flex justify-around items-center px-12 -my-2 text-[#A8A29E]">
              <div className="flex flex-col items-center">
                <div className={`w-0.5 h-6 transition-colors ${isPilotActive || isM1Active ? "bg-[#00E5FF]" : "bg-[#DDD5C7]"}`} />
                <div className={`w-2 h-2 rotate-45 border-b-2 border-r-2 -mt-1 ${isPilotActive || isM1Active ? "border-[#00E5FF]" : "border-[#DDD5C7]"}`} />
              </div>
              <div className="flex flex-col items-center">
                <div className={`w-0.5 h-6 transition-colors ${isProcessActive || isM3Active ? "bg-[#F59E0B]" : "bg-[#DDD5C7]"}`} />
                <div className={`w-2 h-2 rotate-45 border-b-2 border-r-2 -mt-1 ${isProcessActive || isM3Active ? "border-[#F59E0B]" : "border-[#DDD5C7]"}`} />
              </div>
            </div>

            {/* -------------------------------------------------------------------
                2. MAIN API CONTAINER (MIDDLE) - Large Dashed Border Box "FastAPI"
            ------------------------------------------------------------------- */}
            <div className="w-full rounded-2xl border-2 border-dashed border-[#DDD5C7] bg-[#FFFFFF] p-5 sm:p-6 relative shadow-xs flex flex-col gap-4">
              {/* Top edge badge label */}
              <div className="absolute -top-3 left-6 px-3 py-0.5 rounded-full bg-[#1C1917] text-[#FAF8F5] font-mono text-[10px] font-bold tracking-wider flex items-center gap-1.5 shadow-xs">
                <Server className="w-3 h-3 text-[#00E5FF]" />
                <span>FastAPI</span>
              </div>

              {/* Grid of the 4 Internal Core Pipeline Nodes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch mt-1">
                {/* Column 1: Model 1 -> Model 2 Flow */}
                <div className="flex flex-col gap-3">
                  {/* Model 1 (Filter): EfficientNet + Grad-CAM */}
                  <div
                    className={`rounded-xl border p-3.5 transition-all flex flex-col justify-between ${
                      isM1Active
                        ? "border-[#38BDF8] bg-[#F0F9FF] shadow-xs ring-2 ring-[#38BDF8]/40"
                        : currentItem && !currentItem.isDefective && stage !== "idle"
                        ? "border-[#86EFAC] bg-[#F0FDF4]"
                        : "border-[#E5DFD3] bg-[#FAF8F5]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Cpu className={`w-4 h-4 ${isM1Active ? "animate-spin text-[#0284C7]" : "text-[#78716A]"}`} />
                        <div>
                          <div className="font-bold text-xs text-[#1C1917]">Model 1: filter</div>
                          <div className="text-[10px] text-[#78716A] font-mono">EfficientNet + Grad-CAM</div>
                        </div>
                      </div>

                      <span
                        className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded ${
                          isM1Active
                            ? "bg-[#BAE6FD] text-[#0369A1]"
                            : currentItem && stage !== "idle" && stage !== "pilot_batch"
                            ? currentItem.isDefective
                              ? "bg-[#FEE2E2] text-[#991B1B]"
                              : "bg-[#DCFCE7] text-[#166534]"
                            : "bg-[#EAE4D7] text-[#78716A]"
                        }`}
                      >
                        {isM1Active
                          ? "FILTERING"
                          : currentItem && stage !== "idle" && stage !== "pilot_batch"
                          ? currentItem.isDefective
                            ? "DEFECT"
                            : "PASS (BYPASS)"
                          : "STANDBY"}
                      </span>
                    </div>
                  </div>

                  {/* Horizontal Arrow / Bypass indication between Model 1 & Model 2 */}
                  <div className="flex items-center justify-between px-2 text-[10px] font-mono text-[#78716A]">
                    <span className="flex items-center gap-1 text-[#166534]">
                      <span>↓ If OK: Bypass to Gatekeeper</span>
                    </span>
                    <span className="flex items-center gap-1 text-[#DC2626]">
                      <span>If Defect: Route to M2 →</span>
                    </span>
                  </div>

                  {/* Model 2 (Categorize): ResNet18 */}
                  <div
                    className={`rounded-xl border p-3.5 transition-all flex flex-col justify-between ${
                      isM2Active
                        ? "border-[#EF4444] bg-[#FEF2F2] shadow-xs ring-2 ring-[#EF4444]/40"
                        : currentItem?.isDefective && stage !== "idle" && stage !== "pilot_batch" && stage !== "model1"
                        ? "border-[#FCA5A5] bg-[#FFF5F5]"
                        : "border-[#E5DFD3] bg-[#FAF8F5] opacity-80"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Flame className={`w-4 h-4 ${isM2Active ? "animate-pulse text-[#DC2626]" : "text-[#78716A]"}`} />
                        <div>
                          <div className="font-bold text-xs text-[#1C1917]">Model 2: categorize</div>
                          <div className="text-[10px] text-[#78716A] font-mono">ResNet18</div>
                        </div>
                      </div>

                      <span
                        className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded capitalize ${
                          isM2Active
                            ? "bg-[#FEE2E2] text-[#991B1B]"
                            : currentItem?.isDefective && stage !== "idle" && stage !== "pilot_batch" && stage !== "model1"
                            ? "bg-[#FEE2E2] text-[#991B1B]"
                            : "bg-[#EAE4D7] text-[#78716A]"
                        }`}
                      >
                        {isM2Active
                          ? "CLASSIFYING"
                          : currentItem?.isDefective && stage !== "idle" && stage !== "pilot_batch" && stage !== "model1"
                          ? currentItem.defectType
                          : "BYPASS/IDLE"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Column 2: Model 3 -> Gemini Structure Flow */}
                <div className="flex flex-col gap-3">
                  {/* Model 3 (Root Cause): XGBoost */}
                  <div
                    className={`rounded-xl border p-3.5 transition-all flex flex-col justify-between ${
                      isM3Active
                        ? "border-[#F59E0B] bg-[#FFFBEB] shadow-xs ring-2 ring-[#F59E0B]/40"
                        : "border-[#E5DFD3] bg-[#FAF8F5]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Activity className={`w-4 h-4 ${isM3Active ? "animate-pulse text-[#D97706]" : "text-[#78716A]"}`} />
                        <div>
                          <div className="font-bold text-xs text-[#1C1917]">Model 3: root cause</div>
                          <div className="text-[10px] text-[#78716A] font-mono">XGBoost</div>
                        </div>
                      </div>

                      <span
                        className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded ${
                          isM3Active
                            ? "bg-[#FEF3C7] text-[#B45309]"
                            : currentItem && currentItem.sensorReadings.some((s) => s.drift) && stage !== "idle"
                            ? "bg-[#FEE2E2] text-[#991B1B]"
                            : "bg-[#EAE4D7] text-[#78716A]"
                        }`}
                      >
                        {isM3Active
                          ? "ANALYZING"
                          : currentItem && currentItem.sensorReadings.some((s) => s.drift) && stage !== "idle"
                          ? "DRIFT DETECTED"
                          : "NOMINAL"}
                      </span>
                    </div>
                  </div>

                  {/* Flow arrow down to Gemini Structure */}
                  <div className="flex justify-center -my-1 text-[#A8A29E]">
                    <div className="w-0.5 h-3 bg-[#DDD5C7]" />
                  </div>

                  {/* Gemini: structure: Root cause as clean JSON */}
                  <div
                    className={`rounded-xl border p-3.5 transition-all flex flex-col justify-between ${
                      isGeminiStructActive
                        ? "border-[#8B5CF6] bg-[#F5F3FF] shadow-xs ring-2 ring-[#8B5CF6]/40"
                        : "border-[#E5DFD3] bg-[#FAF8F5]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className={`w-4 h-4 ${isGeminiStructActive ? "animate-spin text-[#7C3AED]" : "text-[#78716A]"}`} />
                        <div>
                          <div className="font-bold text-xs text-[#1C1917]">Gemini: structure</div>
                          <div className="text-[10px] text-[#78716A] font-mono">Root cause as clean JSON</div>
                        </div>
                      </div>

                      <span
                        className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded ${
                          isGeminiStructActive
                            ? "bg-[#EDE9FE] text-[#6D28D9]"
                            : "bg-[#EAE4D7] text-[#78716A]"
                        }`}
                      >
                        {isGeminiStructActive ? "STRUCTURING" : "STANDBY"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Connecting Flow Down to Gatekeeper */}
            <div className="flex flex-col items-center -my-2 text-[#A8A29E]">
              <div className={`w-0.5 h-5 transition-colors ${isGatekeeperActive ? "bg-[#1C1917]" : "bg-[#DDD5C7]"}`} />
              <div className={`w-2 h-2 rotate-45 border-b-2 border-r-2 -mt-1 ${isGatekeeperActive ? "border-[#1C1917]" : "border-[#DDD5C7]"}`} />
            </div>

            {/* -------------------------------------------------------------------
                3. GATEKEEPER NODE (CENTER-LOW) - Wide Prominent Rectangle
            ------------------------------------------------------------------- */}
            <div
              className={`w-full rounded-2xl border-2 p-4 transition-all shadow-md flex items-center justify-between gap-4 ${
                isGatekeeperActive || isIncidentReportActive || isDashboardActive
                  ? batchVerdict === "GO"
                    ? "border-[#22C55E] bg-[#F0FDF4] text-[#166534]"
                    : batchVerdict === "ADJUST"
                    ? "border-[#F59E0B] bg-[#FFFBEB] text-[#92400E]"
                    : "border-[#EF4444] bg-[#FEF2F2] text-[#991B1B]"
                  : "border-[#1C1917] bg-[#FFFFFF] text-[#1C1917]"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    batchVerdict === "GO" && (isGatekeeperActive || isIncidentReportActive || isDashboardActive)
                      ? "bg-[#16A34A] text-white"
                      : batchVerdict === "CRITICAL STOP" && (isGatekeeperActive || isIncidentReportActive || isDashboardActive)
                      ? "bg-[#DC2626] text-white"
                      : "bg-[#1C1917] text-white"
                  }`}
                >
                  <Filter className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold tracking-tight">
                    Pilot-batch gatekeeper
                  </h2>
                  <p className="text-xs opacity-80 font-mono">
                    GO, ADJUST or CRITICAL STOP
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`font-mono text-xs sm:text-sm font-bold px-3 py-1 rounded-lg border shadow-xs ${
                    isGatekeeperActive || isIncidentReportActive || isDashboardActive
                      ? "bg-white/90"
                      : "bg-[#FAF8F5] border-[#DDD5C7] text-[#1C1917]"
                  }`}
                >
                  {isGatekeeperActive || isIncidentReportActive || isDashboardActive
                    ? `VERDICT: ${batchVerdict}`
                    : "EVALUATING GATE"}
                </span>
              </div>
            </div>

            {/* Connecting Flow Down to Incident Report */}
            <div className="flex flex-col items-center -my-2 text-[#A8A29E]">
              <div className={`w-0.5 h-5 transition-colors ${isIncidentReportActive ? "bg-[#8B5CF6]" : "bg-[#DDD5C7]"}`} />
              <div className={`w-2 h-2 rotate-45 border-b-2 border-r-2 -mt-1 ${isIncidentReportActive ? "border-[#8B5CF6]" : "border-[#DDD5C7]"}`} />
            </div>

            {/* -------------------------------------------------------------------
                4. OUTPUT & REPORTING NODES (BOTTOM)
            ------------------------------------------------------------------- */}
            <div className="w-full flex flex-col gap-4">
              {/* Incident Report Box: Gemini: incident report */}
              <div
                className={`w-full rounded-xl border p-4 transition-all shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isIncidentReportActive
                    ? "border-[#8B5CF6] bg-[#F5F3FF] shadow-xs ring-2 ring-[#8B5CF6]/40"
                    : "border-[#E5DFD3] bg-[#FFFFFF]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#8B5CF6]/15 flex items-center justify-center text-[#7C3AED] shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-xs sm:text-sm text-[#1C1917]">
                      Gemini: incident report
                    </h3>
                    <p className="text-[11px] text-[#78716A]">3-sentence supervisor summary</p>
                  </div>
                </div>

                {batchSummary && (isIncidentReportActive || isDashboardActive) ? (
                  <p className="text-xs text-[#57534E] max-w-md italic bg-[#FAF8F5] p-2 rounded-lg border border-[#EAE4D7]">
                    &ldquo;{batchSummary}&rdquo;
                  </p>
                ) : (
                  <span className="font-mono text-[10px] text-[#A8A29E]">Awaiting synthesis</span>
                )}
              </div>

              {/* Connecting Flow Down to Dashboard */}
              <div className="flex flex-col items-center -my-2 text-[#A8A29E]">
                <div className={`w-0.5 h-5 transition-colors ${isDashboardActive ? "bg-[#1C1917]" : "bg-[#DDD5C7]"}`} />
                <div className={`w-2 h-2 rotate-45 border-b-2 border-r-2 -mt-1 ${isDashboardActive ? "border-[#1C1917]" : "border-[#DDD5C7]"}`} />
              </div>

              {/* Dashboard Box (Final Output): Next.js dashboard */}
              <div
                className={`w-full rounded-2xl border p-4 sm:p-5 transition-all shadow-md flex flex-col md:flex-row items-center justify-between gap-4 ${
                  isDashboardActive
                    ? "border-[#1C1917] bg-[#1C1917] text-[#FAF8F5]"
                    : "border-[#DDD5C7] bg-[#FFFFFF] text-[#1C1917]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isDashboardActive ? "bg-white/10 text-[#00E5FF]" : "bg-[#FAF8F5] text-[#1C1917] border border-[#E5DFD3]"
                    }`}
                  >
                    <LayoutDashboard className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm sm:text-base">
                      Next.js dashboard
                    </h3>
                    <p
                      className={`text-xs ${
                        isDashboardActive ? "text-[#D6D3D1]" : "text-[#78716A]"
                      }`}
                    >
                      Status, heatmaps, quarantine
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {currentItem && isDashboardActive && (
                    <div className="relative w-16 h-12 rounded-lg overflow-hidden bg-black/40 border border-white/20">
                      <img src={currentItem.previewUrl} alt="Dossier" className="w-full h-full object-cover" />
                      {currentItem.isDefective && currentItem.heatmapUrl && (
                        <img src={currentItem.heatmapUrl} alt="Heatmap" className="absolute inset-0 w-full h-full object-cover mix-blend-screen opacity-75" />
                      )}
                    </div>
                  )}

                  <Link
                    href="/dashboard"
                    className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow-xs ${
                      isDashboardActive
                        ? "bg-[#FAF8F5] text-[#1C1917] hover:bg-white"
                        : "bg-[#1C1917] text-[#FAF8F5] hover:bg-[#2C2724]"
                    }`}
                  >
                    <span>Open Inspection Studio</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
