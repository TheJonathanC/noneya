"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Scan,
  RotateCcw,
  Printer,
  ShieldCheck,
  ShieldAlert,
  Image as ImageIcon,
  Eye,
  EyeOff,
  Activity,
  Gauge,
  Clock,
  RefreshCw,
} from "lucide-react";
import { InspectionItem } from "@/lib/inspection-adapter";
import { InspectionError } from "@/lib/api";
import { LinenJsonViewer } from "./LinenJsonViewer";
import { DefectSegmenter } from "@/components/inspection/DefectSegmenter";

interface LinenResultsProps {
  activeItem: InspectionItem | null;
  allItems: InspectionItem[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  rawJson: Record<string, unknown> | null;
  isLoading: boolean;
  isBatch: boolean;
  isBatchProcessing?: boolean;
  batchProcessingIndex?: number;
  batchTotalCount?: number;
  gateDecision?: "GO" | "ADJUST" | "CRITICAL STOP";
  batchStats?: { total: number; passed: number; defective: number };
  errorState?: InspectionError | null;
  onRetry?: () => void;
  onDismissError?: () => void;
  onEnableMockFallback?: () => void;
}

export function LinenResults({
  activeItem,
  allItems,
  selectedIndex,
  onSelectIndex,
  rawJson,
  isLoading,
  isBatch,
  isBatchProcessing = false,
  batchProcessingIndex = 0,
  batchTotalCount = 0,
  gateDecision = "GO",
  batchStats,
  errorState,
  onRetry,
}: LinenResultsProps) {
  // Optical image / DefectSegmenter shown by default
  const [showImage, setShowImage] = useState<boolean>(true);

  // Loading State: only show full loading overlay if we do NOT yet have an active item to display
  if (isLoading && !activeItem) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#FAF8F5] text-center space-y-4">
        <div className="w-12 h-12 rounded-full border-2 border-[#E5DFD3] border-t-[#1C1917] animate-spin flex items-center justify-center">
          <Scan aria-hidden="true" className="w-5 h-5 text-[#1C1917]" />
        </div>
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-[#1C1917]">
            Analyzing Component…
          </h2>
          <p className="text-xs text-[#78716A]">
            Evaluating image and running integrated pipeline.
          </p>
        </div>
      </div>
    );
  }

  // Error State
  if (errorState && !activeItem) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 bg-[#FAF8F5] text-center space-y-5">
        <div className="p-4 rounded-2xl bg-[#FEF2F2] border border-[#FCA5A5]/60 text-[#991B1B]">
          <AlertCircle aria-hidden="true" className="w-8 h-8" />
        </div>

        <div className="space-y-1.5 max-w-md">
          <h2 className="text-sm font-bold text-[#1C1917]">
            {errorState.title || "Inspection Failed"}
          </h2>
          <p className="text-xs text-[#57534E] leading-relaxed">
            {errorState.message}
          </p>
        </div>

        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="py-2 px-4 rounded-xl bg-[#1C1917] hover:bg-[#2C2724] text-[#FAF8F5] text-xs font-semibold flex items-center gap-2 transition-[background-color,transform] duration-150 active:scale-[0.97] cursor-pointer shadow-xs"
          >
            <RotateCcw aria-hidden="true" className="w-3.5 h-3.5" />
            <span>Retry Inspection</span>
          </button>
        )}
      </div>
    );
  }

  // Empty Idle State (No sample buttons, clean guidance)
  if (!activeItem) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 sm:p-14 bg-[#FAF8F5] text-center space-y-6">
        <div className="w-14 h-14 rounded-2xl bg-[#F3EFE6] border border-[#E2DBD0] flex items-center justify-center text-[#78716A] shadow-2xs">
          <Scan aria-hidden="true" className="w-7 h-7" />
        </div>

        <div className="space-y-1.5 max-w-sm">
          <h2 className="text-base font-semibold text-[#1C1917]">
            Ready for Component Intake
          </h2>
          <p className="text-xs text-[#78716A] leading-relaxed">
            Upload a component image in the left panel to begin automated inspection. The pipeline evaluates surface contour and defect characteristics in real time.
          </p>
        </div>

        {/* Informational Stage Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 max-w-md w-full pt-2 text-left">
          <div className="p-3 rounded-xl border border-[#EAE4D7] bg-[#FFFFFF] shadow-2xs">
            <div className="text-[10px] font-semibold text-[#78716A] uppercase tracking-wider">Pass 1</div>
            <div className="text-xs font-medium text-[#1C1917] mt-0.5">Classification</div>
            <div className="text-[10px] text-[#A8A29E] mt-0.5">Nominal vs defect check</div>
          </div>
          <div className="p-3 rounded-xl border border-[#EAE4D7] bg-[#FFFFFF] shadow-2xs">
            <div className="text-[10px] font-semibold text-[#78716A] uppercase tracking-wider">Pass 2</div>
            <div className="text-xs font-medium text-[#1C1917] mt-0.5">Defect Isolation</div>
            <div className="text-[10px] text-[#A8A29E] mt-0.5">Sub-category routing</div>
          </div>
          <div className="p-3 rounded-xl border border-[#EAE4D7] bg-[#FFFFFF] shadow-2xs">
            <div className="text-[10px] font-semibold text-[#78716A] uppercase tracking-wider">Pass 3</div>
            <div className="text-xs font-medium text-[#1C1917] mt-0.5">Audit Report</div>
            <div className="text-[10px] text-[#A8A29E] mt-0.5">Confidence & review sign-off</div>
          </div>
        </div>
      </div>
    );
  }

  const isDefective = activeItem.status === "DEFECTIVE";
  const predictedDefects = activeItem.predictedDefects || [];
  const confidenceScores = activeItem.confidenceScores || {};
  const confidenceVal = Math.min(Math.max(activeItem.confidenceScore, 0), 100);

  return (
    <div className="flex-1 flex flex-col bg-[#FAF8F5] overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-5">
      {/* Real-time Sequential Batch Flow Animation Banner */}
      {isBatchProcessing && batchTotalCount > 1 && (
        <div className="p-4 rounded-2xl border border-[#FDE68A] bg-[#FFFDF5] text-[#92400E] shadow-2xs space-y-3">
          <div className="flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 font-medium">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D97706] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#D97706]"></span>
              </span>
              <span className="font-semibold text-[#1C1917]">
                Batch Pipeline: Processing Part {Math.min(batchProcessingIndex + 1, batchTotalCount)} of {batchTotalCount}
              </span>
            </div>
            <span className="font-mono font-semibold text-[11px] tabular-nums text-[#92400E]">
              {Math.round((Math.min(batchProcessingIndex + 1, batchTotalCount) / batchTotalCount) * 100)}%
            </span>
          </div>

          {/* Stepper Progress Bar */}
          <div className="w-full bg-[#FEF3C7] h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-[#D97706] h-full rounded-full transition-all duration-300 ease-out"
              style={{
                width: `${(Math.min(batchProcessingIndex + 1, batchTotalCount) / batchTotalCount) * 100}%`,
              }}
            />
          </div>

          {/* Step Pill Flow Badges */}
          <div className="flex items-center gap-1.5 overflow-x-auto pt-0.5">
            {Array.from({ length: batchTotalCount }).map((_, idx) => {
              const isPast = idx < allItems.length;
              const isCurrent = isBatchProcessing && idx === batchProcessingIndex;
              const pastItem = allItems[idx];
              const pastDefective = pastItem?.status === "DEFECTIVE";

              return (
                <div
                  key={idx}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-medium flex items-center gap-1 shrink-0 ${
                    isPast
                      ? pastDefective
                        ? "bg-[#FEE2E2] text-[#991B1B] border border-[#FCA5A5]"
                        : "bg-[#D1FAE5] text-[#065F46] border border-[#A7F3D0]"
                      : isCurrent
                      ? "bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] ring-1 ring-[#F59E0B]/50 font-bold animate-pulse"
                      : "bg-[#FFFFFF]/70 text-[#A8A29E] border border-[#E5E7EB]"
                  }`}
                >
                  <span>Part {idx + 1}</span>
                  {isPast && <span>{pastDefective ? "✕" : "✓"}</span>}
                  {isCurrent && <RefreshCw aria-hidden="true" className="w-2.5 h-2.5 animate-spin" />}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Batch Navigation (when inspecting multiple parts or while batch is active) */}
      {isBatch && (allItems.length > 1 || isBatchProcessing) && (
        <div className="p-3 bg-[#FFFFFF] rounded-2xl border border-[#E5DFD3] flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2 overflow-x-auto">
            {allItems.map((item, idx) => {
              const isItemDefective = item.status === "DEFECTIVE";
              const isSelected = selectedIndex === idx;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectIndex(idx)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                    isSelected
                      ? "bg-[#1C1917] border-[#1C1917] text-[#FAF8F5] shadow-xs"
                      : "bg-[#FAF8F5] border-[#E5DFD3] text-[#57534E] hover:bg-[#F3EFE6]"
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isItemDefective ? "bg-[#EF4444]" : "bg-[#22C55E]"
                    }`}
                  />
                  <span>{item.fileName || `Part ${idx + 1}`}</span>
                </button>
              );
            })}

            {isBatchProcessing && batchTotalCount > allItems.length && (
              <div className="px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] animate-pulse shrink-0">
                <RefreshCw aria-hidden="true" className="w-3 h-3 animate-spin" />
                <span>Part {batchProcessingIndex + 1} Analyzing…</span>
              </div>
            )}
          </div>

          {batchStats && (
            <span className="text-xs text-[#78716A] shrink-0 font-mono">
              {batchStats.passed}/{batchStats.total} OK
            </span>
          )}
        </div>
      )}

      {/* 1. Primary Inspection Report & Data (Shown Neatly at Top) */}
      <section
        aria-label="Inspection Report"
        className="rounded-2xl border border-[#E5DFD3] bg-[#FFFFFF] overflow-hidden shadow-xs"
      >
        {/* Report Header */}
        <div className="p-5 border-b border-[#EAE4D7] flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl border ${
                isDefective
                  ? "bg-[#FEF2F2] border-[#FCA5A5]/60 text-[#991B1B]"
                  : "bg-[#F0FDF4] border-[#86EFAC]/60 text-[#166534]"
              }`}
            >
              {isDefective ? (
                <ShieldAlert aria-hidden="true" className="w-5 h-5" />
              ) : (
                <ShieldCheck aria-hidden="true" className="w-5 h-5" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-sm font-semibold text-[#1C1917]">
                  Inspection Report
                </h3>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    isDefective
                      ? "bg-[#FEF2F2] text-[#991B1B] border border-[#FCA5A5]/70"
                      : "bg-[#F0FDF4] text-[#166534] border border-[#86EFAC]/70"
                  }`}
                >
                  {isDefective ? "Defect Detected" : "OK • Good to Go"}
                </span>
              </div>
              <p className="text-xs text-[#78716A] mt-0.5">
                {activeItem.fileName || "Component Analysis"} • Scanned at{" "}
                <span className="font-mono tabular-nums">{activeItem.timestamp}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            aria-label="Print report"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#DDD5C7] text-[#57534E] hover:text-[#1C1917] hover:bg-[#F3EFE6] text-xs font-medium transition-[background-color,color,transform] duration-150 active:scale-[0.97] cursor-pointer"
          >
            <Printer aria-hidden="true" className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4">
          {/* Executive Summary Banner */}
          <div
            className={`p-4 rounded-xl border flex items-start gap-3 ${
              isDefective
                ? "bg-[#FFF5F5] border-[#FED7D7] text-[#991B1B]"
                : "bg-[#F6FEF8] border-[#DCFCE7] text-[#166534]"
            }`}
          >
            {isDefective ? (
              <AlertTriangle aria-hidden="true" className="w-5 h-5 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 aria-hidden="true" className="w-5 h-5 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <div className="text-sm font-semibold">
                {isDefective
                  ? "Defect detected: routed to integrated diagnostic pipeline."
                  : "The part is OK and good to go."}
              </div>
              <p className="text-xs leading-relaxed text-[#57534E]">
                {isDefective
                  ? "A defect was found during the initial inspection pass. The integrated diagnostic pipeline was called to categorize and assess the defect."
                  : "All optical surface contours and dimensional tolerances are nominal. No defects were detected, and the part is verified for use."}
              </p>
            </div>
          </div>

          {/* Categorized Defects (if Defective) */}
          {isDefective && predictedDefects.length > 0 && (
            <div className="p-4 rounded-xl border border-[#E5DFD3] bg-[#FAF8F5] space-y-2.5">
              <div className="text-xs font-semibold text-[#1C1917]">
                Categorized Defects (Integrated Pipeline)
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {predictedDefects.map((defect) => {
                  const score = confidenceScores[defect];
                  return (
                    <div
                      key={defect}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#FFFFFF] border border-[#FCA5A5] text-[#991B1B] text-xs font-medium shadow-2xs"
                    >
                      <span className="font-semibold uppercase tracking-wide">
                        {defect}
                      </span>
                      {score && (
                        <span className="font-mono text-[11px] text-[#7F1D1D] bg-[#FEE2E2] px-1.5 py-0.5 rounded font-semibold">
                          {score}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl border border-[#EAE4D7] bg-[#FAF8F5]">
              <div className="text-[11px] text-[#78716A]">Verdict</div>
              <div
                className={`text-sm font-semibold mt-0.5 ${
                  isDefective ? "text-[#991B1B]" : "text-[#166534]"
                }`}
              >
                {isDefective ? "Defective" : "OK"}
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-[#EAE4D7] bg-[#FAF8F5]">
              <div className="text-[11px] text-[#78716A]">Confidence</div>
              <div className="text-sm font-semibold font-mono text-[#1C1917] mt-0.5">
                {activeItem.confidenceScore.toFixed(1)}%
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-[#EAE4D7] bg-[#FAF8F5]">
              <div className="text-[11px] text-[#78716A]">Human Review</div>
              <div className="text-sm font-semibold text-[#1C1917] mt-0.5">
                {isDefective
                  ? activeItem.requiresHumanReview !== false
                    ? "Required"
                    : "Not Required"
                  : "None"}
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-[#EAE4D7] bg-[#FAF8F5]">
              <div className="text-[11px] text-[#78716A]">Action</div>
              <div className="text-sm font-semibold text-[#1C1917] mt-0.5">
                {isDefective ? "Quarantine & Review" : "Release to Line"}
              </div>
            </div>
          </div>

          {/* Confidence Meter Bar */}
          <div className="p-3.5 rounded-xl border border-[#EAE4D7] bg-[#FAF8F5] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#78716A] font-medium flex items-center gap-1.5">
                <Gauge aria-hidden="true" className="w-3.5 h-3.5 text-[#57534E]" />
                <span>Detection Confidence</span>
              </span>
              <span className="font-mono font-semibold text-[#1C1917] tabular-nums">
                {confidenceVal.toFixed(1)}%
              </span>
            </div>
            <div className="h-2 w-full bg-[#E5DFD3] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  isDefective ? "bg-[#DC2626]" : "bg-[#16A34A]"
                }`}
                style={{ width: `${confidenceVal}%` }}
              />
            </div>
          </div>

          {/* Diagnostic Metadata Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
            <div className="p-2.5 rounded-lg border border-[#EAE4D7] bg-[#FCFBF8] flex items-center gap-2 text-[#78716A]">
              <Clock aria-hidden="true" className="w-3.5 h-3.5 text-[#A8A29E]" />
              <span>
                Cycle:{" "}
                <span className="font-mono font-semibold text-[#1C1917]">
                  {activeItem.metadata?.cycleDurationMs || 120} ms
                </span>
              </span>
            </div>

            <div className="p-2.5 rounded-lg border border-[#EAE4D7] bg-[#FCFBF8] flex items-center gap-2 text-[#78716A]">
              <Activity aria-hidden="true" className="w-3.5 h-3.5 text-[#A8A29E]" />
              <span>
                Pipeline:{" "}
                <span className="font-semibold text-[#1C1917]">
                  {isDefective ? "Integrated Multi-Defect" : "Initial Classifier"}
                </span>
              </span>
            </div>

            <div className="p-2.5 rounded-lg border border-[#EAE4D7] bg-[#FCFBF8] flex items-center gap-2 text-[#78716A]">
              <ShieldCheck aria-hidden="true" className="w-3.5 h-3.5 text-[#A8A29E]" />
              <span>
                Component:{" "}
                <span className="font-semibold text-[#1C1917]">
                  {activeItem.metadata?.componentType || "Industrial Casting"}
                </span>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Optical Component Image (Hidden by Default!) */}
      <section
        aria-label="Component visual capture"
        className="rounded-2xl border border-[#E5DFD3] bg-[#FFFFFF] overflow-hidden shadow-xs"
      >
        <div
          className={`px-4 py-3 bg-[#FAF8F5] flex items-center justify-between gap-3 ${
            showImage ? "border-b border-[#EAE4D7]" : ""
          }`}
        >
          <button
            type="button"
            onClick={() => setShowImage(!showImage)}
            className="flex items-center gap-2.5 text-left group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C1917] rounded-lg p-0.5 -m-0.5"
            aria-expanded={showImage}
            aria-label={showImage ? "Hide component image" : "Show component image"}
          >
            <div className="p-1.5 rounded-lg bg-[#EFE9DD] text-[#78350F] group-hover:bg-[#E5DFD3] transition-colors">
              <ImageIcon aria-hidden="true" className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[#1C1917] tracking-tight text-xs">
                  {isDefective ||
                  gateDecision === "CRITICAL STOP" ||
                  gateDecision === "ADJUST" ||
                  Boolean(activeItem.visionResults?.heatmap_image_base64) ||
                  Boolean(activeItem.heatmapImageUrl)
                    ? "AI Defect Localization & Segmentation (Grad-CAM)"
                    : "Optical Component Capture"}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#EAE4D7] text-[#57534E] font-medium">
                  {showImage ? "Visible" : "Hidden"}
                </span>
                {(isDefective ||
                  gateDecision === "CRITICAL STOP" ||
                  gateDecision === "ADJUST" ||
                  Boolean(activeItem.visionResults?.heatmap_image_base64)) && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-800 font-semibold border border-rose-200">
                    Grad-CAM Overlay
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#78716A]">
                {activeItem.fileName || "High-resolution inspection photograph"}
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setShowImage(!showImage)}
            aria-label={showImage ? "Hide component image" : "Show component image"}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#DDD5C7] text-[#57534E] hover:text-[#1C1917] hover:bg-[#F3EFE6] text-xs font-medium transition-[background-color,color,transform] duration-150 active:scale-[0.97] cursor-pointer"
          >
            {showImage ? (
              <>
                <EyeOff aria-hidden="true" className="w-3.5 h-3.5" />
                <span>Hide Image</span>
              </>
            ) : (
              <>
                <Eye aria-hidden="true" className="w-3.5 h-3.5" />
                <span>Show Image</span>
              </>
            )}
          </button>
        </div>

        {/* When shown, render DefectSegmenter with live Grad-CAM heatmap and optical analysis */}
        {showImage && (
          <div className="p-4 bg-[#FCFBF8]">
            <DefectSegmenter
              originalImage={
                activeItem.visionResults?.original_image_base64 ||
                activeItem.rawImageUrl
              }
              heatmapImage={
                activeItem.visionResults?.heatmap_image_base64 ||
                activeItem.heatmapImageUrl
              }
              segmentationInstances={activeItem.segmentationInstances}
              defectType={
                activeItem.predictedDefects && activeItem.predictedDefects.length > 0
                  ? activeItem.predictedDefects.join(", ")
                  : activeItem.defectType || (isDefective ? "Localized Defect" : "Nominal Surface")
              }
              severity={activeItem.severity || (isDefective ? "Critical" : "Nominal")}
              confidence={activeItem.confidenceScore}
              stationName={activeItem.metadata?.stationId || "Automated Line • Station 04"}
            />
          </div>
        )}
      </section>

      {/* 3. Raw Diagnostic JSON Output (Hidden by Default!) */}
      {rawJson && (
        <LinenJsonViewer
          data={rawJson}
          defaultExpanded={false}
          title={
            isDefective
              ? "Integrated Pipeline JSON Output"
              : "Classification JSON Output"
          }
        />
      )}
    </div>
  );
}
