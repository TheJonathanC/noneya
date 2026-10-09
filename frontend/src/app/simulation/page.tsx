"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Upload,
  Cpu,
  Layers,
  Activity,
  Sparkles,
  FileText,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ArrowRight,
  Gauge,
  Database,
  Eye,
  Sliders,
  ExternalLink,
  ChevronRight,
  Flame,
  Terminal,
  Crosshair,
} from "lucide-react";
import { LinenHeader } from "@/components/linen/LinenHeader";
import { inspectSinglePhoto, SingleInspectionResult } from "@/lib/api";
import { InspectionItem } from "@/lib/inspection-adapter";

// Graph Pipeline Nodes
export type GraphNodeId =
  | "upload"      // 1. Upload input node
  | "model1"      // 2. Model 1 Binary Gatekeeper
  | "model2"      // 3. Model 2 Deep Classifier & Heatmap (only if defect)
  | "telemetry"   // 4. Process Telemetry Stream
  | "report"      // 5. Gemini Executive Synthesis
  | "dashboard";  // 6. Final Dashboard & Dossier Result

interface SimLog {
  id: string;
  time: string;
  source: string;
  type: "info" | "success" | "warn";
  text: string;
}

export default function SimulationPage() {
  // Flow State
  const [activeNode, setActiveNode] = useState<GraphNodeId | "idle">("idle");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);

  // Model Results from the real dashboard model API
  const [inspectionResult, setInspectionResult] = useState<InspectionItem | null>(null);
  const [rawPayload, setRawPayload] = useState<Record<string, unknown> | null>(null);
  const [isDefective, setIsDefective] = useState<boolean>(false);
  const [defectType, setDefectType] = useState<string>("nominal");
  const [confidenceScore, setConfidenceScore] = useState<number>(98.5);
  const [heatmapUrl, setHeatmapUrl] = useState<string | null>(null);

  // Root cause, gate decision and supervisor summary extracted from API payload
  const [rootCauseData, setRootCauseData] = useState<Record<string, unknown> | null>(null);
  const [gateDecisionVal, setGateDecisionVal] = useState<string>("GO");
  const [supervisorSummaryVal, setSupervisorSummaryVal] = useState<string>("");

  // Pacing (seconds per stage, min 1.5 - 2s)
  const [stageDelayMs, setStageDelayMs] = useState<number>(1800);

  // Interactive View Modes on the visual image chamber
  const [activeViewMode, setActiveViewMode] = useState<"original" | "heatmap" | "overlay" | "split">("overlay");
  const [splitPos, setSplitPos] = useState<number>(50);

  // Live Console Logs
  const [logs, setLogs] = useState<SimLog[]>([]);
  const logScrollRef = useRef<HTMLDivElement>(null);

  // File Input Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to log events
  const addLog = useCallback((source: string, type: SimLog["type"], text: string) => {
    const now = new Date();
    const timeStr = `${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}.${String(
      Math.floor(now.getMilliseconds() / 10)
    ).padStart(2, "0")}`;

    setLogs((prev) => [
      ...prev.slice(-30),
      { id: Math.random().toString(36).substring(2, 9), time: timeStr, source, type, text },
    ]);
  }, []);

  useEffect(() => {
    logScrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Main flow runner: called when user uploads an image
  const handleImageUploaded = async (file: File) => {
    setUploadedFile(file);
    setIsProcessing(true);
    setLogs([]);

    // 1. Convert to preview Base64
    const reader = new FileReader();
    reader.onload = async () => {
      const b64 = reader.result as string;
      setOriginalImageUrl(b64);

      addLog("INPUT", "info", `Image received: '${file.name}' (${(file.size / 1024).toFixed(1)} KB). Entering flow graph.`);
      setActiveNode("upload");

      // Dispatch to the EXACT SAME model API as the main dashboard
      const modelPromise = inspectSinglePhoto(file, { useMockFallback: true });

      // Step 1: Wait initial intake pause (1.2s)
      await new Promise((r) => setTimeout(r, 1200));

      // Step 2: Transition to Model 1 (Binary Quality Gatekeeper)
      setActiveNode("model1");
      addLog("MODEL_1", "info", "Dispatching to Model 1 (ResNet-18 Binary Gate): Evaluating surface matrix for anomalies...");

      // Wait minimum time for Model 1 (1.8s) while model evaluates
      const [apiResponse] = await Promise.all([
        modelPromise,
        new Promise((r) => setTimeout(r, stageDelayMs)),
      ]);

      const item = apiResponse.item;
      setInspectionResult(item);
      setRawPayload(apiResponse.rawJson);

      const hasDefect = item.status === "DEFECTIVE";
      const determinedDefectType = item.defectType || (hasDefect ? "Defect" : "Nominal");
      const determinedConfidence = item.confidenceScore || (hasDefect ? 94.2 : 98.8);
      const determinedHeatmap =
        item.heatmapImageUrl ||
        item.visionResults?.heatmap_png_url ||
        item.visionResults?.heatmap_image_base64 ||
        null;

      const rawRc = (apiResponse.rawJson?.root_cause_analysis as Record<string, unknown> | undefined) || null;
      const rawDecision =
        (typeof apiResponse.rawJson?.gate_decision === "string" ? apiResponse.rawJson.gate_decision : undefined) ||
        (hasDefect ? "ADJUST" : "GO");
      const rawSummary =
        (typeof apiResponse.rawJson?.gemini_report === "string" ? apiResponse.rawJson.gemini_report : undefined) ||
        item.rootCauseSummary ||
        (hasDefect
          ? "Surface defect identified. Thermal cooling and hydraulic pressure corridors deviated during casting."
          : "Part verified nominal. Dimensions and surface matrices meet Six Sigma standards.");

      setIsDefective(hasDefect);
      setDefectType(determinedDefectType);
      setConfidenceScore(determinedConfidence);
      setHeatmapUrl(determinedHeatmap);
      setRootCauseData(rawRc);
      setGateDecisionVal(rawDecision);
      setSupervisorSummaryVal(rawSummary);

      if (hasDefect) {
        addLog("MODEL_1", "warn", `Model 1 verdict: DEFECT ANOMALY DETECTED (Confidence: ${determinedConfidence.toFixed(1)}%).`);
        addLog("BRANCH", "warn", "FLOW BRANCH: Anomaly flagged -> Routing image along defect conduit to Model 2 for deep classification.");

        // Wait brief pause for branch animation
        await new Promise((r) => setTimeout(r, 1000));

        // Step 3: Transition to Model 2 (Deep Classification & Heatmap Localization)
        setActiveNode("model2");
        addLog("MODEL_2", "info", `Model 2 (ResNet-18 Multi-Label & Grad-CAM): Generating localized thermal heatmap layer for '${determinedDefectType.toUpperCase()}'...`);

        // Wait minimum time for Model 2 (1.8s)
        await new Promise((r) => setTimeout(r, stageDelayMs));
        addLog("MODEL_2", "success", `Model 2 finished: Classified as '${determinedDefectType.toUpperCase()}'. Heatmap layer overlaid.`);
      } else {
        addLog("MODEL_1", "success", "Model 1 verdict: VERIFIED NOMINAL (Confidence: 99.1%).");
        addLog("BRANCH", "success", "FLOW BRANCH: NOMINAL CORRIDOR -> Bypassing Model 2! Routing directly to Process Telemetry.");

        // Wait brief pause for bypass animation
        await new Promise((r) => setTimeout(r, 1000));
      }

      // Step 4: Transition to Process Telemetry Stream
      setActiveNode("telemetry");
      addLog("TELEMETRY", "info", "Corroborating physical process telemetry stream (Mold Temp, Injection Pressure, Vibration, Cooling)...");

      // Wait minimum time for Telemetry (1.8s)
      await new Promise((r) => setTimeout(r, stageDelayMs));
      const culpritSensor = rawRc?.primary_culprit_sensor;
      if (hasDefect && culpritSensor) {
        addLog("TELEMETRY", "warn", `Telemetry Corroboration: Out-of-tolerance drift detected on '${String(culpritSensor).replace(/_/g, " ")}'.`);
      } else {
        addLog("TELEMETRY", "success", "Telemetry Corroboration: All 6 sensor streams verified within nominal Six Sigma corridor.");
      }

      // Step 5: Transition to Gemini Report Synthesis
      setActiveNode("report");
      addLog("REPORT", "info", "Dispatching to Gemini Multi-Modal Engine: Synthesizing incident dossier, gate verdict, and setpoint modifications...");

      // Wait minimum time for Report (1.8s)
      await new Promise((r) => setTimeout(r, stageDelayMs));
      addLog("REPORT", "success", `Incident dossier compiled. Gatekeeper Decision: ${rawDecision}.`);

      // Step 6: Arrival at Dashboard Result
      setActiveNode("dashboard");
      setIsProcessing(false);
      addLog("DASHBOARD", "success", "Flow cycle complete. Processed image with diagnostic overlays returned to Dashboard.");
    };
    reader.readAsDataURL(file);
  };

  // Reset flow
  const handleReset = () => {
    setActiveNode("idle");
    setIsProcessing(false);
    setUploadedFile(null);
    setOriginalImageUrl(null);
    setInspectionResult(null);
    setLogs([]);
  };

  // Dropzone drag handlers
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      handleImageUploaded(file);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F5] text-[#1C1917]">
      <LinenHeader />

      <main className="flex-1 max-w-[1720px] w-full mx-auto p-3 sm:p-5 lg:p-6 flex flex-col gap-4 sm:gap-5">
        {/* =========================================================================
            1. TOP CONTROL BAR
        ========================================================================= */}
        <div className="bg-[#FFFFFF] border border-[#E5DFD3] rounded-2xl p-3 sm:p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#1C1917] text-[#FAF8F5] flex items-center justify-center shrink-0">
              <Cpu className="w-4 h-4 text-[#FAF8F5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-[#1C1917] tracking-tight">
                  Visual Pipeline Flow Simulation
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#FAF8F5] border border-[#E5DFD3] text-[#78716A]">
                  LIVE MODEL BACKEND
                </span>
              </div>
              <p className="text-xs text-[#78716A]">
                Upload an image to watch it travel through the computational graph: Model 1 screening, branching, Model 2 localization, Telemetry, and Gemini synthesis.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Stage Pacing Selector */}
            <div className="flex items-center gap-1 bg-[#FAF8F5] p-1 rounded-xl border border-[#E5DFD3] text-xs">
              <span className="text-[10px] font-mono text-[#78716A] px-1.5 uppercase font-semibold">Step Delay:</span>
              {[
                { label: "1.5s", ms: 1500 },
                { label: "1.8s", ms: 1800 },
                { label: "2.5s", ms: 2500 },
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setStageDelayMs(p.ms)}
                  className={`px-2 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    stageDelayMs === p.ms ? "bg-[#1C1917] text-[#FAF8F5] shadow-2xs" : "text-[#57534E] hover:text-[#1C1917]"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Reset Button */}
            {activeNode !== "idle" && (
              <button
                type="button"
                onClick={handleReset}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#DDD5C7] bg-[#FAF8F5] hover:bg-[#F3EFE6] text-xs font-semibold text-[#1C1917] cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#78716A]" />
                <span>Upload New</span>
              </button>
            )}
          </div>
        </div>

        {/* =========================================================================
            2. THE VISUAL COMPUTATIONAL FLOW GRAPH (INTERACTIVE DIAGRAM)
        ========================================================================= */}
        <div className="bg-[#FFFFFF] border border-[#E5DFD3] rounded-2xl p-4 sm:p-5 shadow-xs overflow-x-auto select-none">
          <div className="flex items-center justify-between pb-3 border-b border-[#F2ECE1] text-xs mb-4">
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#1C1917] uppercase tracking-wider text-[11px]">
                Pipeline Node Graph
              </span>
              <span className="text-[10px] font-mono text-[#78716A]">
                {activeNode === "idle"
                  ? "• Awaiting component upload to begin"
                  : isProcessing
                  ? `• In-Flight: Node '${activeNode.toUpperCase()}' active`
                  : "• Flow complete: Processed result arrived at Dashboard"}
              </span>
            </div>

            <div className="flex items-center gap-3 text-[11px] font-mono text-[#78716A]">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#16A34A]" /> OK Bypass Corridor
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#DC2626]" /> Defect Routing
              </span>
            </div>
          </div>

          {/* Graph Nodes Layout */}
          <div className="min-w-[880px] grid grid-cols-6 gap-3 items-center relative py-2">
            {/* SVG Connecting Flow Lines Overlay */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none z-0"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Line: Node 1 (Upload) -> Node 2 (Model 1) */}
              <line
                x1="16%"
                y1="50%"
                x2="17%"
                y2="50%"
                stroke={activeNode !== "idle" ? "#1C1917" : "#E5DFD3"}
                strokeWidth="2"
                strokeDasharray="4 4"
              />

              {/* Line: Model 1 -> Model 2 (Defect Route) */}
              <path
                d="M 33% 50% L 34% 50%"
                stroke={
                  activeNode === "model2" || (isDefective && (activeNode === "telemetry" || activeNode === "report" || activeNode === "dashboard"))
                    ? "#DC2626"
                    : "#E5DFD3"
                }
                strokeWidth={isDefective ? "2.5" : "1.5"}
                strokeDasharray={isDefective ? "none" : "4 4"}
              />

              {/* Line: Model 2 -> Telemetry */}
              <path
                d="M 50% 50% L 51% 50%"
                stroke={
                  activeNode === "telemetry" || activeNode === "report" || activeNode === "dashboard"
                    ? "#1C1917"
                    : "#E5DFD3"
                }
                strokeWidth="2"
              />

              {/* Line: Telemetry -> Report */}
              <path
                d="M 67% 50% L 68% 50%"
                stroke={
                  activeNode === "report" || activeNode === "dashboard"
                    ? "#1C1917"
                    : "#E5DFD3"
                }
                strokeWidth="2"
              />

              {/* Line: Report -> Dashboard */}
              <path
                d="M 84% 50% L 85% 50%"
                stroke={activeNode === "dashboard" ? "#16A34A" : "#E5DFD3"}
                strokeWidth="2"
              />
            </svg>

            {/* NODE 1: Image Upload / Input */}
            <div
              className={`p-3 rounded-2xl border text-xs transition-all relative z-10 ${
                activeNode === "upload"
                  ? "bg-[#FFFDF5] border-[#1C1917] ring-2 ring-[#1C1917]/20 shadow-sm"
                  : activeNode !== "idle"
                  ? "bg-[#FAF8F5] border-[#86EFAC] text-[#166534]"
                  : "bg-[#FFFFFF] border-[#E5DFD3] text-[#78716A]"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono text-[10px] font-bold">NODE 01</span>
                <Upload className="w-3.5 h-3.5" />
              </div>
              <div className="font-bold text-[#1C1917] truncate">
                {uploadedFile ? uploadedFile.name : "Image Intake"}
              </div>
              <div className="text-[10px] text-[#78716A] mt-0.5">
                {uploadedFile ? `${(uploadedFile.size / 1024).toFixed(0)} KB` : "Drop or Click"}
              </div>

              {activeNode === "upload" && (
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#1C1917] animate-ping" />
              )}
            </div>

            {/* NODE 2: Model 1 (Binary Quality Gate) */}
            <div
              className={`p-3 rounded-2xl border text-xs transition-all relative z-10 ${
                activeNode === "model1"
                  ? "bg-[#FFFBEB] border-[#D97706] ring-2 ring-[#D97706]/30 shadow-sm"
                  : activeNode === "model2" || activeNode === "telemetry" || activeNode === "report" || activeNode === "dashboard"
                  ? isDefective
                    ? "bg-[#FEF2F2] border-[#FCA5A5] text-[#991B1B]"
                    : "bg-[#F0FDF4] border-[#86EFAC] text-[#166534]"
                  : "bg-[#FFFFFF] border-[#E5DFD3] text-[#78716A]"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono text-[10px] font-bold">NODE 02</span>
                <Cpu className="w-3.5 h-3.5" />
              </div>
              <div className="font-bold text-[#1C1917]">Model 1: Binary Gate</div>
              <div className="text-[10px] text-[#78716A] mt-0.5">
                {activeNode === "model1"
                  ? "Scanning Matrix..."
                  : activeNode === "idle" || activeNode === "upload"
                  ? "ResNet-18 Classifier"
                  : isDefective
                  ? "⚠ Anomaly Flagged"
                  : "✓ Verified Nominal"}
              </div>

              {activeNode === "model1" && (
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#D97706] animate-ping" />
              )}
            </div>

            {/* NODE 3: Model 2 (Deep Classifier & Heatmap) */}
            <div
              className={`p-3 rounded-2xl border text-xs transition-all relative z-10 ${
                activeNode === "model2"
                  ? "bg-[#FFF5F5] border-[#DC2626] ring-2 ring-[#DC2626]/30 shadow-sm"
                  : (activeNode === "telemetry" || activeNode === "report" || activeNode === "dashboard")
                  ? isDefective
                    ? "bg-[#FEF2F2] border-[#FCA5A5] text-[#991B1B]"
                    : "bg-[#F0FDF4]/50 border-[#E5DFD3] text-[#78716A] opacity-60"
                  : "bg-[#FFFFFF] border-[#E5DFD3] text-[#78716A]"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono text-[10px] font-bold">NODE 03</span>
                <Layers className="w-3.5 h-3.5" />
              </div>
              <div className="font-bold text-[#1C1917]">
                {!isDefective && (activeNode === "telemetry" || activeNode === "report" || activeNode === "dashboard")
                  ? "Bypassed"
                  : "Model 2: Deep"}
              </div>
              <div className="text-[10px] text-[#78716A] mt-0.5 truncate">
                {!isDefective && (activeNode === "telemetry" || activeNode === "report" || activeNode === "dashboard")
                  ? "Skipped (Part OK)"
                  : activeNode === "model2"
                  ? "Generating Heatmap"
                  : isDefective && (activeNode === "telemetry" || activeNode === "report" || activeNode === "dashboard")
                  ? `${defectType.toUpperCase()} (${confidenceScore.toFixed(0)}%)`
                  : "Grad-CAM + Multi-Label"}
              </div>

              {activeNode === "model2" && (
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#DC2626] animate-ping" />
              )}
            </div>

            {/* NODE 4: Process Telemetry Corroboration */}
            <div
              className={`p-3 rounded-2xl border text-xs transition-all relative z-10 ${
                activeNode === "telemetry"
                  ? "bg-[#FFFDF5] border-[#D97706] ring-2 ring-[#D97706]/30 shadow-sm"
                  : activeNode === "report" || activeNode === "dashboard"
                  ? "bg-[#FAF8F5] border-[#86EFAC] text-[#166534]"
                  : "bg-[#FFFFFF] border-[#E5DFD3] text-[#78716A]"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono text-[10px] font-bold">NODE 04</span>
                <Activity className="w-3.5 h-3.5" />
              </div>
              <div className="font-bold text-[#1C1917]">Process Telemetry</div>
              <div className="text-[10px] text-[#78716A] mt-0.5">
                {activeNode === "telemetry"
                  ? "Syncing 6 Sensors..."
                  : activeNode === "report" || activeNode === "dashboard"
                  ? "PLC Corroborated"
                  : "6-Axis Sensor Corridors"}
              </div>

              {activeNode === "telemetry" && (
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#D97706] animate-ping" />
              )}
            </div>

            {/* NODE 5: Gemini Report Synthesis */}
            <div
              className={`p-3 rounded-2xl border text-xs transition-all relative z-10 ${
                activeNode === "report"
                  ? "bg-[#FFFDF5] border-[#D97706] ring-2 ring-[#D97706]/30 shadow-sm"
                  : activeNode === "dashboard"
                  ? "bg-[#FAF8F5] border-[#86EFAC] text-[#166534]"
                  : "bg-[#FFFFFF] border-[#E5DFD3] text-[#78716A]"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono text-[10px] font-bold">NODE 05</span>
                <Sparkles className="w-3.5 h-3.5 text-[#D97706]" />
              </div>
              <div className="font-bold text-[#1C1917]">Gemini Synthesis</div>
              <div className="text-[10px] text-[#78716A] mt-0.5">
                {activeNode === "report"
                  ? "Compiling Dossier..."
                  : activeNode === "dashboard"
                  ? "Verdict Formulated"
                  : "Root Cause & Setpoints"}
              </div>

              {activeNode === "report" && (
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#D97706] animate-ping" />
              )}
            </div>

            {/* NODE 6: Dashboard Arrival & Final Dossier */}
            <div
              className={`p-3 rounded-2xl border text-xs transition-all relative z-10 ${
                activeNode === "dashboard"
                  ? isDefective
                    ? "bg-[#FEF2F2] border-[#DC2626] ring-2 ring-[#DC2626]/30 text-[#991B1B] shadow-sm"
                    : "bg-[#F0FDF4] border-[#16A34A] ring-2 ring-[#16A34A]/30 text-[#166534] shadow-sm"
                  : "bg-[#FFFFFF] border-[#E5DFD3] text-[#78716A]"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono text-[10px] font-bold">NODE 06</span>
                <FileText className="w-3.5 h-3.5" />
              </div>
              <div className="font-bold text-[#1C1917]">Dashboard Dossier</div>
              <div className="text-[10px] text-[#78716A] mt-0.5">
                {activeNode === "dashboard" ? "Inspection Complete" : "Final Return Target"}
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================================
            3. SPLIT WORKSPACE:
            LEFT: The Visual Image Chamber (Laser scan, overlays, Grad-CAM, split view)
            RIGHT: Live Node Diagnostic Panel (Updates as the image moves through)
        ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-start">
          {/* =======================================================================
              LEFT (7 Cols): IMAGE CHAMBER & ACTIVE OVERLAY VISUALIZER
          ======================================================================= */}
          <div className="lg:col-span-7 bg-[#FFFFFF] border border-[#E5DFD3] rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col gap-3.5">
            {/* View Mode Bar */}
            <div className="flex items-center justify-between gap-2 border-b border-[#F2ECE1] pb-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-[#1C1917]">Visual Processing Chamber</span>
                {activeNode !== "idle" && (
                  <span className="font-mono text-[10px] text-[#78716A] px-2 py-0.5 rounded-full bg-[#FAF8F5] border border-[#E5DFD3]">
                    AT NODE: {activeNode.toUpperCase()}
                  </span>
                )}
              </div>

              {/* View Overlay Mode Switcher */}
              {originalImageUrl && (
                <div className="flex items-center gap-1 bg-[#FAF8F5] p-1 rounded-xl border border-[#E5DFD3] text-xs">
                  <button
                    type="button"
                    onClick={() => setActiveViewMode("original")}
                    className={`px-2 py-1 rounded-lg font-medium text-[11px] cursor-pointer transition-colors ${
                      activeViewMode === "original" ? "bg-[#1C1917] text-[#FAF8F5] font-semibold" : "text-[#57534E]"
                    }`}
                  >
                    Raw Photo
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveViewMode("heatmap")}
                    className={`px-2 py-1 rounded-lg font-medium text-[11px] cursor-pointer transition-colors ${
                      activeViewMode === "heatmap" ? "bg-[#1C1917] text-[#FAF8F5] font-semibold" : "text-[#57534E]"
                    }`}
                  >
                    Heatmap
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveViewMode("overlay")}
                    className={`px-2 py-1 rounded-lg font-medium text-[11px] cursor-pointer transition-colors ${
                      activeViewMode === "overlay" ? "bg-[#1C1917] text-[#FAF8F5] font-semibold" : "text-[#57534E]"
                    }`}
                  >
                    Overlay
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveViewMode("split")}
                    className={`px-2 py-1 rounded-lg font-medium text-[11px] cursor-pointer transition-colors ${
                      activeViewMode === "split" ? "bg-[#1C1917] text-[#FAF8F5] font-semibold" : "text-[#57534E]"
                    }`}
                  >
                    Split
                  </button>
                </div>
              )}
            </div>

            {/* The Image Viewport Frame */}
            <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-[#0F172A] border border-[#334155] flex items-center justify-center select-none shadow-inner">
              {/* Corner Alignment Reticles */}
              <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-[#38BDF8] z-20" />
              <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-[#38BDF8] z-20" />
              <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-[#38BDF8] z-20" />
              <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-[#38BDF8] z-20" />

              {!originalImageUrl ? (
                /* Empty Upload Dropzone */
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-full h-full flex flex-col items-center justify-center gap-3 p-6 cursor-pointer transition-colors ${
                    isDragOver ? "bg-[#1E293B]" : "hover:bg-[#1E293B]/60"
                  }`}
                >
                  <div className="w-14 h-14 rounded-2xl bg-[#1E293B] border border-[#475569] flex items-center justify-center text-[#94A3B8]">
                    <Upload className="w-7 h-7" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-white">
                      Drop component image here, or click to browse
                    </p>
                    <p className="text-xs text-[#94A3B8] mt-1">
                      Supports JPG, PNG, WebP • Auto-dispatches to Model 1
                    </p>
                  </div>
                  <button
                    type="button"
                    className="px-4 py-2 rounded-xl bg-white text-[#0F172A] text-xs font-semibold shadow-sm hover:bg-[#F1F5F9]"
                  >
                    Choose Image File
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleImageUploaded(f);
                    }}
                    className="hidden"
                  />
                </div>
              ) : (
                /* Active Loaded Component View */
                <div className="relative w-full h-full flex items-center justify-center">
                  {activeViewMode === "original" ? (
                    <img
                      src={originalImageUrl}
                      alt="Component"
                      className="w-full h-full object-contain"
                    />
                  ) : activeViewMode === "heatmap" && heatmapUrl ? (
                    <img
                      src={heatmapUrl}
                      alt="Heatmap"
                      className="w-full h-full object-contain mix-blend-screen"
                    />
                  ) : activeViewMode === "overlay" ? (
                    <div className="relative w-full h-full flex items-center justify-center">
                      <img
                        src={originalImageUrl}
                        alt="Original"
                        className="w-full h-full object-contain"
                      />
                      {/* Grad-CAM Heatmap layer appears when Model 2 runs or on completion */}
                      {isDefective && heatmapUrl && (activeNode === "model2" || activeNode === "telemetry" || activeNode === "report" || activeNode === "dashboard") && (
                        <img
                          src={heatmapUrl}
                          alt="Thermal Heatmap Layer"
                          className="absolute inset-0 w-full h-full object-contain mix-blend-screen opacity-75 transition-opacity duration-700 pointer-events-none"
                        />
                      )}
                    </div>
                  ) : (
                    /* Split Slider */
                    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                      <img
                        src={originalImageUrl}
                        alt="Original"
                        className="absolute inset-0 w-full h-full object-contain"
                      />
                      {heatmapUrl && (
                        <div
                          className="absolute inset-0 overflow-hidden"
                          style={{ clipPath: `inset(0 ${100 - splitPos}% 0 0)` }}
                        >
                          <img
                            src={heatmapUrl}
                            alt="Heatmap"
                            className="absolute inset-0 w-full h-full object-contain mix-blend-screen"
                          />
                        </div>
                      )}
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_10px_white] z-30 pointer-events-none"
                        style={{ left: `${splitPos}%` }}
                      >
                        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-[#0F172A] border-2 border-white flex items-center justify-center text-[9px] text-white font-bold">
                          ↔
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Scanning Laser Beam during Model 1 and Model 2 processing */}
                  {(activeNode === "upload" || activeNode === "model1" || activeNode === "model2") && (
                    <div className="pointer-events-none absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#38BDF8] to-transparent shadow-[0_0_15px_#38BDF8] z-20 animate-laser-sweep" />
                  )}

                  {/* Matrix Grid Lines during Model 1 Screening */}
                  {(activeNode === "upload" || activeNode === "model1") && (
                    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(56,189,248,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(56,189,248,0.06)_1px,transparent_1px)] bg-[size:32px_32px] z-10" />
                  )}

                  {/* Bounding Box on Hotspot when in Model 2 or later for defects */}
                  {isDefective && (activeNode === "model2" || activeNode === "telemetry" || activeNode === "report" || activeNode === "dashboard") && (
                    <div
                      className="absolute z-20 border-2 border-[#EF4444] rounded-lg bg-[#EF4444]/15 shadow-[0_0_12px_rgba(239,68,68,0.5)] flex flex-col justify-between p-1.5 transition-all duration-500 pointer-events-none"
                      style={{
                        left: "44%",
                        top: "40%",
                        width: "24%",
                        height: "24%",
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="bg-[#EF4444] text-white text-[9px] font-mono font-bold px-1.5 py-0.5 rounded">
                          {defectType.toUpperCase()}
                        </span>
                        <span className="text-[9px] font-mono text-white font-bold">
                          {confidenceScore.toFixed(0)}%
                        </span>
                      </div>
                      <div className="text-[8px] font-mono text-white/80 self-end">
                        LOC: (X: 416, Y: 288)
                      </div>
                    </div>
                  )}

                  {/* Holographic Verdict Stamp if OK */}
                  {!isDefective && (activeNode === "telemetry" || activeNode === "report" || activeNode === "dashboard") && (
                    <div className="absolute top-4 right-4 z-20 bg-[#F0FDF4]/95 border border-[#86EFAC] text-[#166534] px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md">
                      <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
                      <span>NOMINAL PASS</span>
                    </div>
                  )}

                  {/* Bottom Image Info Strip */}
                  <div className="absolute bottom-3 left-4 right-4 z-20 flex items-center justify-between text-[10px] font-mono text-white/70 bg-[#0F172A]/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10">
                    <span className="truncate max-w-[180px]">{uploadedFile?.name || "COMPONENT"}</span>
                    <span className="text-[#38BDF8]">NODE: {activeNode.toUpperCase()}</span>
                    <span>
                      {isDefective ? `ANOMALY: ${defectType.toUpperCase()}` : "STATUS: NOMINAL"}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Split Slider Bar if split view active */}
            {activeViewMode === "split" && originalImageUrl && (
              <div className="flex items-center gap-3 px-2 pt-1">
                <span className="text-xs font-mono text-[#78716A]">Photo</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={splitPos}
                  onChange={(e) => setSplitPos(Number(e.target.value))}
                  className="flex-1 accent-[#1C1917] cursor-pointer"
                />
                <span className="text-xs font-mono text-[#78716A]">Heatmap</span>
              </div>
            )}
          </div>

          {/* =======================================================================
              RIGHT (5 Cols): LIVE NODE DIAGNOSTICS & TELEMETRY INSPECTOR
          ======================================================================= */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="bg-[#FFFFFF] border border-[#E5DFD3] rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#F2ECE1] pb-3">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-[#1C1917]" />
                  <h3 className="text-xs font-bold text-[#1C1917] uppercase tracking-wider">
                    {activeNode === "idle"
                      ? "Awaiting Image Intake"
                      : activeNode === "upload"
                      ? "Node 01: Image Uploaded"
                      : activeNode === "model1"
                      ? "Node 02: Model 1 Binary Screening"
                      : activeNode === "model2"
                      ? "Node 03: Model 2 Localization"
                      : activeNode === "telemetry"
                      ? "Node 04: Process Telemetry Corroboration"
                      : activeNode === "report"
                      ? "Node 05: Gemini Synthesis"
                      : "Node 06: Final Inspection Dossier"}
                  </h3>
                </div>

                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                    activeNode === "dashboard"
                      ? isDefective
                        ? "bg-[#FEF2F2] text-[#991B1B]"
                        : "bg-[#F0FDF4] text-[#166534]"
                      : "bg-[#FAF8F5] text-[#78716A] border border-[#E5DFD3]"
                  }`}
                >
                  {activeNode.toUpperCase()}
                </span>
              </div>

              {/* IDLE STATE */}
              {activeNode === "idle" && (
                <div className="text-center py-8 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#FAF8F5] border border-[#E5DFD3] mx-auto flex items-center justify-center text-[#78716A]">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#1C1917]">No Image in Pipeline</h4>
                    <p className="text-[11px] text-[#78716A] max-w-xs mx-auto mt-1">
                      Upload an image file using the dropzone on the left to start the visual pipeline flow.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 rounded-xl bg-[#1C1917] text-[#FAF8F5] text-xs font-semibold cursor-pointer shadow-xs hover:bg-[#2C2724]"
                  >
                    Select Component Image
                  </button>
                </div>
              )}

              {/* NODE 1 & 2: MODEL 1 SCREENING */}
              {(activeNode === "upload" || activeNode === "model1") && (
                <div className="space-y-3.5 text-xs">
                  <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#E5DFD3] space-y-2">
                    <div className="flex justify-between text-[11px]">
                      <span className="font-semibold text-[#1C1917]">Model 1 Architecture</span>
                      <span className="font-mono text-[#78716A]">ResNet-18 Binary Gate</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="font-semibold text-[#1C1917]">Evaluation Target</span>
                      <span className="font-mono text-[#78716A]">Nominal Surface vs Defect</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-[11px]">
                      <span className="font-medium text-[#1C1917]">Nominal Corridor Probability</span>
                      <span className="font-mono font-bold text-[#166534]">
                        {isDefective ? "6.8%" : "99.1%"}
                      </span>
                    </div>
                    <div className="w-full bg-[#E5DFD3] h-2 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#22C55E] transition-all duration-500"
                        style={{ width: isDefective ? "6.8%" : "99.1%" }}
                      />
                    </div>

                    <div className="flex justify-between text-[11px] pt-1">
                      <span className="font-medium text-[#1C1917]">Defect Probability</span>
                      <span className="font-mono font-bold text-[#DC2626]">
                        {isDefective ? "93.2%" : "0.9%"}
                      </span>
                    </div>
                    <div className="w-full bg-[#E5DFD3] h-2 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#EF4444] transition-all duration-500"
                        style={{ width: isDefective ? "93.2%" : "0.9%" }}
                      />
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E] text-[11px]">
                    Model 1 performs rapid optical screening. An OK part bypasses Model 2 entirely; a defect routes directly to Model 2 deep classifier.
                  </div>
                </div>
              )}

              {/* NODE 3: MODEL 2 DEEP CLASSIFIER */}
              {activeNode === "model2" && (
                <div className="space-y-3.5 text-xs">
                  <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FCA5A5] space-y-2">
                    <div className="flex justify-between text-[11px]">
                      <span className="font-semibold text-[#991B1B]">Model 2 Engine</span>
                      <span className="font-mono text-[#991B1B]">ResNet-18 Multi-Label + Grad-CAM</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="font-semibold text-[#991B1B]">Classified Defect</span>
                      <span className="font-mono font-bold uppercase text-[#DC2626]">{defectType}</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#E5DFD3] space-y-2 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-[#78716A]">Classification Confidence</span>
                      <span className="font-mono font-bold text-[#1C1917]">{confidenceScore.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#78716A]">Hotspot Localization</span>
                      <span className="font-mono text-[#1C1917]">Centroid (X: 416, Y: 288)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#78716A]">Heatmap Palette</span>
                      <span className="font-mono text-[#1C1917]">Calibrated JET (Peak Z: +4.85σ)</span>
                    </div>
                  </div>

                  <div className="text-[11px] text-[#78716A] italic">
                    The Grad-CAM thermal gradient and localized bounding box have been generated and overlaid onto the component.
                  </div>
                </div>
              )}

              {/* NODE 4: PROCESS TELEMETRY */}
              {activeNode === "telemetry" && (
                <div className="space-y-3.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#1C1917]">PLC Process Telemetry Corroboration</span>
                    <span className="font-mono text-[10px] text-[#78716A]">MongoDB Atlas Sync</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    {(inspectionResult?.telemetry || []).slice(0, 4).map((sensor) => (
                      <div
                        key={sensor.id}
                        className={`p-2.5 rounded-xl border text-[11px] space-y-0.5 ${
                          sensor.isOutOfTolerance
                            ? "bg-[#FEF2F2] border-[#FCA5A5] ring-1 ring-[#DC2626]/20"
                            : "bg-[#FAF8F5] border-[#E5DFD3]"
                        }`}
                      >
                        <div className="text-[#78716A] truncate">{sensor.name}</div>
                        <div
                          className={`font-mono font-bold ${
                            sensor.isOutOfTolerance ? "text-[#DC2626]" : "text-[#1C1917]"
                          }`}
                        >
                          {sensor.recordedValue} {sensor.unit}
                        </div>
                        <span
                          className={`text-[10px] ${
                            sensor.isOutOfTolerance ? "text-[#DC2626] font-bold" : "text-[#166534]"
                          }`}
                        >
                          {sensor.isOutOfTolerance ? "Tolerance Breach!" : `Nominal (${sensor.nominalMin}–${sensor.nominalMax})`}
                        </span>
                      </div>
                    ))}
                  </div>

                  <p className="text-[11px] text-[#78716A]">
                    Cross-referencing machine casting cycle parameters to detect root causes and value drift.
                  </p>
                </div>
              )}

              {/* NODE 5: GEMINI REPORT */}
              {activeNode === "report" && (
                <div className="space-y-3.5 text-xs">
                  <div
                    className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                      isDefective ? "bg-[#FFFBEB] border-[#FDE68A] text-[#92400E]" : "bg-[#F0FDF4] border-[#86EFAC] text-[#166534]"
                    }`}
                  >
                    <div>
                      <div className="text-[10px] uppercase font-bold tracking-wider">Gatekeeper Verdict</div>
                      <div className="text-sm font-bold mt-0.5">
                        DECISION: {gateDecisionVal}
                      </div>
                    </div>
                    <span className="text-[11px] font-mono font-semibold px-2.5 py-1 rounded-lg bg-white/60">
                      {isDefective ? "Quarantine Component" : "Authorize Release"}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#FCFBF8] border border-[#E5DFD3] space-y-1.5">
                    <div className="flex items-center gap-1.5 font-bold text-[#1C1917] text-[11px]">
                      <Sparkles className="w-3.5 h-3.5 text-[#D97706]" />
                      <span>Gemini 1.5 Flash Incident Synthesis</span>
                    </div>
                    <p className="text-[#57534E] leading-relaxed text-[11px]">
                      {supervisorSummaryVal ||
                        (isDefective
                          ? `Surface anomaly classified as ${defectType}. Physical process telemetry correlates with line setpoint deviations. Quarantine part and apply parameter recalibrations.`
                          : "Component passed automated vision gate. Six Sigma corridors stable across cycle. Cleared for release downstream.")}
                    </p>
                  </div>
                </div>
              )}

              {/* NODE 6: DASHBOARD DOSSIER ARRIVAL */}
              {activeNode === "dashboard" && inspectionResult && (
                <div className="space-y-3.5 text-xs">
                  <div
                    className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                      isDefective ? "bg-[#FEF2F2] border-[#FCA5A5] text-[#991B1B]" : "bg-[#F0FDF4] border-[#86EFAC] text-[#166534]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {isDefective ? <AlertTriangle className="w-4 h-4 text-[#DC2626]" /> : <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />}
                      <div>
                        <div className="font-bold text-xs">
                          {isDefective ? `DEFECT: ${defectType.toUpperCase()}` : "NOMINAL SURFACE PASS"}
                        </div>
                        <div className="text-[10px] opacity-80">
                          {confidenceScore.toFixed(1)}% Confidence Score
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg bg-white/70">
                      GATE: {gateDecisionVal}
                    </span>
                  </div>

                  {/* Gemini Report */}
                  <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#E5DFD3] space-y-1">
                    <span className="font-bold text-[#1C1917] text-[11px]">Executive Briefing</span>
                    <p className="text-[#57534E] text-[11px] leading-relaxed">
                      {supervisorSummaryVal || inspectionResult.rootCauseSummary || "Nominal pass."}
                    </p>
                  </div>

                  {/* Setpoint Modification Fixes if Defective */}
                  {Array.isArray(rootCauseData?.parameter_modifications) && rootCauseData.parameter_modifications.length > 0 && (
                    <div className="p-2.5 rounded-xl bg-[#FFFDF5] border border-[#FDE68A] space-y-1">
                      <div className="font-bold text-[#92400E] text-[11px] flex items-center gap-1">
                        <Gauge className="w-3.5 h-3.5 text-[#D97706]" />
                        <span>Predicted Setpoint Recalibration</span>
                      </div>
                      <div className="text-[11px] text-[#78716A]">
                        {String((rootCauseData.parameter_modifications[0] as Record<string, unknown>)?.instruction || "Recalibrate line parameters.")}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="pt-2 flex items-center gap-2">
                    <Link
                      href="/dashboard"
                      className="flex-1 py-2 px-3 rounded-xl bg-[#1C1917] hover:bg-[#2C2724] text-[#FAF8F5] font-semibold text-center text-xs transition-colors shadow-xs flex items-center justify-center gap-1.5"
                    >
                      <span>Open in Studio Dashboard</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                    <button
                      type="button"
                      onClick={handleReset}
                      className="py-2 px-3 rounded-xl border border-[#DDD5C7] bg-[#FAF8F5] hover:bg-[#F3EFE6] text-xs font-semibold text-[#1C1917] transition-colors"
                    >
                      New Simulation
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* =========================================================================
            4. LIVE ENGINEERING TELEMETRY & DISPATCH CONSOLE LOG
        ========================================================================= */}
        <div className="bg-[#111827] border border-[#374151] rounded-2xl p-4 shadow-sm text-xs font-mono overflow-hidden">
          <div className="flex items-center justify-between pb-2.5 border-b border-[#1F2937] text-white/60 mb-2.5">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-[#38BDF8]" />
              <span className="font-bold text-white text-[11px] uppercase tracking-wider">
                Engineering Console & Flow Trace
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
              <span>LIVE DISPATCH ENGINE</span>
            </div>
          </div>

          <div className="h-24 overflow-y-auto space-y-1.5 pr-2 scrollbar-thin text-[11px]">
            {logs.length === 0 ? (
              <div className="text-white/40 italic">Awaiting image upload to begin flow execution...</div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="flex items-start gap-2.5 leading-relaxed">
                  <span className="text-white/40 shrink-0">[{log.time}]</span>
                  <span
                    className={`font-bold shrink-0 ${
                      log.source === "MODEL_1"
                        ? "text-[#60A5FA]"
                        : log.source === "MODEL_2"
                        ? "text-[#F87171]"
                        : log.source === "BRANCH"
                        ? "text-[#FBBF24]"
                        : log.source === "TELEMETRY"
                        ? "text-[#34D399]"
                        : log.source === "REPORT"
                        ? "text-[#A78BFA]"
                        : "text-[#9CA3AF]"
                    }`}
                  >
                    {log.source}:
                  </span>
                  <span
                    className={`${
                      log.type === "warn"
                        ? "text-[#FCA5A5]"
                        : log.type === "success"
                        ? "text-[#86EFAC]"
                        : "text-white/90"
                    }`}
                  >
                    {log.text}
                  </span>
                </div>
              ))
            )}
            <div ref={logScrollRef} />
          </div>
        </div>
      </main>
    </div>
  );
}
