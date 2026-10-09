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
  Sliders,
} from "lucide-react";
import { LinenHeader } from "@/components/linen/LinenHeader";
import { inspectSinglePhoto, generateFallbackInspection } from "@/lib/api";
import { InspectionItem } from "@/lib/inspection-adapter";

export type PipelineStage =
  | "idle"        // Waiting for upload
  | "ingestion"   // Computer ingesting photo
  | "model1"      // Model 1 evaluating binary gate
  | "model2"      // Model 2 classifying defect & generating heatmap (if defect)
  | "telemetry"   // Server pulling physical telemetry
  | "report";     // Final report generated & displayed

export default function SimulationPage() {
  const [stage, setStage] = useState<PipelineStage>("idle");
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Model Results
  const [isDefective, setIsDefective] = useState<boolean>(false);
  const [defectType, setDefectType] = useState<string>("nominal");
  const [confidence, setConfidence] = useState<number>(98.5);
  const [heatmapSrc, setHeatmapSrc] = useState<string | null>(null);
  const [gateVerdict, setGateVerdict] = useState<"GO" | "ADJUST" | "CRITICAL STOP">("GO");
  const [reportSummary, setReportSummary] = useState<string>("");
  const [culpritSensor, setCulpritSensor] = useState<string | null>(null);
  const [sensorReadings, setSensorReadings] = useState<
    Array<{ name: string; val: number; unit: string; drift: boolean }>
  >([]);

  // Overlay toggle on final output
  const [overlayActive, setOverlayActive] = useState<boolean>(true);

  // Run the animated flow through computer -> server -> models -> report
  const processImage = async (file: File) => {
    // 1. Read image preview for the computer screen
    const reader = new FileReader();
    reader.onload = async () => {
      const b64 = reader.result as string;
      setImageSrc(b64);
      setStage("ingestion");

      // Dispatch to the real dashboard backend model in parallel with robust error handling
      const modelPromise = inspectSinglePhoto(file, { useMockFallback: true }).catch((err) => {
        console.warn("Backend model dispatch fallback:", err);
        const fallback = generateFallbackInspection(file, "P-SIM-01");
        return {
          item: fallback,
          rawJson: { status: fallback.status, defect_type: fallback.defectType },
          latencyMs: 120,
          source: "resilient-engine" as const,
        };
      });

      // Computer ingestion animation (1.4s)
      await new Promise((r) => setTimeout(r, 1400));

      // Move into Server Unit: Model 1 Gatekeeper
      setStage("model1");
      const [apiResponse] = await Promise.all([
        modelPromise,
        new Promise((r) => setTimeout(r, 1800)),
      ]);

      const item = apiResponse.item;
      const rawJson = apiResponse.rawJson;

      const hasDefect = item.status === "DEFECTIVE";
      const determinedDefect = item.defectType || (hasDefect ? "Defect" : "Nominal");
      const determinedConf = item.confidenceScore || (hasDefect ? 94.8 : 99.1);
      const determinedHeatmap =
        item.heatmapImageUrl ||
        item.visionResults?.heatmap_png_url ||
        item.visionResults?.heatmap_image_base64 ||
        null;

      const rawData = (rawJson as Record<string, unknown>) || {};
      const rawRc = (rawData.root_cause_analysis as Record<string, unknown> | undefined) || null;
      const decision =
        (typeof rawData.gate_decision === "string"
          ? (rawData.gate_decision as "GO" | "ADJUST" | "CRITICAL STOP")
          : undefined) || (hasDefect ? "ADJUST" : "GO");
      const summary =
        (typeof rawData.gemini_report === "string" ? rawData.gemini_report : undefined) ||
        item.rootCauseSummary ||
        (hasDefect
          ? "Surface defect identified. Thermal cooling and hydraulic pressure corridors deviated during casting cycle."
          : "Part verified nominal. Dimensions and surface matrices meet Six Sigma standards.");

      setIsDefective(hasDefect);
      setDefectType(determinedDefect);
      setConfidence(determinedConf);
      setHeatmapSrc(determinedHeatmap);
      setGateVerdict(decision);
      setReportSummary(summary);
      setCulpritSensor(typeof rawRc?.primary_culprit_sensor === "string" ? rawRc.primary_culprit_sensor : null);

      // Sensors from item
      const sReadings = (item.telemetry || []).slice(0, 4).map((s) => ({
        name: s.name,
        val: s.recordedValue,
        unit: s.unit,
        drift: s.isOutOfTolerance,
      }));
      setSensorReadings(sReadings);

      if (hasDefect) {
        // Defect branch: routes into Model 2 deep classifier
        setStage("model2");
        await new Promise((r) => setTimeout(r, 2000));
      } else {
        // OK branch: bypasses Model 2!
        await new Promise((r) => setTimeout(r, 500));
      }

      // Enters Telemetry engine
      setStage("telemetry");
      await new Promise((r) => setTimeout(r, 1800));

      // Output arrives at Report terminal
      setStage("report");
    };

    reader.readAsDataURL(file);
  };

  const handleReset = () => {
    setStage("idle");
    setImageSrc(null);
    setHeatmapSrc(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      processImage(file);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F5] text-[#1C1917]">
      <LinenHeader />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col justify-between gap-6">
        {/* Sleek Top Header Bar */}
        <div className="flex items-center justify-between gap-4 pb-3 border-b border-[#EAE4D7]">
          <div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-[#1C1917]">
              Pipeline Simulation
            </h1>
            <p className="text-xs text-[#78716A]">
              Physical component visual flow: Workstation Ingestion → Server Neural Engine → Report Terminal.
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
            THE VISUAL WORKFLOW: 3 CONNECTED HARDWARE STATIONS
            1. INGESTION WORKSTATION (LEFT)
            2. SERVER RACK & NEURAL MODELS (CENTER)
            3. REPORT TERMINAL (RIGHT)
        ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center flex-1 my-auto py-2">
          {/* =======================================================================
              STATION 1 (3 Cols): INGESTION WORKSTATION COMPUTER
          ======================================================================= */}
          <div className="lg:col-span-4 flex flex-col items-center">
            <div className="w-full bg-[#FFFFFF] border border-[#E5DFD3] rounded-2xl p-4 shadow-xs flex flex-col items-center gap-3 relative transition-all">
              {/* Station Label */}
              <div className="w-full flex items-center justify-between text-xs pb-2 border-b border-[#F2ECE1]">
                <span className="font-bold text-[#1C1917]">1. Ingestion Computer</span>
                <span
                  className={`font-mono text-[10px] px-2 py-0.5 rounded-full ${
                    stage === "ingestion"
                      ? "bg-[#FFFBEB] text-[#D97706] font-bold"
                      : stage !== "idle"
                      ? "bg-[#F0FDF4] text-[#166534]"
                      : "bg-[#FAF8F5] text-[#78716A]"
                  }`}
                >
                  {stage === "idle" ? "READY" : stage === "ingestion" ? "SCANNING" : "DISPATCHED"}
                </span>
              </div>

              {/* Vector Graphic: Computer Workstation Display */}
              <div className="w-full flex flex-col items-center">
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
                  {!imageSrc ? (
                    <div className="flex flex-col items-center justify-center gap-2 p-4 text-center">
                      <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white">
                        <Upload className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-semibold text-white">
                        Drop photo or click
                      </span>
                      <span className="text-[10px] text-white/60">
                        Camera / Sensor Intake
                      </span>
                    </div>
                  ) : (
                    <div className="relative w-full h-full flex items-center justify-center">
                      <img
                        src={imageSrc}
                        alt="Uploaded"
                        className="w-full h-full object-contain"
                      />

                      {/* Scanning laser beam passing across monitor during ingestion */}
                      {stage === "ingestion" && (
                        <div className="pointer-events-none absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#00E5FF] to-transparent shadow-[0_0_15px_#00E5FF] z-20 animate-laser-sweep" />
                      )}
                    </div>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) processImage(f);
                    }}
                    className="hidden"
                  />
                </div>

                {/* Computer Stand Base Graphic */}
                <div className="w-12 h-3 bg-[#9CA3AF] rounded-b-md shadow-xs" />
                <div className="w-24 h-1.5 bg-[#4B5563] rounded-full shadow-2xs" />
              </div>
            </div>
          </div>

          {/* =======================================================================
              STATION 2 (4 Cols): SERVER RACK & EMBEDDED NEURAL MODELS
          ======================================================================= */}
          <div className="lg:col-span-4 flex flex-col items-center">
            <div className="w-full bg-[#FFFFFF] border border-[#E5DFD3] rounded-2xl p-4 shadow-xs flex flex-col gap-3 relative">
              {/* Station Label */}
              <div className="w-full flex items-center justify-between text-xs pb-2 border-b border-[#F2ECE1]">
                <span className="font-bold text-[#1C1917]">2. AI Server & Models</span>
                <span
                  className={`font-mono text-[10px] px-2 py-0.5 rounded-full ${
                    stage === "model1" || stage === "model2" || stage === "telemetry"
                      ? "bg-[#FFFBEB] text-[#D97706] font-bold"
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
              <div className="w-full bg-[#1F2937] border-2 border-[#374151] rounded-xl p-3 flex flex-col gap-2.5 shadow-md">
                {/* Server Bay 1: Model 1 Binary Gatekeeper */}
                <div
                  className={`p-2.5 rounded-lg border text-xs flex items-center justify-between transition-all ${
                    stage === "model1"
                      ? "border-[#38BDF8] bg-[#0C4A6E]/50 text-white shadow-[0_0_10px_rgba(56,189,248,0.3)]"
                      : stage !== "idle" && stage !== "ingestion"
                      ? isDefective
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
                      : stage !== "idle" && stage !== "ingestion"
                      ? isDefective
                        ? "⚠ DEFECT"
                        : "✓ NOMINAL"
                      : "IDLE"}
                  </span>
                </div>

                {/* Animated Branching Conduit Graphic between Model 1 and Model 2 */}
                <div className="w-full flex items-center justify-between text-[10px] font-mono px-2 py-0.5">
                  <span
                    className={`flex items-center gap-1 transition-colors ${
                      !isDefective && (stage === "telemetry" || stage === "report")
                        ? "text-[#22C55E] font-bold"
                        : "text-white/30"
                    }`}
                  >
                    {!isDefective && (stage === "telemetry" || stage === "report") ? "✓ Bypass (Part OK)" : "Bypass Corridor"}
                  </span>
                  <span
                    className={`flex items-center gap-1 transition-colors ${
                      isDefective && (stage === "model2" || stage === "telemetry" || stage === "report")
                        ? "text-[#EF4444] font-bold"
                        : "text-white/30"
                    }`}
                  >
                    {isDefective ? "↓ Defect Route" : "Defect Route"}
                  </span>
                </div>

                {/* Server Bay 2: Model 2 Deep Classifier & Heatmap (Bypassed if OK) */}
                <div
                  className={`p-2.5 rounded-lg border text-xs flex items-center justify-between transition-all ${
                    stage === "model2"
                      ? "border-[#EF4444] bg-[#7F1D1D]/60 text-white shadow-[0_0_12px_rgba(239,68,68,0.4)]"
                      : isDefective && (stage === "telemetry" || stage === "report")
                      ? "border-[#EF4444] bg-[#7F1D1D]/40 text-white"
                      : !isDefective && (stage === "telemetry" || stage === "report")
                      ? "border-[#4B5563] bg-[#111827]/40 text-white/30"
                      : "border-[#4B5563] bg-[#111827] text-white/50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Flame className={`w-4 h-4 ${stage === "model2" ? "text-[#EF4444] animate-pulse" : ""}`} />
                    <div>
                      <div className="font-bold text-[11px]">
                        {!isDefective && (stage === "telemetry" || stage === "report")
                          ? "Model 2: Bypassed"
                          : "Model 2: Deep"}
                      </div>
                      <div className="text-[10px] opacity-75">
                        {!isDefective && (stage === "telemetry" || stage === "report")
                          ? "Skipped (Part OK)"
                          : "Grad-CAM Heatmap"}
                      </div>
                    </div>
                  </div>

                  <span className="text-[10px] font-mono font-bold capitalize">
                    {stage === "model2"
                      ? "MAPPING..."
                      : isDefective && (stage === "telemetry" || stage === "report")
                      ? defectType
                      : !isDefective && (stage === "telemetry" || stage === "report")
                      ? "SKIPPED"
                      : "IDLE"}
                  </span>
                </div>

                {/* Server Bay 3: Process Telemetry Corroborator */}
                <div
                  className={`p-2.5 rounded-lg border text-xs flex items-center justify-between transition-all ${
                    stage === "telemetry"
                      ? "border-[#F59E0B] bg-[#78350F]/50 text-white shadow-[0_0_10px_rgba(245,158,11,0.3)]"
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
                      : stage === "report"
                      ? culpritSensor
                        ? "DRIFT DETECTED"
                        : "ALL NOMINAL"
                      : "IDLE"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* =======================================================================
              STATION 3 (5 Cols): INSPECTOR TABLET & REPORT OUTPUT
          ======================================================================= */}
          <div className="lg:col-span-4 flex flex-col items-center">
            <div className="w-full bg-[#FFFFFF] border border-[#E5DFD3] rounded-2xl p-4 shadow-xs flex flex-col gap-3 relative transition-all">
              {/* Station Label */}
              <div className="w-full flex items-center justify-between text-xs pb-2 border-b border-[#F2ECE1]">
                <span className="font-bold text-[#1C1917]">3. Report Terminal</span>
                <span
                  className={`font-mono text-[10px] px-2 py-0.5 rounded-full ${
                    stage === "report"
                      ? isDefective
                        ? "bg-[#FEF2F2] text-[#991B1B] font-bold"
                        : "bg-[#F0FDF4] text-[#166534] font-bold"
                      : "bg-[#FAF8F5] text-[#78716A]"
                  }`}
                >
                  {stage === "report" ? "FINAL DOSSIER" : "AWAITING"}
                </span>
              </div>

              {/* Vector Graphic: Inspector Tablet / Dossier Slate */}
              <div className="w-full bg-[#FAF8F5] border-2 border-[#DDD5C7] rounded-xl p-3 flex flex-col gap-3 shadow-inner min-h-[300px]">
                {stage !== "report" ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-[#78716A] gap-2">
                    <FileText className="w-8 h-8 opacity-40" />
                    <span className="text-xs font-medium">Awaiting Pipeline Results</span>
                    <span className="text-[10px] opacity-75">
                      The generated diagnosis and overlays will display here.
                    </span>
                  </div>
                ) : (
                  /* Finalized Visual Dossier */
                  <div className="flex flex-col gap-3">
                    {/* Processed Component Image with Heatmap Toggle */}
                    <div className="relative w-full aspect-[16/9] rounded-lg overflow-hidden bg-[#111827] flex items-center justify-center border border-[#E5DFD3]">
                      {imageSrc && (
                        <div className="relative w-full h-full flex items-center justify-center">
                          <img
                            src={imageSrc}
                            alt="Component"
                            className="w-full h-full object-contain"
                          />
                          {isDefective && heatmapSrc && overlayActive && (
                            <img
                              src={heatmapSrc}
                              alt="Heatmap"
                              className="absolute inset-0 w-full h-full object-contain mix-blend-screen opacity-70 pointer-events-none"
                            />
                          )}
                        </div>
                      )}

                      {/* Overlay Toggle Button */}
                      {isDefective && heatmapSrc && (
                        <button
                          type="button"
                          onClick={() => setOverlayActive((prev) => !prev)}
                          className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/70 backdrop-blur-sm text-[10px] text-white font-medium hover:bg-black/90 cursor-pointer"
                        >
                          {overlayActive ? "Heatmap On" : "Heatmap Off"}
                        </button>
                      )}
                    </div>

                    {/* Gate Verdict Badge */}
                    <div
                      className={`p-2.5 rounded-lg border flex items-center justify-between text-xs ${
                        isDefective
                          ? "bg-[#FEF2F2] border-[#FCA5A5] text-[#991B1B]"
                          : "bg-[#F0FDF4] border-[#86EFAC] text-[#166534]"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold">
                        {isDefective ? (
                          <AlertTriangle className="w-4 h-4 text-[#DC2626]" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
                        )}
                        <span>{isDefective ? `DEFECT: ${defectType.toUpperCase()}` : "NOMINAL PASS"}</span>
                      </div>
                      <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-white/70">
                        DECISION: {gateVerdict}
                      </span>
                    </div>

                    {/* Executive Report Summary */}
                    <div className="p-2.5 rounded-lg bg-[#FFFFFF] border border-[#E5DFD3] text-xs space-y-1">
                      <div className="font-bold text-[#1C1917] text-[11px]">Executive Summary</div>
                      <p className="text-[11px] text-[#57534E] leading-relaxed">
                        {reportSummary}
                      </p>
                    </div>

                    {/* Action: Open in Studio */}
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
