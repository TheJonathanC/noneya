"use client";

import React, { useState, useRef, useEffect } from "react";
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
  Sliders,
  Play,
} from "lucide-react";
import { LinenHeader } from "@/components/linen/LinenHeader";
import { DotSwarm } from "dots-swarm";
import { inspectBatchPhotos, inspectSinglePhoto, generateFallbackInspection } from "@/lib/api";
import { InspectionItem } from "@/lib/inspection-adapter";

export type PipelineStage =
  | "idle"        // Waiting for upload
  | "ingestion"   // Computer ingesting batch photos
  | "model1"      // Model 1 evaluating binary gate
  | "model2"      // Model 2 classifying defect & generating heatmap (if defect)
  | "telemetry"   // Server pulling physical telemetry
  | "report";     // Final report generated & displayed

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

  // Overlay toggle on final report output
  const [overlayActive, setOverlayActive] = useState<boolean>(true);

  // Active item reference
  const currentItem: BatchSimulationItem | null =
    batchItems.length > 0 ? batchItems[activeItemIndex] || batchItems[0] : null;

  // Process batch of images with physical transport animation
  const processBatch = async (files: File[]) => {
    if (files.length === 0) return;

    // 1. Preload local preview URLs for instantaneous visual queue
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
      summary: "Processing component through pipeline...",
    }));

    setBatchItems(initialItems);
    setActiveItemIndex(0);
    setStage("ingestion");

    // 2. Dispatch the exact same batch call as Dashboard
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

    // Animate computer ingestion scanning (1.6s)
    await new Promise((r) => setTimeout(r, 1600));

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

    // 3. Sequential physical animation of items moving through the pipeline
    for (let i = 0; i < evaluatedItems.length; i++) {
      setActiveItemIndex(i);
      const item = evaluatedItems[i];

      // Item enters Server Bay 1: Model 1 Gate
      setStage("model1");
      await new Promise((r) => setTimeout(r, 1500));

      // Route based on binary gate
      if (item.isDefective) {
        // Enters Model 2 deep classifier
        setStage("model2");
        await new Promise((r) => setTimeout(r, 1800));
      } else {
        // Skips Model 2 via bypass conduit
        await new Promise((r) => setTimeout(r, 600));
      }

      // Corroborate physical telemetry
      setStage("telemetry");
      await new Promise((r) => setTimeout(r, 1200));
    }

    // Pipeline delivers finalized dossier to station 3
    setStage("report");
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

  // Determine conduit and transport states
  const isBypassing = currentItem ? !currentItem.isDefective && (stage === "telemetry" || stage === "report") : false;
  const isRoutingDefect = currentItem ? currentItem.isDefective && (stage === "model2" || stage === "telemetry" || stage === "report") : false;

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F5] text-[#1C1917]">
      <LinenHeader />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col justify-between gap-6">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between gap-4 pb-3 border-b border-[#EAE4D7]">
          <div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-[#1C1917]">
              Pipeline Simulation
            </h1>
            <p className="text-xs text-[#78716A]">
              Physical component flow: Workstation Ingestion → Server Neural Engine → Report Terminal.
            </p>
          </div>

          {stage !== "idle" && (
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#DDD5C7] bg-[#FFFFFF] hover:bg-[#F3EFE6] text-xs font-medium text-[#1C1917] transition-colors shadow-xs cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#78716A]" />
              <span>Reset Batch</span>
            </button>
          )}
        </div>

        {/* =========================================================================
            THE VISUAL WORKFLOW: 3 CONNECTED HARDWARE STATIONS
            1. INGESTION WORKSTATION (LEFT)
            2. SERVER RACK & NEURAL MODELS (CENTER)
            3. REPORT TERMINAL (RIGHT)
        ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch flex-1 my-auto py-2">
          {/* =======================================================================
              STATION 1 (4 Cols): INGESTION WORKSTATION COMPUTER
          ======================================================================= */}
          <div className="lg:col-span-4 flex flex-col">
            <div className="w-full h-full bg-[#FFFFFF] border border-[#E5DFD3] rounded-2xl p-4 shadow-xs flex flex-col justify-between gap-3 relative transition-all">
              {/* Station Label */}
              <div className="w-full flex items-center justify-between text-xs pb-2 border-b border-[#F2ECE1]">
                <div className="flex items-center gap-1.5 font-bold text-[#1C1917]">
                  <Upload className="w-3.5 h-3.5 text-[#78716A]" />
                  <span>1. Ingestion Computer</span>
                </div>
                <span
                  className={`font-mono text-[10px] px-2 py-0.5 rounded-full ${
                    stage === "ingestion"
                      ? "bg-[#FFFBEB] text-[#D97706] font-bold animate-pulse"
                      : stage !== "idle"
                      ? "bg-[#F0FDF4] text-[#166534]"
                      : "bg-[#FAF8F5] text-[#78716A]"
                  }`}
                >
                  {stage === "idle"
                    ? "READY"
                    : stage === "ingestion"
                    ? `INGESTING (${batchItems.length})`
                    : `DISPATCHED`}
                </span>
              </div>

              {/* Vector Graphic: Computer Workstation Display */}
              <div className="w-full flex-1 flex flex-col items-center justify-center">
                {/* Computer Screen Frame */}
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
                  className={`w-full aspect-[4/3] rounded-xl border-4 border-[#1C1917] bg-[#111827] relative overflow-hidden flex items-center justify-center shadow-md transition-colors ${
                    stage === "idle" ? "cursor-pointer hover:border-[#4B5563]" : ""
                  }`}
                >
                  {/* Inside Computer Screen */}
                  {batchItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 p-4 text-center">
                      <div className="w-12 h-12 relative flex items-center justify-center">
                        <DotSwarm
                          shape="lattice"
                          count={240}
                          color="#00E5FF"
                          speed={0.9}
                          dotSize={1.5}
                          choreography="flow"
                          className="w-full h-full"
                        />
                      </div>
                      <span className="text-xs font-semibold text-white">
                        Drop photos or click to ingest
                      </span>
                      <span className="text-[10px] text-white/60">
                        Camera / optical sensor batch intake
                      </span>
                    </div>
                  ) : (
                    <div className="relative w-full h-full flex items-center justify-center p-2">
                      {currentItem && (
                        <img
                          src={currentItem.previewUrl}
                          alt="Component Intake"
                          className="w-full h-full object-contain transition-all duration-300"
                        />
                      )}

                      {/* Scanning laser beam passing across monitor during ingestion */}
                      {stage === "ingestion" && (
                        <div className="pointer-events-none absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#00E5FF] to-transparent shadow-[0_0_15px_#00E5FF] z-20 animate-laser-sweep" />
                      )}

                      {/* Current Processing Part Badge in Screen Corner */}
                      {batchItems.length > 1 && (
                        <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/75 backdrop-blur-xs font-mono text-[9px] text-[#00E5FF] border border-[#00E5FF]/40">
                          PART {activeItemIndex + 1}/{batchItems.length}
                        </div>
                      )}
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

                {/* Computer Stand Base Graphic */}
                <div className="w-12 h-3 bg-[#9CA3AF] rounded-b-md shadow-xs" />
                <div className="w-24 h-1.5 bg-[#4B5563] rounded-full shadow-2xs" />
              </div>

              {/* Physical Batch Conveyor Feed Bar */}
              {batchItems.length > 0 && (
                <div className="w-full pt-1 border-t border-[#F2ECE1] flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-[10px] text-[#78716A]">
                    <span className="font-semibold text-[#1C1917]">Intake Queue</span>
                    <span className="font-mono">{activeItemIndex + 1} of {batchItems.length} in transit</span>
                  </div>
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    {batchItems.map((item, idx) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setActiveItemIndex(idx)}
                        className={`relative w-9 h-9 rounded-md overflow-hidden border flex-shrink-0 cursor-pointer transition-all ${
                          idx === activeItemIndex
                            ? "border-[#00E5FF] ring-2 ring-[#00E5FF]/50 scale-105"
                            : "border-[#E5DFD3] opacity-65 hover:opacity-100"
                        }`}
                      >
                        <img
                          src={item.previewUrl}
                          alt="Thumbnail"
                          className="w-full h-full object-cover"
                        />
                        {stage === "report" && (
                          <div
                            className={`absolute inset-0 flex items-center justify-center text-[8px] font-bold font-mono text-white ${
                              item.isDefective ? "bg-[#DC2626]/75" : "bg-[#16A34A]/75"
                            }`}
                          >
                            {item.isDefective ? "DEF" : "OK"}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* =======================================================================
              STATION 2 (4 Cols): SERVER RACK & EMBEDDED NEURAL MODELS
          ======================================================================= */}
          <div className="lg:col-span-4 flex flex-col">
            <div className="w-full h-full bg-[#FFFFFF] border border-[#E5DFD3] rounded-2xl p-4 shadow-xs flex flex-col justify-between gap-3 relative">
              {/* Station Label */}
              <div className="w-full flex items-center justify-between text-xs pb-2 border-b border-[#F2ECE1]">
                <div className="flex items-center gap-1.5 font-bold text-[#1C1917]">
                  <Cpu className="w-3.5 h-3.5 text-[#78716A]" />
                  <span>2. AI Server & Models</span>
                </div>
                <span
                  className={`font-mono text-[10px] px-2 py-0.5 rounded-full ${
                    stage === "model1" || stage === "model2" || stage === "telemetry"
                      ? "bg-[#FFFBEB] text-[#D97706] font-bold animate-pulse"
                      : stage === "report"
                      ? "bg-[#F0FDF4] text-[#166534]"
                      : "bg-[#FAF8F5] text-[#78716A]"
                  }`}
                >
                  {stage === "model1"
                    ? "MODEL 1 GATE"
                    : stage === "model2"
                    ? "MODEL 2 DEEP"
                    : stage === "telemetry"
                    ? "TELEMETRY SYNC"
                    : stage === "report"
                    ? "COMPLETE"
                    : "STANDBY"}
                </span>
              </div>

              {/* Graphic: Server Chassis with Modular Neural Units */}
              <div className="w-full bg-[#1F2937] border-2 border-[#374151] rounded-xl p-3 flex flex-col gap-2.5 shadow-md flex-1 justify-center">
                {/* Visual Pipeline Transit Indicator */}
                {currentItem && (
                  <div className="flex items-center justify-between px-2.5 py-1.5 bg-[#111827] rounded-md border border-[#374151] text-[10px] font-mono text-white/80">
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 shrink-0 relative flex items-center justify-center">
                        <DotSwarm
                          shape={
                            stage === "model1"
                              ? "atom"
                              : stage === "model2"
                              ? "spark"
                              : stage === "telemetry"
                              ? "equalizer"
                              : "loader"
                          }
                          count={140}
                          color="#00E5FF"
                          speed={1.4}
                          dotSize={1.5}
                          choreography="flow"
                          className="w-full h-full"
                        />
                      </div>
                      <span>Component #{activeItemIndex + 1} In Transit</span>
                    </span>
                    <span className="text-[#00E5FF] font-bold">
                      {stage.toUpperCase()}
                    </span>
                  </div>
                )}

                {/* Server Bay 1: Model 1 Binary Gatekeeper */}
                <div
                  className={`p-2.5 rounded-lg border text-xs flex items-center justify-between transition-all ${
                    stage === "model1"
                      ? "border-[#38BDF8] bg-[#0C4A6E]/50 text-white shadow-[0_0_10px_rgba(56,189,248,0.3)] ring-1 ring-[#38BDF8]"
                      : stage !== "idle" && stage !== "ingestion" && currentItem
                      ? currentItem.isDefective
                        ? "border-[#EF4444] bg-[#7F1D1D]/40 text-white"
                        : "border-[#22C55E] bg-[#14532D]/40 text-white"
                      : "border-[#4B5563] bg-[#111827] text-white/50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Cpu className={`w-4 h-4 ${stage === "model1" ? "animate-spin text-[#38BDF8]" : ""}`} />
                    <div>
                      <div className="font-bold text-[11px]">Model 1: Binary Gate</div>
                      <div className="text-[10px] opacity-75">ResNet-18 Screening</div>
                    </div>
                  </div>

                  <span className="text-[10px] font-mono font-bold">
                    {stage === "model1"
                      ? "EVALUATING..."
                      : stage !== "idle" && stage !== "ingestion" && currentItem
                      ? currentItem.isDefective
                        ? "⚠ DEFECT"
                        : "✓ NOMINAL"
                      : "IDLE"}
                  </span>
                </div>

                {/* Animated Branching Conduit Graphic between Model 1 and Model 2 */}
                <div className="w-full flex items-center justify-between text-[10px] font-mono px-2 py-0.5">
                  <span
                    className={`flex items-center gap-1 transition-colors ${
                      isBypassing
                        ? "text-[#22C55E] font-bold"
                        : "text-white/30"
                    }`}
                  >
                    {isBypassing ? "✓ Bypass (Part OK)" : "Bypass Corridor"}
                  </span>
                  <span
                    className={`flex items-center gap-1 transition-colors ${
                      isRoutingDefect
                        ? "text-[#EF4444] font-bold"
                        : "text-white/30"
                    }`}
                  >
                    {isRoutingDefect ? "↓ Defect Route" : "Defect Route"}
                  </span>
                </div>

                {/* Server Bay 2: Model 2 Deep Classifier & Heatmap (Bypassed if OK) */}
                <div
                  className={`p-2.5 rounded-lg border text-xs flex items-center justify-between transition-all ${
                    stage === "model2"
                      ? "border-[#EF4444] bg-[#7F1D1D]/60 text-white shadow-[0_0_12px_rgba(239,68,68,0.4)] ring-1 ring-[#EF4444]"
                      : isRoutingDefect
                      ? "border-[#EF4444] bg-[#7F1D1D]/40 text-white"
                      : isBypassing
                      ? "border-[#4B5563] bg-[#111827]/40 text-white/30"
                      : "border-[#4B5563] bg-[#111827] text-white/50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Flame className={`w-4 h-4 ${stage === "model2" ? "text-[#EF4444] animate-pulse" : ""}`} />
                    <div>
                      <div className="font-bold text-[11px]">
                        {isBypassing ? "Model 2: Bypassed" : "Model 2: Deep Classifier"}
                      </div>
                      <div className="text-[10px] opacity-75">
                        {isBypassing ? "Skipped (Part OK)" : "Grad-CAM Heatmap"}
                      </div>
                    </div>
                  </div>

                  <span className="text-[10px] font-mono font-bold capitalize">
                    {stage === "model2"
                      ? "CLASSIFYING..."
                      : isRoutingDefect && currentItem
                      ? currentItem.defectType
                      : isBypassing
                      ? "SKIPPED"
                      : "IDLE"}
                  </span>
                </div>

                {/* Server Bay 3: Process Telemetry Corroborator */}
                <div
                  className={`p-2.5 rounded-lg border text-xs flex items-center justify-between transition-all ${
                    stage === "telemetry"
                      ? "border-[#F59E0B] bg-[#78350F]/50 text-white shadow-[0_0_10px_rgba(245,158,11,0.3)] ring-1 ring-[#F59E0B]"
                      : stage === "report"
                      ? "border-[#22C55E] bg-[#14532D]/40 text-white"
                      : "border-[#4B5563] bg-[#111827] text-white/50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Activity className={`w-4 h-4 ${stage === "telemetry" ? "text-[#F59E0B] animate-pulse" : ""}`} />
                    <div>
                      <div className="font-bold text-[11px]">Process Telemetry</div>
                      <div className="text-[10px] opacity-75">PLC 6-Axis Sensors</div>
                    </div>
                  </div>

                  <span className="text-[10px] font-mono font-bold">
                    {stage === "telemetry"
                      ? "CORROBORATING..."
                      : stage === "report" && currentItem
                      ? currentItem.sensorReadings.some((s) => s.drift)
                        ? "DRIFT DETECTED"
                        : "ALL NOMINAL"
                      : "IDLE"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* =======================================================================
              STATION 3 (4 Cols): INSPECTOR TABLET & REPORT OUTPUT
          ======================================================================= */}
          <div className="lg:col-span-4 flex flex-col">
            <div className="w-full h-full bg-[#FFFFFF] border border-[#E5DFD3] rounded-2xl p-4 shadow-xs flex flex-col justify-between gap-3 relative transition-all">
              {/* Station Label */}
              <div className="w-full flex items-center justify-between text-xs pb-2 border-b border-[#F2ECE1]">
                <div className="flex items-center gap-1.5 font-bold text-[#1C1917]">
                  <FileText className="w-3.5 h-3.5 text-[#78716A]" />
                  <span>3. Report Terminal</span>
                </div>
                <span
                  className={`font-mono text-[10px] px-2 py-0.5 rounded-full ${
                    stage === "report"
                      ? batchVerdict === "GO"
                        ? "bg-[#F0FDF4] text-[#166534] font-bold"
                        : "bg-[#FEF2F2] text-[#991B1B] font-bold"
                      : "bg-[#FAF8F5] text-[#78716A]"
                  }`}
                >
                  {stage === "report" ? "FINAL DOSSIER" : "AWAITING"}
                </span>
              </div>

              {/* Vector Graphic: Inspector Tablet / Dossier Slate */}
              <div className="w-full flex-1 bg-[#FAF8F5] border-2 border-[#DDD5C7] rounded-xl p-3 flex flex-col justify-between gap-3 shadow-inner">
                {stage !== "report" || !currentItem ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-[#78716A] gap-3">
                    <div className="w-14 h-14 relative flex items-center justify-center">
                      <DotSwarm
                        shape={stage === "idle" ? "equalizer" : "orb"}
                        count={300}
                        color="#78716A"
                        speed={0.8}
                        dotSize={1.6}
                        choreography="flow"
                        className="w-full h-full"
                      />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-[#1C1917]">
                        {stage === "idle" ? "Awaiting Batch Intake" : "Synthesizing Diagnostic Dossier..."}
                      </div>
                      <div className="text-[10px] text-[#78716A] mt-0.5">
                        {stage === "idle"
                          ? "Components will pass through neural stages and render here."
                          : "Grad-CAM segmentation & PLC telemetry active."}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Finalized Visual Dossier */
                  <div className="flex flex-col gap-3">
                    {/* Processed Component Image with Heatmap Toggle */}
                    <div className="relative w-full aspect-[16/9] rounded-lg overflow-hidden bg-[#111827] flex items-center justify-center border border-[#E5DFD3]">
                      <img
                        src={currentItem.previewUrl}
                        alt="Component"
                        className="w-full h-full object-contain"
                      />
                      {currentItem.isDefective && currentItem.heatmapUrl && overlayActive && (
                        <img
                          src={currentItem.heatmapUrl}
                          alt="Heatmap"
                          className="absolute inset-0 w-full h-full object-contain mix-blend-screen opacity-70 pointer-events-none"
                        />
                      )}

                      {/* Overlay Toggle Button */}
                      {currentItem.isDefective && currentItem.heatmapUrl && (
                        <button
                          type="button"
                          onClick={() => setOverlayActive((prev) => !prev)}
                          className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/70 backdrop-blur-xs text-[10px] text-white font-medium hover:bg-black/90 cursor-pointer"
                        >
                          {overlayActive ? "Heatmap On" : "Heatmap Off"}
                        </button>
                      )}
                    </div>

                    {/* Gate Verdict Badge */}
                    <div
                      className={`p-2.5 rounded-lg border flex items-center justify-between text-xs ${
                        currentItem.isDefective
                          ? "bg-[#FEF2F2] border-[#FCA5A5] text-[#991B1B]"
                          : "bg-[#F0FDF4] border-[#86EFAC] text-[#166534]"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold">
                        {currentItem.isDefective ? (
                          <AlertTriangle className="w-4 h-4 text-[#DC2626]" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
                        )}
                        <span>
                          {currentItem.isDefective
                            ? `DEFECT: ${currentItem.defectType.toUpperCase()}`
                            : "NOMINAL PASS"}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-white/70">
                        {currentItem.gateVerdict}
                      </span>
                    </div>

                    {/* Batch Summary or Executive Briefing */}
                    <div className="p-2.5 rounded-lg bg-[#FFFFFF] border border-[#E5DFD3] text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#1C1917] text-[11px]">
                          {batchItems.length > 1 ? "Batch Executive Summary" : "Executive Summary"}
                        </span>
                        {batchItems.length > 1 && (
                          <span className="font-mono text-[10px] text-[#78716A]">
                            {defectsCount} defect(s) / {batchItems.length} total
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#57534E] leading-relaxed">
                        {batchItems.length > 1 ? batchSummary : currentItem.summary}
                      </p>
                    </div>

                    {/* Action: Open in Studio Dashboard */}
                    <Link
                      href="/dashboard"
                      className="w-full py-2 px-3 rounded-lg bg-[#1C1917] hover:bg-[#2C2724] text-[#FAF8F5] font-semibold text-center text-xs transition-colors shadow-xs flex items-center justify-center gap-1.5"
                    >
                      <span>Open in Studio Dashboard</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
