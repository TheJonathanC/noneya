"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Scan,
  RotateCcw,
  Printer,
  Image as ImageIcon,
  Activity,
  Sliders,
  ChevronLeft,
  ChevronRight,
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
  // Navigation Tabs in the 75% workspace:
  // 'visual' (Image with overlays) | 'telemetry' (Sensors) | 'json' (Details)
  const [activeTab, setActiveTab] = useState<"visual" | "telemetry" | "json">("visual");

  const carouselRef = useRef<HTMLDivElement>(null);

  // Auto-scroll selected card into carousel view smoothly
  useEffect(() => {
    if (carouselRef.current && carouselRef.current.children[selectedIndex]) {
      const selectedCard = carouselRef.current.children[selectedIndex] as HTMLElement;
      selectedCard.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [selectedIndex]);

  const handleScrollCarousel = (direction: "left" | "right") => {
    if (carouselRef.current) {
      const scrollAmount = direction === "left" ? -240 : 240;
      carouselRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  // Loading State
  if (isLoading && !activeItem) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#FAF8F5] text-center space-y-4 min-h-[400px]">
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
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 bg-[#FAF8F5] text-center space-y-5 min-h-[400px]">
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
      <div className="flex-1 flex flex-col items-center justify-center p-8 sm:p-14 bg-[#FAF8F5] text-center space-y-6 min-h-[400px]">
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

  const effectiveStats = batchStats || {
    total: allItems.length,
    passed: passedItems.length,
    defective: defectiveItems.length,
  };

  const yieldPercentage =
    effectiveStats.total > 0
      ? Math.round((effectiveStats.passed / effectiveStats.total) * 100)
      : 100;

  // Filter out-of-tolerance telemetry parameters for quick reference
  const outOfToleranceSensors = (activeItem.telemetry || []).filter((t) => t.isOutOfTolerance);

  // Handler for Exporting Formatted Batch PDF (directly triggers print dialog)
  const handlePrintPdf = () => {
    openPrintableBatchReport({
      batchId: effectiveBatchId,
      gateDecision,
      supervisorSummary,
      batchPrediction,
      batchFixes,
      batchStats: effectiveStats,
      items: allItems,
      rawJson,
    });
  };

  // Primary Workspace Tabs for 75% pane
  const workspaceTabs = [
    {
      id: "visual" as const,
      label: "Image Inspector",
      icon: ImageIcon,
    },
    {
      id: "telemetry" as const,
      label: "Process Sensors",
      icon: Activity,
    },
    {
      id: "json" as const,
      label: "Raw Details",
      icon: Sliders,
    },
  ];

  return (
    <div className="flex-1 w-full flex flex-col lg:flex-row p-3 sm:p-5 lg:p-6 gap-4 sm:gap-5 lg:gap-6 bg-[#FAF8F5] min-h-0 items-start">
      {/* =========================================================================
          LEFT ~25% COLUMN: PERSISTENT BATCH GATE DECISION & EXECUTIVE REPORT
          Stays anchored and visible across all tabs (Image, Sensors, Details)
      ========================================================================= */}
      <aside
        aria-label="Batch Gate Decision & Executive Summary"
        className="w-full lg:w-[320px] xl:w-[360px] 2xl:w-[390px] shrink-0 space-y-3.5 lg:sticky lg:top-0"
      >
        {/* Card 1: Batch Gate Decision Banner */}
        <section
          className={`rounded-2xl border p-4 sm:p-5 space-y-3.5 shadow-xs transition-colors ${
            gateDecision === "CRITICAL STOP"
              ? "border-[#FCA5A5] bg-[#FFF5F5]"
              : gateDecision === "ADJUST"
              ? "border-[#FDE68A] bg-[#FFFDF5]"
              : "border-[#86EFAC] bg-[#F0FDF4]"
          }`}
        >
          {/* Header Row */}
          <div className="flex items-start justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <div
                className={`p-2 rounded-xl border shrink-0 ${
                  gateDecision === "CRITICAL STOP"
                    ? "bg-[#FEF2F2] border-[#FCA5A5] text-[#991B1B]"
                    : gateDecision === "ADJUST"
                    ? "bg-[#FEF3C7] border-[#FDE68A] text-[#92400E]"
                    : "bg-[#FFFFFF] border-[#86EFAC] text-[#166534]"
                }`}
              >
                {gateDecision === "GO" ? (
                  <CheckCircle2 className="w-5 h-5 text-[#16A34A]" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-[#DC2626]" />
                )}
              </div>
              <div>
                <span className="text-[10px] font-bold tracking-wider uppercase text-[#78716A]">
                  Batch Gate Decision
                </span>
                <h2 className="text-base font-extrabold text-[#1C1917] tracking-tight">
                  {gateDecision}
                </h2>
              </div>
            </div>

            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#FFFFFF] border border-[#DDD5C7] text-[#57534E] shrink-0">
              {effectiveBatchId}
            </span>
          </div>

          {/* Decision Subtext */}
          <p className="text-xs text-[#57534E] leading-relaxed">
            {gateDecision === "GO"
              ? "All component contours and sensor corridors verified nominal. Cleared for line release."
              : gateDecision === "ADJUST"
              ? "Process telemetry drift or surface defects detected. Recalibrate setpoints before continuing."
              : "Defect threshold exceeded. Automated line halted for engineer review."}
          </p>

          {/* Yield & Metric Stats */}
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#EAE4D7]/70">
            <div className="p-2.5 rounded-xl bg-[#FFFFFF] border border-[#EAE4D7] space-y-0.5">
              <div className="text-[10px] font-semibold text-[#78716A] uppercase tracking-wider">
                Batch Yield
              </div>
              <div className="font-mono text-sm font-bold text-[#1C1917]">
                {effectiveStats.passed} / {effectiveStats.total}
              </div>
              <div className="text-[10px] text-[#78716A]">
                {yieldPercentage}% Pass Rate
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-[#FFFFFF] border border-[#EAE4D7] space-y-0.5">
              <div className="text-[10px] font-semibold text-[#78716A] uppercase tracking-wider">
                Defect Count
              </div>
              <div className={`font-mono text-sm font-bold ${
                effectiveStats.defective > 0 ? "text-[#991B1B]" : "text-[#166534]"
              }`}>
                {effectiveStats.defective} Defective
              </div>
              <div className="text-[10px] text-[#78716A]">
                {effectiveStats.defective > 0 ? "Quarantine required" : "Zero defects"}
              </div>
            </div>
          </div>

          {/* Export PDF Button */}
          <button
            type="button"
            onClick={handlePrintPdf}
            className="w-full py-2.5 px-3 rounded-xl bg-[#1C1917] hover:bg-[#2C2724] text-[#FAF8F5] text-xs font-semibold flex items-center justify-center gap-2 transition-[background-color,transform] duration-150 active:scale-[0.98] cursor-pointer shadow-xs"
          >
            <Printer className="w-3.5 h-3.5 text-[#FAF8F5]" />
            <span>Export Batch PDF</span>
          </button>
        </section>

        {/* Card 2: Supervisor Briefing */}
        {supervisorSummary && (
          <section className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#E5DFD3] space-y-2 shadow-2xs text-xs">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-[#1C1917] flex items-center gap-1.5">
                <span>Supervisor Summary</span>
              </h3>
              {batchPrediction?.next_batch_risk !== undefined && (
                <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-[#FEF2F2] text-[#991B1B] border border-[#FCA5A5] font-semibold">
                  Risk: {Math.round(batchPrediction.next_batch_risk * 100)}%
                </span>
              )}
            </div>
            <p className="text-[#57534E] leading-relaxed">
              {supervisorSummary}
            </p>
          </section>
        )}

        {/* Card 3: Root Cause & Culprit Sensor */}
        {(rootCauseAnalysisData || anyDefectsInBatch) && (
          <section className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#E5DFD3] space-y-2 shadow-2xs text-xs">
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
                : "All thermal and mechanical telemetry recorded within nominal bounds."}
            </p>
            {Boolean(rootCauseAnalysisData?.primary_culprit_sensor) && (
              <div className="inline-block text-[11px] font-mono px-2 py-0.5 rounded-md bg-[#FEF2F2] border border-[#FCA5A5] text-[#991B1B] font-bold">
                Culprit: {String(rootCauseAnalysisData?.primary_culprit_sensor).toUpperCase()}
              </div>
            )}
          </section>
        )}

        {/* Card 4: Will Problem Continue? (Trend Prediction) */}
        {batchPrediction?.text && (
          <section className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#E5DFD3] space-y-2 shadow-2xs text-xs">
            <div className="font-bold text-[#1C1917] flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-[#1C1917]" />
              <span>Will Problem Continue?</span>
            </div>
            <p className="text-[#57534E] leading-relaxed">
              {batchPrediction.text}
            </p>
            {batchPrediction?.next_batch_risk !== undefined && (
              <div className="text-[11px] font-semibold text-[#78350F] pt-0.5">
                Calculated Recurrence Risk: {Math.round(batchPrediction.next_batch_risk * 100)}%
              </div>
            )}
          </section>
        )}

        {/* Card 5: Recommended Machine Setpoint Fixes */}
        {batchFixes.length > 0 && (
          <section className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#FDE68A] space-y-2 shadow-2xs text-xs">
            <div className="font-bold text-[#92400E] flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-[#D97706]" />
              <span>Machine Setpoint Fixes ({batchFixes.length})</span>
            </div>
            <div className="space-y-1.5">
              {batchFixes.map((fix, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg bg-[#FFFDF5] border border-[#FDE68A] space-y-1"
                >
                  <div className="flex items-center gap-1.5 font-medium text-[#1C1917]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#D97706] shrink-0" />
                    <span>{fix.instruction}</span>
                  </div>
                  {fix.current !== undefined && fix.target !== undefined && (
                    <div className="font-mono text-[11px] text-[#78716A] pl-3">
                      {fix.current} → <span className="font-bold text-[#1C1917]">{fix.target} {fix.unit || ""}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Card 6: Out-of-Tolerance Sensor Parameters Notice */}
        {outOfToleranceSensors.length > 0 && (
          <section className="p-3.5 rounded-2xl bg-[#FFFFFF] border border-[#E5DFD3] space-y-2 shadow-2xs text-xs">
            <div className="font-bold text-[#991B1B] flex items-center justify-between">
              <span>Drift Alert ({outOfToleranceSensors.length} Sensors)</span>
            </div>
            <div className="space-y-1">
              {outOfToleranceSensors.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-1.5 rounded-lg bg-[#FEF2F2] text-[11px]"
                >
                  <span className="font-medium text-[#1C1917]">{s.name}</span>
                  <span className="font-mono font-bold text-[#991B1B]">
                    {s.recordedValue} {s.unit}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </aside>

      {/* =========================================================================
          RIGHT ~75% COLUMN: CAROUSEL, VISUAL OVERLAY INSPECTION, SENSORS & DETAILS
      ========================================================================= */}
      <main className="flex-1 min-w-0 w-full space-y-4">
        {/* Top Control Bar: Status Indicator + Workspace Tabs */}
        <div className="bg-[#FFFFFF] border border-[#E5DFD3] rounded-2xl p-3 sm:p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-3">
          {/* Left: Solid Status Indicator (No Flashing) */}
          <div className="flex items-center gap-3">
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

            <span className="text-xs text-[#78716A]">
              Batch of {allItems.length} {allItems.length === 1 ? "Image" : "Images"}
            </span>

            {isBatchProcessing && (
              <div className="px-2.5 py-1 text-xs font-medium text-[#92400E] bg-[#FFFBEB] border border-[#FDE68A] rounded-xl flex items-center gap-1.5">
                <DotsLoader size="sm" shape="loader" className="w-3.5 h-3.5" />
                <span>Analyzing all components…</span>
              </div>
            )}
          </div>

          {/* Right: Workspace Tabs */}
          <div className="flex items-center gap-1 bg-[#FAF8F5] p-1 rounded-xl border border-[#E5DFD3]">
            {workspaceTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
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

        {/* =========================================================================
            BATCH IMAGES CAROUSEL (SCROLLABLE / TOGGLEABLE FOR EACH PART)
            Shows thumbnail, defect badge, confidence, and active selection ring
        ========================================================================= */}
        {allItems.length > 0 && (
          <section
            aria-label="Batch Image Carousel"
            className="bg-[#FFFFFF] border border-[#E5DFD3] rounded-2xl p-3 sm:p-4 shadow-xs space-y-2.5"
          >
            {/* Carousel Header with Navigation Controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#78716A]">
                  Batch Images ({allItems.length})
                </h3>
                <span className="text-xs font-semibold text-[#1C1917]">
                  • Active: Image {selectedIndex + 1}
                </span>
              </div>

              {allItems.length > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleScrollCarousel("left")}
                    aria-label="Scroll images left"
                    className="p-1 rounded-lg border border-[#E5DFD3] bg-[#FAF8F5] hover:bg-[#F3EFE6] text-[#57534E] transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleScrollCarousel("right")}
                    aria-label="Scroll images right"
                    className="p-1 rounded-lg border border-[#E5DFD3] bg-[#FAF8F5] hover:bg-[#F3EFE6] text-[#57534E] transition-colors cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Scrollable Track */}
            <div
              ref={carouselRef}
              className="flex items-center gap-3 overflow-x-auto pb-1.5 pt-0.5 scrollbar-thin scroll-smooth"
            >
              {allItems.map((item, idx) => {
                const itemDefective = item.status === "DEFECTIVE";
                const isSelected = selectedIndex === idx;

                const itemImg =
                  item.visionResults?.original_image_base64 ||
                  item.visionResults?.original_url ||
                  item.rawImageUrl;

                const defectLabel =
                  item.predictedDefects && item.predictedDefects.length > 0
                    ? item.predictedDefects[0]
                    : item.defectType || (itemDefective ? "Defect" : "Nominal");

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onSelectIndex(idx);
                    }}
                    className={`min-w-[190px] sm:min-w-[210px] max-w-[220px] shrink-0 p-2.5 rounded-xl border transition-all text-left cursor-pointer group ${
                      isSelected
                        ? "ring-2 ring-[#1C1917] border-[#1C1917] bg-[#FFFFFF] shadow-sm"
                        : "border-[#E5DFD3] bg-[#FAF8F5] hover:bg-[#FFFFFF] hover:border-[#DDD5C7]"
                    }`}
                  >
                    {/* Thumbnail Container */}
                    <div className="aspect-16/10 rounded-lg bg-[#1C1917] overflow-hidden relative mb-2 flex items-center justify-center border border-[#EAE4D7]">
                      {itemImg ? (
                        <img
                          src={itemImg}
                          alt={`Thumbnail Image ${idx + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                      ) : (
                        <span className="text-[10px] text-[#A8A29E]">No Preview</span>
                      )}

                      {/* Small Status Badge Overlay */}
                      <div className="absolute top-1.5 right-1.5">
                        <span
                          className={`w-2.5 h-2.5 rounded-full block border border-white shadow-2xs ${
                            itemDefective ? "bg-[#EF4444]" : "bg-[#22C55E]"
                          }`}
                        />
                      </div>

                      {/* Pill indicating Image number */}
                      <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-[#1C1917]/80 backdrop-blur-xs text-[10px] font-mono text-[#FAF8F5]">
                        Img {idx + 1}
                      </div>
                    </div>

                    {/* Metadata */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-xs text-[#1C1917] truncate">
                          Image {idx + 1}
                        </span>
                        <span className="text-[10px] font-mono text-[#78716A]">
                          {Math.round(item.confidenceScore)}%
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`text-[11px] font-semibold truncate ${
                            itemDefective ? "text-[#991B1B]" : "text-[#166534]"
                          }`}
                        >
                          {itemDefective ? defectLabel : "Pass • Nominal"}
                        </span>

                        {isSelected && (
                          <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-[#1C1917] text-[#FAF8F5]">
                            Active
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* =========================================================================
            WORKSPACE CONTENT: BASED ON ACTIVE TAB
        ========================================================================= */}

        {/* TAB 1: VISUAL INSPECTOR (DEFAULT) - Shows DefectSegmenter with all overlays */}
        {activeTab === "visual" && (
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

            {/* Quick Context Strip beneath the Image Inspector */}
            <div className="p-3.5 rounded-xl border border-[#E5DFD3] bg-[#FFFFFF] flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#1C1917]">
                    {isDefective ? "Defect Detected:" : "Inspection Status:"}
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
                      : "Nominal Contour • Ready"}
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
                    ? "Action: Quarantine component — do not release downstream."
                    : "Action: Component cleared for downstream line release."}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("telemetry")}
                  className="px-3 py-1.5 rounded-lg border border-[#DDD5C7] bg-[#FAF8F5] hover:bg-[#F3EFE6] text-[#1C1917] font-medium text-xs transition-colors cursor-pointer"
                >
                  Inspect Sensors →
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("json")}
                  className="px-3 py-1.5 rounded-lg border border-[#DDD5C7] bg-[#FAF8F5] hover:bg-[#F3EFE6] text-[#57534E] hover:text-[#1C1917] text-xs transition-colors cursor-pointer"
                >
                  Raw Details →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PROCESS TELEMETRY & HISTORICAL TRENDS */}
        {activeTab === "telemetry" && (
          <ProcessTelemetryDossier
            telemetry={activeItem.telemetry}
            rawTelemetry={rawTelemetryDict}
            rootCauseAnalysis={rootCauseAnalysisData}
            isDefective={isDefective}
          />
        )}

        {/* TAB 3: RAW DIAGNOSTIC JSON OUTPUT */}
        {activeTab === "json" && rawJson && (
          <LinenJsonViewer
            data={rawJson}
            defaultExpanded={true}
            title={
              isDefective
                ? "Integrated Diagnostic Payload"
                : "Classification Payload"
            }
          />
        )}
      </main>
    </div>
  );
}

export default LinenResults;
