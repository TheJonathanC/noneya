"use client";

import React, { useState, useRef } from "react";
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
  ExternalLink,
} from "lucide-react";
import { LinenHeader } from "@/components/linen/LinenHeader";
import { inspectSinglePhoto } from "@/lib/api";
import { InspectionItem } from "@/lib/inspection-adapter";

export type FlowStage =
  | "idle"
  | "intake"
  | "model1"
  | "model2"
  | "telemetry"
  | "report"
  | "completed";

export default function SimulationPage() {
  const [stage, setStage] = useState<FlowStage>("idle");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  // Model response data
  const [result, setResult] = useState<InspectionItem | null>(null);
  const [isDefective, setIsDefective] = useState<boolean>(false);
  const [defectType, setDefectType] = useState<string>("nominal");
  const [confidence, setConfidence] = useState<number>(98.5);
  const [heatmapUrl, setHeatmapUrl] = useState<string | null>(null);
  const [rootCause, setRootCause] = useState<Record<string, unknown> | null>(null);
  const [gateDecision, setGateDecision] = useState<string>("GO");
  const [summary, setSummary] = useState<string>("");

  // Visual overlay mode
  const [viewMode, setViewMode] = useState<"image" | "heatmap" | "overlay">("overlay");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  // Run the animated flow with the real dashboard model
  const runSimulation = async (file: File) => {
    setUploadedFile(file);
    setResult(null);
    setStage("intake");

    const reader = new FileReader();
    reader.onload = async () => {
      const b64 = reader.result as string;
      setImageUrl(b64);

      // Call the real dashboard model in parallel
      const modelPromise = inspectSinglePhoto(file, { useMockFallback: true });

      // Stage 1: Intake (1.2s)
      await new Promise((r) => setTimeout(r, 1200));

      // Stage 2: Model 1 Gatekeeper (1.8s)
      setStage("model1");
      const [apiResponse] = await Promise.all([
        modelPromise,
        new Promise((r) => setTimeout(r, 1800)),
      ]);

      const item = apiResponse.item;
      setResult(item);

      const hasDefect = item.status === "DEFECTIVE";
      const determinedDefect = item.defectType || (hasDefect ? "Defect" : "Nominal");
      const determinedConf = item.confidenceScore || (hasDefect ? 94.2 : 98.8);
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
          ? "Surface anomaly identified. Thermal cooling and hydraulic pressure corridors deviated during casting cycle."
          : "Part verified nominal. Dimensions and surface matrices meet Six Sigma standards.");

      setIsDefective(hasDefect);
      setDefectType(determinedDefect);
      setConfidence(determinedConf);
      setHeatmapUrl(determinedHeatmap);
      setRootCause(rawRc);
      setGateDecision(rawDecision);
      setSummary(rawSummary);

      if (hasDefect) {
        // Defect path: proceed to Model 2 deep classification
        await new Promise((r) => setTimeout(r, 600));
        setStage("model2");
        await new Promise((r) => setTimeout(r, 1800));
      } else {
        // OK path: bypass Model 2!
        await new Promise((r) => setTimeout(r, 600));
      }

      // Stage 4: Process Telemetry Corroboration
      setStage("telemetry");
      await new Promise((r) => setTimeout(r, 1800));

      // Stage 5: Gemini Synthesis
      setStage("report");
      await new Promise((r) => setTimeout(r, 1800));

      // Stage 6: Final Destination
      setStage("completed");
    };

    reader.readAsDataURL(file);
  };

  const handleReset = () => {
    setStage("idle");
    setUploadedFile(null);
    setImageUrl(null);
    setResult(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      runSimulation(file);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F5] text-[#1C1917]">
      <LinenHeader />

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
        {/* Header Bar */}
        <div className="flex items-center justify-between gap-4 pb-2 border-b border-[#EAE4D7]">
          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[#1C1917]">
              Pipeline Flow Simulation
            </h1>
            <p className="text-xs text-[#78716A] mt-0.5">
              Visual trace through Model 1 binary gate, Model 2 deep localization, process telemetry, and Gemini synthesis.
            </p>
          </div>

          {stage !== "idle" && (
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#DDD5C7] bg-[#FFFFFF] hover:bg-[#F3EFE6] text-xs font-medium text-[#1C1917] transition-colors shadow-xs cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#78716A]" />
              <span>New Inspection</span>
            </button>
          )}
        </div>

        {/* Visual Pipeline Flowchart */}
        <div className="bg-[#FFFFFF] border border-[#E5DFD3] rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 items-center">
            {/* Step 1: Intake */}
            <div
              className={`p-3 rounded-xl border text-xs transition-all ${
                stage === "intake"
                  ? "border-[#1C1917] bg-[#FAF8F5] ring-1 ring-[#1C1917]"
                  : stage !== "idle"
                  ? "border-[#86EFAC] bg-[#F0FDF4] text-[#166534]"
                  : "border-[#E5DFD3] bg-[#FAF8F5] text-[#78716A]"
              }`}
            >
              <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                <span>01</span>
                <Upload className="w-3.5 h-3.5" />
              </div>
              <div className="font-semibold text-[#1C1917]">Image Intake</div>
              <div className="text-[10px] text-[#78716A] mt-0.5">Optical Buffer</div>
            </div>

            {/* Step 2: Model 1 Gate */}
            <div
              className={`p-3 rounded-xl border text-xs transition-all ${
                stage === "model1"
                  ? "border-[#D97706] bg-[#FFFBEB] ring-1 ring-[#D97706]"
                  : stage !== "idle" && stage !== "intake"
                  ? isDefective
                    ? "border-[#FCA5A5] bg-[#FEF2F2] text-[#991B1B]"
                    : "border-[#86EFAC] bg-[#F0FDF4] text-[#166534]"
                  : "border-[#E5DFD3] bg-[#FAF8F5] text-[#78716A]"
              }`}
            >
              <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                <span>02</span>
                <Cpu className="w-3.5 h-3.5" />
              </div>
              <div className="font-semibold text-[#1C1917]">Model 1: Gate</div>
              <div className="text-[10px] text-[#78716A] mt-0.5">
                {stage === "model1"
                  ? "Screening..."
                  : stage !== "idle" && stage !== "intake"
                  ? isDefective
                    ? "Defect Flagged"
                    : "Verified Nominal"
                  : "Binary Check"}
              </div>
            </div>

            {/* Step 3: Model 2 Deep (Or Bypassed if OK) */}
            <div
              className={`p-3 rounded-xl border text-xs transition-all ${
                stage === "model2"
                  ? "border-[#DC2626] bg-[#FEF2F2] ring-1 ring-[#DC2626]"
                  : stage !== "idle" && stage !== "intake" && stage !== "model1"
                  ? isDefective
                    ? "border-[#FCA5A5] bg-[#FEF2F2] text-[#991B1B]"
                    : "border-[#E5DFD3] bg-[#FAF8F5] text-[#A8A29E] opacity-60"
                  : "border-[#E5DFD3] bg-[#FAF8F5] text-[#78716A]"
              }`}
            >
              <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                <span>03</span>
                <Layers className="w-3.5 h-3.5" />
              </div>
              <div className="font-semibold text-[#1C1917]">
                {!isDefective && stage !== "idle" && stage !== "intake" && stage !== "model1"
                  ? "Model 2: Bypassed"
                  : "Model 2: Deep"}
              </div>
              <div className="text-[10px] text-[#78716A] mt-0.5 truncate">
                {!isDefective && stage !== "idle" && stage !== "intake" && stage !== "model1"
                  ? "Skipped (Part OK)"
                  : stage === "model2"
                  ? "Generating Heatmap"
                  : isDefective
                  ? `${defectType}`
                  : "Grad-CAM Heatmap"}
              </div>
            </div>

            {/* Step 4: Process Telemetry */}
            <div
              className={`p-3 rounded-xl border text-xs transition-all ${
                stage === "telemetry"
                  ? "border-[#D97706] bg-[#FFFBEB] ring-1 ring-[#D97706]"
                  : stage === "report" || stage === "completed"
                  ? "border-[#86EFAC] bg-[#F0FDF4] text-[#166534]"
                  : "border-[#E5DFD3] bg-[#FAF8F5] text-[#78716A]"
              }`}
            >
              <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                <span>04</span>
                <Activity className="w-3.5 h-3.5" />
              </div>
              <div className="font-semibold text-[#1C1917]">Telemetry Sync</div>
              <div className="text-[10px] text-[#78716A] mt-0.5">PLC Sensor Corridor</div>
            </div>

            {/* Step 5: Gemini Synthesis */}
            <div
              className={`p-3 rounded-xl border text-xs transition-all ${
                stage === "report"
                  ? "border-[#D97706] bg-[#FFFBEB] ring-1 ring-[#D97706]"
                  : stage === "completed"
                  ? "border-[#86EFAC] bg-[#F0FDF4] text-[#166534]"
                  : "border-[#E5DFD3] bg-[#FAF8F5] text-[#78716A]"
              }`}
            >
              <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                <span>05</span>
                <Sparkles className="w-3.5 h-3.5 text-[#D97706]" />
              </div>
              <div className="font-semibold text-[#1C1917]">Gemini Report</div>
              <div className="text-[10px] text-[#78716A] mt-0.5">Synthesis & Fixes</div>
            </div>

            {/* Step 6: Final Result */}
            <div
              className={`p-3 rounded-xl border text-xs transition-all ${
                stage === "completed"
                  ? isDefective
                    ? "border-[#DC2626] bg-[#FEF2F2] text-[#991B1B]"
                    : "border-[#16A34A] bg-[#F0FDF4] text-[#166534]"
                  : "border-[#E5DFD3] bg-[#FAF8F5] text-[#78716A]"
              }`}
            >
              <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                <span>06</span>
                <FileText className="w-3.5 h-3.5" />
              </div>
              <div className="font-semibold text-[#1C1917]">Dashboard Dossier</div>
              <div className="text-[10px] text-[#78716A] mt-0.5">Gate Verdict</div>
            </div>
          </div>
        </div>

        {/* Empty Upload State */}
        {stage === "idle" && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-12 text-center flex flex-col items-center justify-center gap-4 cursor-pointer transition-colors ${
              isDragOver ? "border-[#1C1917] bg-[#F3EFE6]" : "border-[#DDD5C7] bg-[#FFFFFF] hover:bg-[#FAF8F5]"
            }`}
          >
            <div className="w-12 h-12 rounded-xl bg-[#FAF8F5] border border-[#E5DFD3] flex items-center justify-center text-[#78716A]">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#1C1917]">
                Drop component photo here, or click to browse
              </p>
              <p className="text-xs text-[#78716A] mt-1">
                Supports JPG, PNG, WebP • Auto-dispatches through the pipeline
              </p>
            </div>
            <button
              type="button"
              className="px-4 py-2 rounded-xl bg-[#1C1917] text-[#FAF8F5] text-xs font-medium shadow-xs hover:bg-[#2C2724] transition-colors"
            >
              Select Image
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) runSimulation(f);
              }}
              className="hidden"
            />
          </div>
        )}

        {/* Active Inspection Canvas */}
        {stage !== "idle" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left: Component Image Canvas */}
            <div className="lg:col-span-7 bg-[#FFFFFF] border border-[#E5DFD3] rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-[#F2ECE1]">
                <span className="font-semibold text-[#1C1917] truncate max-w-[240px]">
                  {uploadedFile?.name || "Component"}
                </span>

                {/* View toggles */}
                <div className="flex items-center gap-1 bg-[#FAF8F5] p-1 rounded-lg border border-[#E5DFD3]">
                  <button
                    type="button"
                    onClick={() => setViewMode("image")}
                    className={`px-2 py-0.5 rounded text-xs font-medium cursor-pointer transition-colors ${
                      viewMode === "image" ? "bg-[#1C1917] text-[#FAF8F5]" : "text-[#57534E]"
                    }`}
                  >
                    Image
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("heatmap")}
                    className={`px-2 py-0.5 rounded text-xs font-medium cursor-pointer transition-colors ${
                      viewMode === "heatmap" ? "bg-[#1C1917] text-[#FAF8F5]" : "text-[#57534E]"
                    }`}
                  >
                    Heatmap
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("overlay")}
                    className={`px-2 py-0.5 rounded text-xs font-medium cursor-pointer transition-colors ${
                      viewMode === "overlay" ? "bg-[#1C1917] text-[#FAF8F5]" : "text-[#57534E]"
                    }`}
                  >
                    Overlay
                  </button>
                </div>
              </div>

              {/* Image Frame with Scanning Laser */}
              <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-[#111827] flex items-center justify-center">
                {imageUrl && (
                  <div className="relative w-full h-full flex items-center justify-center">
                    {viewMode === "image" ? (
                      <img
                        src={imageUrl}
                        alt="Component"
                        className="w-full h-full object-contain"
                      />
                    ) : viewMode === "heatmap" && heatmapUrl ? (
                      <img
                        src={heatmapUrl}
                        alt="Heatmap"
                        className="w-full h-full object-contain mix-blend-screen"
                      />
                    ) : (
                      <div className="relative w-full h-full flex items-center justify-center">
                        <img
                          src={imageUrl}
                          alt="Component"
                          className="w-full h-full object-contain"
                        />
                        {isDefective && heatmapUrl && (stage === "model2" || stage === "telemetry" || stage === "report" || stage === "completed") && (
                          <img
                            src={heatmapUrl}
                            alt="Thermal Overlay"
                            className="absolute inset-0 w-full h-full object-contain mix-blend-screen opacity-70 pointer-events-none"
                          />
                        )}
                      </div>
                    )}

                    {/* Scanning Laser Line during Model 1 and Model 2 processing */}
                    {(stage === "intake" || stage === "model1" || stage === "model2") && (
                      <div className="pointer-events-none absolute left-0 right-0 h-0.5 bg-[#38BDF8] shadow-[0_0_12px_#38BDF8] z-20 animate-laser-sweep" />
                    )}

                    {/* Clean Status Badge on Image */}
                    {stage !== "intake" && stage !== "model1" && (
                      <div className="absolute top-3 right-3 z-20">
                        {isDefective ? (
                          <div className="bg-[#FEF2F2]/95 border border-[#FCA5A5] text-[#991B1B] px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs">
                            <AlertTriangle className="w-3.5 h-3.5 text-[#DC2626]" />
                            <span>{defectType.toUpperCase()} ({confidence.toFixed(0)}%)</span>
                          </div>
                        ) : (
                          <div className="bg-[#F0FDF4]/95 border border-[#86EFAC] text-[#166534] px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs">
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" />
                            <span>NOMINAL PASS</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Active Stage Details */}
            <div className="lg:col-span-5 bg-[#FFFFFF] border border-[#E5DFD3] rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#F2ECE1]">
                <h3 className="text-xs font-bold text-[#1C1917] uppercase tracking-wider">
                  {stage === "intake"
                    ? "Stage 1: Image Ingestion"
                    : stage === "model1"
                    ? "Stage 2: Model 1 Gate"
                    : stage === "model2"
                    ? "Stage 3: Model 2 Classification"
                    : stage === "telemetry"
                    ? "Stage 4: Telemetry Sync"
                    : stage === "report"
                    ? "Stage 5: Gemini Report"
                    : "Inspection Completed"}
                </h3>

                <span
                  className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full ${
                    stage === "completed"
                      ? isDefective
                        ? "bg-[#FEF2F2] text-[#991B1B]"
                        : "bg-[#F0FDF4] text-[#166534]"
                      : "bg-[#FAF8F5] text-[#78716A] border border-[#E5DFD3]"
                  }`}
                >
                  {stage.toUpperCase()}
                </span>
              </div>

              {/* Stage: Model 1 */}
              {(stage === "intake" || stage === "model1") && (
                <div className="space-y-3 text-xs">
                  <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#E5DFD3] space-y-1">
                    <div className="text-[11px] text-[#78716A]">Binary Screening Model</div>
                    <div className="font-semibold text-[#1C1917]">ResNet-18 Gatekeeper</div>
                    <p className="text-[11px] text-[#57534E] pt-1">
                      Evaluates surface matrix. An OK part skips Model 2 directly to telemetry; a defective part routes to deep classification.
                    </p>
                  </div>
                </div>
              )}

              {/* Stage: Model 2 */}
              {stage === "model2" && (
                <div className="space-y-3 text-xs">
                  <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FCA5A5] space-y-1">
                    <div className="text-[11px] text-[#991B1B]">Deep Classifier & Heatmap</div>
                    <div className="font-semibold text-[#991B1B] capitalize">{defectType} Detected</div>
                    <p className="text-[11px] text-[#7F1D1D] pt-1">
                      Generating Grad-CAM thermal gradient layer and localized bounding boxes over surface voids.
                    </p>
                  </div>
                </div>
              )}

              {/* Stage: Telemetry */}
              {stage === "telemetry" && (
                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between text-[11px] text-[#78716A]">
                    <span>PLC Process Telemetry</span>
                    <span>MongoDB Corroboration</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {(result?.telemetry || []).slice(0, 4).map((sensor) => (
                      <div
                        key={sensor.id}
                        className={`p-2.5 rounded-xl border text-[11px] space-y-0.5 ${
                          sensor.isOutOfTolerance
                            ? "bg-[#FEF2F2] border-[#FCA5A5]"
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
                            sensor.isOutOfTolerance ? "text-[#DC2626] font-semibold" : "text-[#166534]"
                          }`}
                        >
                          {sensor.isOutOfTolerance ? "Deviation" : "Nominal"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Stage: Report & Completed */}
              {(stage === "report" || stage === "completed") && (
                <div className="space-y-3 text-xs">
                  <div
                    className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                      isDefective ? "bg-[#FEF2F2] border-[#FCA5A5] text-[#991B1B]" : "bg-[#F0FDF4] border-[#86EFAC] text-[#166534]"
                    }`}
                  >
                    <div>
                      <div className="text-[10px] uppercase font-bold tracking-wider">Gate Decision</div>
                      <div className="text-sm font-bold mt-0.5">{gateDecision}</div>
                    </div>
                    <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-white/70">
                      {isDefective ? "Quarantine" : "Cleared"}
                    </span>
                  </div>

                  {/* Summary */}
                  <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#E5DFD3] space-y-1">
                    <span className="font-semibold text-[#1C1917] text-[11px]">Executive Briefing</span>
                    <p className="text-[#57534E] text-[11px] leading-relaxed">{summary}</p>
                  </div>

                  {/* Setpoint fix if defect */}
                  {Array.isArray(rootCause?.parameter_modifications) && rootCause.parameter_modifications.length > 0 && (
                    <div className="p-2.5 rounded-xl bg-[#FFFDF5] border border-[#FDE68A] space-y-1 text-xs">
                      <div className="font-semibold text-[#92400E] text-[11px] flex items-center gap-1">
                        <Gauge className="w-3.5 h-3.5 text-[#D97706]" />
                        <span>Suggested Modification</span>
                      </div>
                      <div className="text-[11px] text-[#78716A]">
                        {String((rootCause.parameter_modifications[0] as Record<string, unknown>)?.instruction || "")}
                      </div>
                    </div>
                  )}

                  {/* Action Link */}
                  {stage === "completed" && (
                    <div className="pt-2">
                      <Link
                        href="/dashboard"
                        className="w-full py-2 px-3 rounded-xl bg-[#1C1917] hover:bg-[#2C2724] text-[#FAF8F5] font-semibold text-center text-xs transition-colors shadow-xs flex items-center justify-center gap-1.5"
                      >
                        <span>Open in Inspection Studio</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
