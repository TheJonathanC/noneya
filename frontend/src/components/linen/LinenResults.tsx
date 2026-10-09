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
  Image as ImageIcon,
  Activity,
  Check,
  FileText,
  Sliders,
  ChevronDown,
  ChevronUp,
  TrendingUp,
} from "lucide-react";
import { InspectionItem } from "@/lib/inspection-adapter";
import { InspectionError } from "@/lib/api";
import { LinenJsonViewer } from "./LinenJsonViewer";
import { DefectSegmenter } from "@/components/inspection/DefectSegmenter";
import { ProcessTelemetryDossier } from "@/components/inspection/ProcessTelemetryDossier";
import { DotsLoader } from "@/components/common/DotsLoader";
import { openPrintableBatchReport } from "@/lib/pdf-report";

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
  gateDecision = "GO",
  batchStats,
  errorState,
  onRetry,
}: LinenResultsProps) {
  // Navigation Tabs:
  // Defective batch: 'report' (Batch Report) | 'visual' (Image) | 'telemetry' (Sensors) | 'json' (Details)
  // OK batch:        'report' (Batch Report) | 'visual' (Image) | 'telemetry' (Sensors) | 'json' (Details)
  const [activeTabOverride, setActiveTabOverride] = useState<string | null>(null);
  const [lastPartId, setLastPartId] = useState<string | null>(null);
  const [expandedImageIds, setExpandedImageIds] = useState<Record<string, boolean>>({});

  const toggleImageExpand = (id: string) => {
    setExpandedImageIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // If operator switches active image in batch, reset tab override
  if (activeItem && activeItem.id !== lastPartId) {
    setLastPartId(activeItem.id);
    setActiveTabOverride(null);
  }

  // Loading State
  if (isLoading && !activeItem) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#FAF8F5] text-center space-y-4">
        <div className="p-3 rounded-2xl bg-[#FFFFFF] border border-[#E5DFD3] shadow-xs flex items-center justify-center">
          <DotsLoader size="md" shape="loader" />
        </div>
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-[#1C1917]">
            Analyzing Entire Batch…
          </h2>
          <p className="text-xs text-[#78716A]">
            Evaluating all component images simultaneously through the integrated AI pipeline.
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

  // Empty Idle State
  if (!activeItem) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 sm:p-14 bg-[#FAF8F5] text-center space-y-6">
        <div className="w-14 h-14 rounded-2xl bg-[#F3EFE6] border border-[#E2DBD0] flex items-center justify-center text-[#78716A] shadow-2xs">
          <Scan aria-hidden="true" className="w-7 h-7" />
        </div>

        <div className="space-y-1.5 max-w-sm">
          <h2 className="text-base font-semibold text-[#1C1917]">
            Ready for Batch Intake
          </h2>
          <p className="text-xs text-[#78716A] leading-relaxed">
            Select component photos in the intake panel to start automated inspection. The pipeline evaluates surface contour, Grad-CAM defect localization, and process telemetry in parallel.
          </p>
        </div>

        {/* Informational Stage Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 max-w-md w-full pt-2 text-left">
          <div className="p-3 rounded-xl border border-[#EAE4D7] bg-[#FFFFFF] shadow-2xs">
            <div className="text-[10px] font-semibold text-[#78716A] uppercase tracking-wider">Pass 1</div>
            <div className="text-xs font-medium text-[#1C1917] mt-0.5">Classification</div>
            <div className="text-[10px] text-[#A8A29E] mt-0.5">Nominal vs defect filter</div>
          </div>
          <div className="p-3 rounded-xl border border-[#EAE4D7] bg-[#FFFFFF] shadow-2xs">
            <div className="text-[10px] font-semibold text-[#78716A] uppercase tracking-wider">Pass 2</div>
            <div className="text-xs font-medium text-[#1C1917] mt-0.5">AI Segmentation</div>
            <div className="text-[10px] text-[#A8A29E] mt-0.5">Grad-CAM & contours</div>
          </div>
          <div className="p-3 rounded-xl border border-[#EAE4D7] bg-[#FFFFFF] shadow-2xs">
            <div className="text-[10px] font-semibold text-[#78716A] uppercase tracking-wider">Pass 3</div>
            <div className="text-xs font-medium text-[#1C1917] mt-0.5">Telemetry Audit</div>
            <div className="text-[10px] text-[#A8A29E] mt-0.5">Root cause & MongoDB</div>
          </div>
        </div>
      </div>
    );
  }

  const isDefective = activeItem.status === "DEFECTIVE";
  const anyDefectsInBatch = allItems.some((i) => i.status === "DEFECTIVE");
  const predictedDefects = activeItem.predictedDefects || [];
  const confidenceVal = Math.min(Math.max(activeItem.confidenceScore, 0), 100);

  // Default tab is 'report' so the operator sees the full batch report first, with quick access to 'visual'
  const defaultTab = "report";
  const currentTab = activeTabOverride || defaultTab;

  const originalImg =
    activeItem.visionResults?.original_image_base64 ||
    activeItem.visionResults?.original_url ||
    activeItem.rawImageUrl;

  const heatmapImg =
    activeItem.visionResults?.heatmap_image_base64 ||
    activeItem.visionResults?.heatmap_png_url ||
    activeItem.heatmapImageUrl;

  // Extract raw telemetry dictionary from rawJson
  let rawTelemetryDict: Record<string, number> | undefined = undefined;
  if (rawJson && typeof rawJson.telemetry === "object" && rawJson.telemetry !== null) {
    rawTelemetryDict = rawJson.telemetry as Record<string, number>;
  } else if (
    rawJson &&
    Array.isArray(rawJson.results) &&
    rawJson.results[selectedIndex] &&
    typeof (rawJson.results[selectedIndex] as Record<string, unknown>).telemetry === "object"
  ) {
    rawTelemetryDict = (rawJson.results[selectedIndex] as Record<string, unknown>).telemetry as Record<string, number>;
  }

  // Extract root cause analysis from rawJson
  let rootCauseAnalysisData: Record<string, unknown> | undefined = undefined;
  if (rawJson && typeof rawJson.root_cause_analysis === "object" && rawJson.root_cause_analysis !== null) {
    rootCauseAnalysisData = rawJson.root_cause_analysis as Record<string, unknown>;
  } else if (
    rawJson &&
    Array.isArray(rawJson.results) &&
    rawJson.results[selectedIndex] &&
    typeof (rawJson.results[selectedIndex] as Record<string, unknown>).root_cause_analysis === "object"
  ) {
    rootCauseAnalysisData = (rawJson.results[selectedIndex] as Record<string, unknown>).root_cause_analysis as Record<string, unknown>;
  } else if (activeItem.rootCauseSummary) {
    rootCauseAnalysisData = {
      diagnostic_explanation: activeItem.rootCauseSummary,
      action: activeItem.recommendedAction,
    };
  }

  // Extract batch engine analysis from rawJson
  const batchAnalysis =
    rawJson && typeof rawJson.batch_analysis === "object" && rawJson.batch_analysis !== null
      ? (rawJson.batch_analysis as Record<string, unknown>)
      : undefined;

  const supervisorSummary =
    typeof rawJson?.supervisor_summary === "string"
      ? (rawJson.supervisor_summary as string)
      : typeof batchAnalysis?.review === "string"
      ? (batchAnalysis.review as string)
      : activeItem.rootCauseSummary || null;

  const batchFixes = Array.isArray(batchAnalysis?.fixes)
    ? (batchAnalysis.fixes as Array<{ sensor: string; label: string; instruction: string; current?: number; target?: number; unit?: string }>)
    : [];

  const batchPrediction =
    batchAnalysis && typeof batchAnalysis.prediction === "object" && batchAnalysis.prediction !== null
      ? (batchAnalysis.prediction as { text?: string; next_batch_risk?: number; closest_signature?: string })
      : undefined;

  const effectiveBatchId =
    typeof rawJson?.batch_id === "string" ? rawJson.batch_id : "BATCH-2026-X89";

  const defectiveItems = allItems.filter((item) => item.status === "DEFECTIVE");
  const passedItems = allItems.filter((item) => item.status === "PASSED");

  // Handler for Exporting Formatted Batch PDF (directly triggers print dialog)
  const handlePrintPdf = () => {
    openPrintableBatchReport({
      batchId: effectiveBatchId,
      gateDecision,
      supervisorSummary,
      batchPrediction,
      batchFixes,
      batchStats: batchStats || {
        total: allItems.length,
        passed: passedItems.length,
        defective: defectiveItems.length,
      },
      items: allItems,
      rawJson,
    });
  };

  // Primary Top-Level Tabs
  const primaryTabs = [
    {
      id: "report",
      label: "Batch Report",
      icon: FileText,
    },
    {
      id: "visual",
      label: "Image",
      icon: ImageIcon,
    },
    {
      id: "telemetry",
      label: "Sensors",
      icon: Activity,
    },
    {
      id: "json",
      label: "Details",
      icon: Sliders,
    },
  ];

  return (
    <div className="flex-1 flex flex-col bg-[#FAF8F5] overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-4">
      {/* =========================================================================
          UNIFIED OPERATOR STATUS & NAVIGATION BAR
      ========================================================================= */}
      <div className="bg-[#FFFFFF] border border-[#E5DFD3] rounded-2xl p-3 sm:p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Left: Defects Detected Status Pill + Image Selector */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Status Pill: Clean solid dot, no flashing */}
          <div
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold border transition-colors ${
              anyDefectsInBatch
                ? "bg-[#FEF2F2] border-[#FCA5A5] text-[#991B1B]"
                : "bg-[#F0FDF4] border-[#86EFAC] text-[#166534]"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                anyDefectsInBatch ? "bg-[#EF4444]" : "bg-[#22C55E]"
              }`}
            />
            <span>{anyDefectsInBatch ? "Defects Detected" : "All Good • Batch OK"}</span>
          </div>

          {/* Batch Selector (Labeled Image 1, Image 2, etc.) */}
          {isBatch && allItems.length > 1 && (
            <div className="flex items-center gap-1 bg-[#FAF8F5] p-1 rounded-xl border border-[#E5DFD3]">
              {allItems.map((item, idx) => {
                const itemDefective = item.status === "DEFECTIVE";
                const isSelected = selectedIndex === idx;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectIndex(idx)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[#1C1917] text-[#FAF8F5] font-semibold shadow-2xs"
                        : "text-[#57534E] hover:bg-[#F3EFE6] hover:text-[#1C1917]"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        itemDefective ? "bg-[#EF4444]" : "bg-[#22C55E]"
                      }`}
                    />
                    <span>Image {idx + 1}</span>
                  </button>
                );
              })}

              {batchStats && (
                <span className="text-[11px] text-[#78716A] px-2 font-mono border-l border-[#E5DFD3] ml-0.5">
                  {batchStats.passed}/{batchStats.total} OK
                </span>
              )}
            </div>
          )}

          {isBatchProcessing && (
            <div className="px-2.5 py-1 text-xs font-medium text-[#92400E] bg-[#FFFBEB] border border-[#FDE68A] rounded-xl flex items-center gap-1.5">
              <DotsLoader size="sm" shape="loader" className="w-3.5 h-3.5" />
              <span>Analyzing all batch components simultaneously…</span>
            </div>
          )}
        </div>

        {/* Right: Primary Tabs + PDF Print Button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrintPdf}
            title="Download or Print Batch Inspection Report PDF"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#DDD5C7] bg-[#FFFFFF] hover:bg-[#F3EFE6] text-[#1C1917] text-xs font-semibold transition-all cursor-pointer shadow-2xs"
          >
            <Printer className="w-3.5 h-3.5 text-[#57534E]" />
            <span>Export PDF</span>
          </button>

          <div className="flex items-center gap-1 bg-[#FAF8F5] p-1 rounded-xl border border-[#E5DFD3]">
            {primaryTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = currentTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTabOverride(tab.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    isActive
                      ? "bg-[#1C1917] text-[#FAF8F5] font-semibold shadow-2xs"
                      : "text-[#57534E] hover:bg-[#F3EFE6] hover:text-[#1C1917]"
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 ${
                      isActive ? "text-[#FAF8F5]" : "text-[#78716A]"
                    }`}
                  />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* =========================================================================
          TAB 1: BATCH REPORT (EXECUTIVE SYNTHESIS & PER-IMAGE BREAKDOWN)
          Shows the whole batch verdict, prediction, telemetry, and per-image details
      ========================================================================= */}
      {currentTab === "report" && (
        <div className="space-y-5">
          {/* Executive Whole-Batch Verdict Banner */}
          <section
            aria-label="Whole Batch Inspection Verdict"
            className={`rounded-2xl border p-5 sm:p-6 space-y-4 shadow-xs ${
              gateDecision === "CRITICAL STOP"
                ? "border-[#FCA5A5] bg-[#FFF5F5]"
                : gateDecision === "ADJUST"
                ? "border-[#FDE68A] bg-[#FFFDF5]"
                : "border-[#86EFAC] bg-[#F0FDF4]"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2.5 rounded-xl border ${
                    gateDecision === "CRITICAL STOP"
                      ? "bg-[#FEF2F2] border-[#FCA5A5] text-[#991B1B]"
                      : gateDecision === "ADJUST"
                      ? "bg-[#FEF3C7] border-[#FDE68A] text-[#92400E]"
                      : "bg-[#FFFFFF] border-[#86EFAC] text-[#166534]"
                  }`}
                >
                  {gateDecision === "GO" ? (
                    <CheckCircle2 className="w-6 h-6 text-[#16A34A]" />
                  ) : (
                    <AlertTriangle className="w-6 h-6 text-[#DC2626]" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-extrabold text-[#1C1917]">
                      Batch Gate Decision: {gateDecision}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#FFFFFF] border border-[#DDD5C7] text-[#57534E]">
                      {effectiveBatchId}
                    </span>
                  </div>
                  <p className="text-xs text-[#57534E] mt-0.5">
                    {gateDecision === "GO"
                      ? "All images verified nominal. The batch is cleared for downstream line release."
                      : gateDecision === "ADJUST"
                      ? "Process telemetry drift or defect detected. Apply setpoint adjustments before next run."
                      : "Defect threshold exceeded. Assembly line halted for engineering review."}
                  </p>
                </div>
              </div>

              {/* Yield Pill & PDF Button */}
              <div className="flex items-center gap-2">
                <div className="px-3.5 py-1.5 rounded-xl bg-[#FFFFFF] border border-[#DDD5C7] text-xs font-mono font-semibold text-[#1C1917]">
                  Yield: {batchStats?.passed ?? passedItems.length} / {batchStats?.total ?? allItems.length} Passed
                </div>
                <button
                  type="button"
                  onClick={handlePrintPdf}
                  className="px-3 py-1.5 rounded-xl bg-[#1C1917] hover:bg-[#2C2724] text-[#FAF8F5] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print PDF</span>
                </button>
              </div>
            </div>

            {/* Supervisor Briefing (from Gemini LLM or Batch Engine) */}
            {supervisorSummary && (
              <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#EAE4D7] space-y-1.5 text-xs">
                <div className="font-semibold text-[#1C1917] flex items-center justify-between">
                  <span>Supervisor Summary</span>
                  {batchPrediction?.next_batch_risk !== undefined && (
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-[#FEF2F2] text-[#991B1B] border border-[#FCA5A5] font-semibold">
                      Next-Batch Risk: {Math.round(batchPrediction.next_batch_risk * 100)}%
                    </span>
                  )}
                </div>
                <p className="text-[#57534E] leading-relaxed">
                  {supervisorSummary}
                </p>
              </div>
            )}

            {/* Probable Cause & Next-Batch Prediction Section */}
            {(batchPrediction?.text || rootCauseAnalysisData) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* Probable Cause Card */}
                <div className="p-3.5 rounded-xl bg-[#FFFFFF] border border-[#EAE4D7] space-y-1.5 text-xs">
                  <div className="font-bold text-[#1C1917] flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-[#D97706]" />
                    <span>Probable Root Cause</span>
                  </div>
                  <p className="text-[#57534E] leading-relaxed">
                    {typeof rootCauseAnalysisData?.diagnostic_explanation === "string"
                      ? rootCauseAnalysisData.diagnostic_explanation
                      : typeof rootCauseAnalysisData?.probable_cause === "string"
                      ? rootCauseAnalysisData.probable_cause
                      : anyDefectsInBatch
                      ? "Hydraulic ram injection pressure or melt temperature fluctuation outside nominal Six Sigma corridor."
                      : "Process parameters stable within nominal tolerance bounds."}
                  </p>
                  {Boolean(rootCauseAnalysisData?.primary_culprit_sensor) && (
                    <div className="text-[11px] font-mono text-[#991B1B] pt-1">
                      Culprit: {String(rootCauseAnalysisData?.primary_culprit_sensor).toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Prediction: Will Problem Continue? */}
                <div className="p-3.5 rounded-xl bg-[#FFFFFF] border border-[#EAE4D7] space-y-1.5 text-xs">
                  <div className="font-bold text-[#1C1917] flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-[#1C1917]" />
                    <span>Will Problem Continue? (Trend Prediction)</span>
                  </div>
                  <p className="text-[#57534E] leading-relaxed">
                    {batchPrediction?.text ||
                      (anyDefectsInBatch
                        ? "High probability of recurring defect signatures on subsequent batches unless setpoint fixes are applied."
                        : "Thermal and mechanical baselines indicate zero drift risk for upcoming cycles.")}
                  </p>
                  {batchPrediction?.next_batch_risk !== undefined && (
                    <div className="text-[11px] font-semibold text-[#78350F] pt-1">
                      Calculated Recurrence Risk: {Math.round(batchPrediction.next_batch_risk * 100)}%
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Batch Fixes */}
            {batchFixes.length > 0 && (
              <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#FDE68A] space-y-2 text-xs">
                <div className="font-semibold text-[#92400E] flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-[#D97706]" />
                  <span>Recommended Machine Setpoint Fixes ({batchFixes.length})</span>
                </div>
                <div className="space-y-1.5">
                  {batchFixes.map((fix, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-[#FFFDF5] border border-[#FDE68A] flex items-center justify-between text-xs gap-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#D97706]" />
                        <span className="font-medium text-[#1C1917]">{fix.instruction}</span>
                      </div>
                      {fix.current !== undefined && fix.target !== undefined && (
                        <span className="font-mono text-[11px] text-[#78716A] tabular-nums shrink-0">
                          {fix.current} → {fix.target} {fix.unit || ""}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Section: Batch Images Breakdown with Overlays & Probable Causes */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#1C1917] flex items-center gap-2">
                <span>Batch Images Breakdown</span>
                <span className="text-xs font-mono text-[#78716A]">({allItems.length} images)</span>
              </h3>
              <span className="text-xs text-[#78716A]">
                Showing defect status, visual overlays, and probable causes
              </span>
            </div>

            <div className="space-y-3">
              {allItems.map((item, idx) => {
                const itemDefective = item.status === "DEFECTIVE";
                const isExpanded = expandedImageIds[item.id] ?? true; // expanded by default
                const isCurrentActive = selectedIndex === idx;

                const itemOrigImg =
                  item.visionResults?.original_image_base64 ||
                  item.visionResults?.original_url ||
                  item.rawImageUrl;
                const itemHeatImg =
                  item.visionResults?.heatmap_image_base64 ||
                  item.visionResults?.heatmap_png_url ||
                  item.heatmapImageUrl;

                const defectsList =
                  item.predictedDefects && item.predictedDefects.length > 0
                    ? item.predictedDefects.join(", ")
                    : item.defectType || (itemDefective ? "Defect" : "Nominal");

                return (
                  <div
                    key={item.id}
                    className={`rounded-2xl border transition-all ${
                      itemDefective
                        ? "border-[#FCA5A5] bg-[#FFFFFF]"
                        : "border-[#E5DFD3] bg-[#FFFFFF]"
                    } ${isCurrentActive ? "ring-2 ring-[#1C1917]" : ""}`}
                  >
                    {/* Header Row */}
                    <div
                      onClick={() => toggleImageExpand(item.id)}
                      className="p-3.5 sm:p-4 flex items-center justify-between gap-3 cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                            itemDefective ? "bg-[#EF4444]" : "bg-[#22C55E]"
                          }`}
                        />
                        <div className="truncate">
                          <span className="font-bold text-xs text-[#1C1917]">
                            Image {idx + 1} ({item.partId})
                          </span>
                          <span className="text-[11px] text-[#78716A] ml-2">
                            {item.fileName ? item.fileName : item.serialNumber}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                            itemDefective
                              ? "bg-[#FEF2F2] border-[#FCA5A5] text-[#991B1B]"
                              : "bg-[#F0FDF4] border-[#86EFAC] text-[#166534]"
                          }`}
                        >
                          {itemDefective ? defectsList : "Pass • Nominal"}
                        </span>

                        <span className="font-mono text-xs text-[#57534E]">
                          {Math.round(item.confidenceScore)}%
                        </span>

                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-[#78716A]" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-[#78716A]" />
                        )}
                      </div>
                    </div>

                    {/* Image Details Body */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 border-t border-[#EAE4D7] space-y-3.5 text-xs">
                        {/* Image Pairs: Original + Heatmap Side-by-Side */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                          <div className="space-y-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#78716A]">
                              Original Photo
                            </span>
                            <div className="aspect-4/3 rounded-xl border border-[#E5DFD3] bg-[#1C1917] overflow-hidden flex items-center justify-center">
                              {itemOrigImg ? (
                                <img
                                  src={itemOrigImg}
                                  alt={`Image ${idx + 1} original`}
                                  className="w-full h-full object-contain"
                                />
                              ) : (
                                <span className="text-[#A8A29E] text-xs">No image available</span>
                              )}
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#78716A]">
                              Defect Localization Overlay (Grad-CAM)
                            </span>
                            <div className="aspect-4/3 rounded-xl border border-[#E5DFD3] bg-[#1C1917] overflow-hidden flex items-center justify-center relative">
                              {itemOrigImg && (
                                <img
                                  src={itemOrigImg}
                                  alt={`Image ${idx + 1} base`}
                                  className="w-full h-full object-contain"
                                />
                              )}
                              {itemHeatImg && (
                                <img
                                  src={itemHeatImg}
                                  alt={`Image ${idx + 1} heatmap`}
                                  className="w-full h-full object-contain absolute inset-0 mix-blend-screen opacity-90"
                                />
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Diagnostic & Telemetry Attribution Strip */}
                        <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#EAE4D7] space-y-1.5 text-xs">
                          <div>
                            <strong className="text-[#1C1917]">Defect Status: </strong>
                            <span className={itemDefective ? "text-[#991B1B] font-semibold" : "text-[#166534] font-semibold"}>
                              {itemDefective ? defectsList : "Nominal Contour"}
                            </span>
                          </div>
                          {item.rootCauseSummary && (
                            <div className="text-[#57534E]">
                              <strong className="text-[#1C1917]">Probable Cause / Note: </strong>
                              {item.rootCauseSummary}
                            </div>
                          )}
                        </div>

                        {/* Button to Select this Image as Primary in Visual Tab */}
                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              onSelectIndex(idx);
                              setActiveTabOverride("visual");
                            }}
                            className="px-3 py-1.5 rounded-lg border border-[#DDD5C7] bg-[#FFFFFF] hover:bg-[#F3EFE6] text-[#1C1917] font-medium text-xs transition-colors cursor-pointer"
                          >
                            Open in Full Visual Inspector →
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Section: Batch Telemetry Summary Table */}
          <section className="space-y-3">
            <h3 className="text-sm font-bold text-[#1C1917] flex items-center gap-2">
              <span>Batch Telemetry Baseline Summary</span>
            </h3>
            <div className="border border-[#E5DFD3] rounded-2xl overflow-hidden bg-[#FFFFFF]">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#FAF8F5] border-b border-[#EAE4D7] text-[10px] font-bold text-[#78716A] uppercase tracking-wider">
                  <tr>
                    <th className="p-3">Sensor Parameter</th>
                    <th className="p-3 text-center">Nominal Target</th>
                    <th className="p-3 text-center">Corridor</th>
                    <th className="p-3 text-center">Recorded Value</th>
                    <th className="p-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAE4D7]">
                  {(activeItem.telemetry || []).map((t) => (
                    <tr
                      key={t.id}
                      className={t.isOutOfTolerance ? "bg-[#FEF2F2]" : "hover:bg-[#FAF8F5]"}
                    >
                      <td className="p-3 font-semibold text-[#1C1917]">{t.name}</td>
                      <td className="p-3 text-center font-mono text-[#57534E]">
                        {t.nominalTarget} {t.unit}
                      </td>
                      <td className="p-3 text-center font-mono text-[#78716A]">
                        {t.nominalMin} – {t.nominalMax} {t.unit}
                      </td>
                      <td
                        className={`p-3 text-center font-mono font-bold ${
                          t.isOutOfTolerance ? "text-[#991B1B]" : "text-[#1C1917]"
                        }`}
                      >
                        {t.recordedValue} {t.unit}
                      </td>
                      <td className="p-3 text-right">
                        <span
                          className={`font-semibold text-[11px] ${
                            t.isOutOfTolerance ? "text-[#991B1B]" : "text-[#166534]"
                          }`}
                        >
                          {t.isOutOfTolerance ? "Out of Tolerance" : "Nominal"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* =========================================================================
          TAB 2: VISUAL DIAGNOSTICS (IMAGE FORWARD)
      ========================================================================= */}
      {currentTab === "visual" && (
        <div className="space-y-3">
          <DefectSegmenter
            originalImage={originalImg}
            heatmapImage={heatmapImg}
            segmentationInstances={activeItem.segmentationInstances}
            defectType={
              predictedDefects.length > 0
                ? predictedDefects.join(", ")
                : activeItem.defectType || (isDefective ? "Localized Defect" : "Nominal Surface")
            }
            severity={activeItem.severity || (isDefective ? "Critical" : "Nominal")}
            confidence={activeItem.confidenceScore}
            stationName={activeItem.metadata?.stationId || "Automated Line • Station 04"}
            hotspots={activeItem.visionResults?.hotspots}
          />

          {/* Quick Context Strip beneath the Image */}
          <div className="p-3.5 rounded-xl border border-[#E5DFD3] bg-[#FFFFFF] flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
              <div className="flex items-center gap-2">
                <span className="font-bold text-[#1C1917]">
                  {isDefective ? "Defect:" : "Status:"}
                </span>
                <span
                  className={`font-semibold ${
                    isDefective ? "text-[#991B1B]" : "text-[#166534]"
                  }`}
                >
                  {isDefective
                    ? predictedDefects.length > 0
                      ? predictedDefects.join(", ")
                      : activeItem.defectType || "Surface anomaly detected"
                    : "No defects found"}
                </span>
                {isDefective && (
                  <span className="text-[#78716A] text-[11px] font-mono">
                    ({confidenceVal.toFixed(1)}% confidence)
                  </span>
                )}
              </div>

              <span className="hidden sm:inline text-[#DDD5C7]">•</span>

              <span className="text-[#57534E]">
                {isDefective
                  ? "Action: Quarantine this part — do not pass to assembly."
                  : "Action: Ready for assembly."}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTabOverride("report")}
                className="px-3 py-1.5 rounded-lg border border-[#DDD5C7] bg-[#FAF8F5] hover:bg-[#F3EFE6] text-[#1C1917] font-medium text-xs transition-colors cursor-pointer"
              >
                View Batch Report →
              </button>
              <button
                type="button"
                onClick={() => setActiveTabOverride("telemetry")}
                className="px-3 py-1.5 rounded-lg border border-[#DDD5C7] bg-[#FAF8F5] hover:bg-[#F3EFE6] text-[#57534E] hover:text-[#1C1917] text-xs transition-colors cursor-pointer"
              >
                Check Sensors →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: PROCESS TELEMETRY & HISTORICAL SPARKLINE TRENDS
      ========================================================================= */}
      {currentTab === "telemetry" && (
        <ProcessTelemetryDossier
          telemetry={activeItem.telemetry}
          rawTelemetry={rawTelemetryDict}
          rootCauseAnalysis={rootCauseAnalysisData}
          isDefective={isDefective}
        />
      )}

      {/* =========================================================================
          TAB 4: RAW DIAGNOSTIC JSON OUTPUT
      ========================================================================= */}
      {currentTab === "json" && rawJson && (
        <LinenJsonViewer
          data={rawJson}
          defaultExpanded={true}
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

export default LinenResults;
