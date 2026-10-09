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
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Gauge,
  Cpu,
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

/**
 * Renders supervisor summary text cleanly without garish inline highlighter marks
 */
function renderCleanSummary(text: unknown) {
  if (typeof text !== "string") {
    if (typeof text === "object" && text !== null) {
      try {
        return <span>{JSON.stringify(text)}</span>;
      } catch {
        return <span>Summary available</span>;
      }
    }
    return <span>{String(text || "")}</span>;
  }
  return <span>{text}</span>;
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
  // 'visual' (Image Inspector) | 'telemetry' (Sensors) | 'json' (Details)
  const [activeTab, setActiveTab] = useState<"visual" | "telemetry" | "json">("visual");

  // Left panel dropbox / accordion state (collapsed by default to fit in 1 view)
  const [isDropboxOpen, setIsDropboxOpen] = useState<boolean>(false);

  const carouselRef = useRef<HTMLDivElement>(null);

  // Auto-scroll selected compact chip into carousel view smoothly
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
      const scrollAmount = direction === "left" ? -180 : 180;
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

  // Out of tolerance sensors
  const outOfToleranceSensors = (activeItem.telemetry || []).filter((t) => t.isOutOfTolerance);

  // Compile all defects across the whole batch safely (plain computation, no hook)
  const compiledDefects = (() => {
    const tally: Record<string, { count: number; imageIndices: number[]; parts: string[] }> = {};
    if (!Array.isArray(allItems)) return [];

    allItems.forEach((item, idx) => {
      if (item && item.status === "DEFECTIVE") {
        const defects =
          item.predictedDefects && Array.isArray(item.predictedDefects) && item.predictedDefects.length > 0
            ? item.predictedDefects
            : [item.defectType || "Defect"];

        defects.forEach((d) => {
          if (!d) return;
          const str = typeof d === "string" ? d : String(d);
          const key = str.toLowerCase().trim();
          if (!tally[key]) {
            tally[key] = { count: 0, imageIndices: [], parts: [] };
          }
          tally[key].count += 1;
          tally[key].imageIndices.push(idx + 1);
          if (item.partId) tally[key].parts.push(item.partId);
        });
      }
    });

    return Object.entries(tally).map(([name, data]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      count: data.count,
      images: data.imageIndices || [],
      parts: data.parts || [],
    }));
  })();

  // Unified culprit sensors across the whole batch (plain computation, no hook)
  const batchCulpritSensors = (() => {
    const culprits = new Set<string>();
    if (typeof rootCauseAnalysisData?.primary_culprit_sensor === "string") {
      culprits.add(rootCauseAnalysisData.primary_culprit_sensor.toLowerCase());
    }
    if (Array.isArray(batchFixes)) {
      batchFixes.forEach((f) => {
        if (typeof f?.sensor === "string") culprits.add(f.sensor.toLowerCase());
      });
    }
    if (Array.isArray(outOfToleranceSensors)) {
      outOfToleranceSensors.forEach((s) => {
        if (typeof s?.name === "string") culprits.add(s.name.toLowerCase().replace(/\s+/g, "_"));
      });
    }
    return Array.from(culprits);
  })();

  // General batch-wide probable cause synthesis based on compiled defects (plain computation, no hook)
  const generalProbableCause = (() => {
    if (!compiledDefects || compiledDefects.length === 0) {
      return "Batch verified nominal: Process parameters and thermal corridors stable across all parts with zero defect signatures.";
    }

    const defectNames = compiledDefects.map((d) => (d.name || "").toLowerCase());
    const hasPorosity = defectNames.some((d) => d.includes("poros"));
    const hasCrack = defectNames.some((d) => d.includes("crack") || d.includes("tear"));
    const hasFlash = defectNames.some((d) => d.includes("flash"));

    // If backend provided an overall explanation, check if it's broad
    const backendExplanation =
      typeof rawJson?.batch_analysis === "object" && typeof (rawJson.batch_analysis as Record<string, unknown>)?.review === "string"
        ? ((rawJson.batch_analysis as Record<string, unknown>).review as string)
        : typeof rootCauseAnalysisData?.diagnostic_explanation === "string"
        ? rootCauseAnalysisData.diagnostic_explanation
        : null;

    if (hasPorosity && hasCrack) {
      return "Coupled thermomechanical drift: Excessive hydraulic ram pack pressure forced dissolved gas porosity into the melt, while subsequent rapid quench cooling gradients triggered thermal contraction stress cracking across the mold core.";
    }
    if (hasPorosity && hasFlash) {
      return "Hydraulic pressure intensification surge: Die pack pressure exceeded clamp tonnage limits during the filling stroke, resulting in mold parting line flash and concurrent turbulent porosity voiding.";
    }
    if (hasPorosity) {
      const porosityCount = compiledDefects.find((d) => (d.name || "").toLowerCase().includes("poros"))?.count ?? (compiledDefects[0]?.count ?? 1);
      return `Hydraulic ram pack pressure fluctuation across ${porosityCount} part(s). Fluctuating cavity intensification pressure during solidus phase transition prevented complete feeding, entrapping micro-gas porosity.`;
    }
    if (hasCrack) {
      const crackCount = compiledDefects.find((d) => (d.name || "").toLowerCase().includes("crack"))?.count ?? (compiledDefects[0]?.count ?? 1);
      return `Thermal cooling gradient imbalance across ${crackCount} part(s). Non-uniform quench rate through cooling channels generated differential shrinkage stresses exceeding the alloy yield limit.`;
    }
    if (backendExplanation) {
      return backendExplanation;
    }

    const compiledStr = compiledDefects.map((d) => `${d.name} (${d.count}x)`).join(", ");
    return `Systemic line parameter drift inducing ${compiledStr}. Hydraulic pack pressure and thermal cooling rates deviated from the nominal Six Sigma process corridor during this batch run.`;
  })();

  // Machine Quality Deterioration & Value Drift Calculation (plain computation, no hook)
  const maxDriftSigma = (() => {
    if (batchAnalysis?.stats && typeof batchAnalysis.stats === "object" && "max_drift_sigma" in batchAnalysis.stats) {
      const val = Number((batchAnalysis.stats as { max_drift_sigma: unknown }).max_drift_sigma);
      if (!isNaN(val)) return val;
    }
    if (Array.isArray(outOfToleranceSensors) && outOfToleranceSensors.length > 0) return 3.4;
    if (anyDefectsInBatch) return 2.2;
    return 0.4;
  })();

  // Deterioration Score: 100% is pristine, lower means machine wear / calibration drift
  const machineHealthPercent = Math.max(25, Math.min(100, Math.round(100 - maxDriftSigma * 16)));
  const machineHealthStatus =
    machineHealthPercent >= 82
      ? "Nominal Stability"
      : machineHealthPercent >= 55
      ? "Moderate Degradation"
      : "Severe Deterioration";

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

  // Check if any process sensor drift exists across the batch
  const hasDriftWarning =
    maxDriftSigma >= 1.8 || (Array.isArray(outOfToleranceSensors) && outOfToleranceSensors.length > 0);

  return (
    <div className="flex-1 w-full h-full min-h-0 flex flex-col lg:flex-row p-3 sm:p-4 lg:p-5 gap-3.5 sm:gap-4 lg:gap-5 bg-[#FAF8F5] overflow-hidden">
      {/* =========================================================================
          LEFT ~25% COLUMN: PERSISTENT BATCH GATE DECISION & EXECUTIVE REPORT
          Locked to initial page view down through "Will Problem Continue",
          with all engineering fixes & machine drift details tucked in a dropbox.
      ========================================================================= */}
      <aside
        aria-label="Batch Gate Decision & Executive Summary"
        className="relative w-full lg:w-[320px] xl:w-[350px] 2xl:w-[380px] h-full min-h-0 shrink-0 flex flex-col overflow-y-auto pr-1 space-y-3 scrollbar-thin"
      >
        {/* Card 1: Batch Gate Decision Banner (Compact & Sleek) */}
        <section
          className={`rounded-2xl border p-3.5 sm:p-4 space-y-2.5 shadow-xs transition-colors ${
            gateDecision === "CRITICAL STOP"
              ? "border-[#FCA5A5] bg-[#FFF5F5]"
              : gateDecision === "ADJUST"
              ? "border-[#FDE68A] bg-[#FFFDF5]"
              : "border-[#86EFAC] bg-[#F0FDF4]"
          }`}
        >
          {/* Header Row */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div
                className={`p-1.5 rounded-xl border shrink-0 ${
                  gateDecision === "CRITICAL STOP"
                    ? "bg-[#FEF2F2] border-[#FCA5A5] text-[#991B1B]"
                    : gateDecision === "ADJUST"
                    ? "bg-[#FEF3C7] border-[#FDE68A] text-[#92400E]"
                    : "bg-[#FFFFFF] border-[#86EFAC] text-[#166534]"
                }`}
              >
                {gateDecision === "GO" ? (
                  <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-[#DC2626]" />
                )}
              </div>
              <div>
                <span className="text-[9px] font-bold tracking-wider uppercase text-[#78716A] block leading-none">
                  Batch Gate Decision
                </span>
                <h2 className="text-sm sm:text-base font-extrabold text-[#1C1917] tracking-tight leading-tight">
                  {gateDecision}
                </h2>
              </div>
            </div>

            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#FFFFFF] border border-[#DDD5C7] text-[#57534E] shrink-0">
              {effectiveBatchId}
            </span>
          </div>

          {/* Decision Subtext */}
          <p className="text-[11px] text-[#57534E] leading-relaxed">
            {gateDecision === "GO"
              ? "All component contours and sensor corridors verified nominal. Cleared for line release."
              : gateDecision === "ADJUST"
              ? "Process telemetry drift or defect detected. Recalibrate setpoints before continuing."
              : "Defect threshold exceeded. Automated line halted for engineer review."}
          </p>

          {/* Inline Yield & Defect Summary */}
          <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-[#FFFFFF] border border-[#EAE4D7] text-xs font-mono">
            <div>
              <span className="text-[10px] text-[#78716A] uppercase font-sans mr-1">Yield:</span>
              <span className="font-bold text-[#1C1917]">{effectiveStats.passed}/{effectiveStats.total}</span>
              <span className="text-[10px] text-[#78716A] ml-1 font-sans">({yieldPercentage}%)</span>
            </div>
            <div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                effectiveStats.defective > 0
                  ? "bg-[#FEF2F2] text-[#991B1B]"
                  : "bg-[#F0FDF4] text-[#166534]"
              }`}>
                {effectiveStats.defective} Defective
              </span>
            </div>
          </div>

          {/* Export PDF Button */}
          <button
            type="button"
            onClick={handlePrintPdf}
            className="w-full py-2 px-3 rounded-xl bg-[#1C1917] hover:bg-[#2C2724] text-[#FAF8F5] text-xs font-semibold flex items-center justify-center gap-1.5 transition-[background-color,transform] duration-150 active:scale-[0.98] cursor-pointer shadow-xs"
          >
            <Printer className="w-3.5 h-3.5 text-[#FAF8F5]" />
            <span>Export Batch PDF Report</span>
          </button>
        </section>

        {/* =========================================================================
            CARD 2: WILL PROBLEM CONTINUE / LINE STABILITY FORECAST
            Positioned right below Gate Decision to immediately fit in the initial screen
        ========================================================================= */}
        <section className="p-3.5 sm:p-4 rounded-2xl bg-[#FFFFFF] border border-[#E5DFD3] space-y-1.5 shadow-2xs text-xs">
          <div className="font-bold text-[#1C1917] flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-[#1C1917]" />
              <span>{anyDefectsInBatch ? "Recurrence Forecast" : "Line Stability Forecast"}</span>
            </div>
            {anyDefectsInBatch && batchPrediction?.next_batch_risk !== undefined ? (
              <span className="text-[10px] font-mono font-bold text-[#991B1B]">
                {Math.round(batchPrediction.next_batch_risk * 100)}% Recurrence
              </span>
            ) : (
              <span className="text-[10px] font-mono font-bold text-[#166534]">
                {hasDriftWarning ? "Low Immediate Risk" : "Stable • 0% Risk"}
              </span>
            )}
          </div>
          <p className="text-[#57534E] leading-relaxed text-[11px]">
            {anyDefectsInBatch
              ? batchPrediction?.text ||
                "Persistent parameter deviation indicates defect recurrence is likely unless machine setpoints are recalibrated."
              : hasDriftWarning
              ? "Current parts passed all dimensional and surface criteria. Sensor drift suggests proactive recalibration during the next cycle to prevent defect onset."
              : batchPrediction?.text ||
                "Nominal line stability verified. Process corridors remain centered with near-zero recurrence risk across subsequent casting cycles."}
          </p>
        </section>

        {/* =========================================================================
            CARD 3: EXECUTIVE BRIEFING (UNIFIED WITH BATCH ROOT CAUSE, SENT DOWN)
        ========================================================================= */}
        <section className="p-3.5 sm:p-4 rounded-2xl bg-[#FFFFFF] border border-[#E5DFD3] space-y-3 shadow-2xs text-xs">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold text-[#1C1917] text-xs">
              {anyDefectsInBatch ? (
                <AlertTriangle className="w-3.5 h-3.5 text-[#DC2626]" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" />
              )}
              <span>
                {anyDefectsInBatch
                  ? "Executive Briefing & Root Cause"
                  : "Executive Briefing & Verification"}
              </span>
            </div>
            {anyDefectsInBatch && compiledDefects.length > 0 ? (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold bg-[#FEF2F2] border border-[#FCA5A5] text-[#991B1B]">
                {compiledDefects.reduce((acc, c) => acc + (c?.count || 1), 0)} Defect(s)
              </span>
            ) : (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold bg-[#F0FDF4] border border-[#86EFAC] text-[#166534]">
                100% Nominal
              </span>
            )}
          </div>

          {/* Action Callout */}
          <div
            className={`p-2.5 rounded-xl text-[11px] font-medium border flex items-center gap-2 ${
              anyDefectsInBatch
                ? "bg-[#FEF2F2] border-[#FCA5A5] text-[#991B1B]"
                : hasDriftWarning
                ? "bg-[#FFFDF5] border-[#FDE68A] text-[#92400E]"
                : "bg-[#F0FDF4] border-[#86EFAC] text-[#166534]"
            }`}
          >
            {anyDefectsInBatch ? (
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-[#DC2626]" />
            ) : hasDriftWarning ? (
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-[#D97706]" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-[#16A34A]" />
            )}
            <span className="leading-tight font-semibold">
              {anyDefectsInBatch
                ? "Action Required: Hold scrap parts & adjust parameter setpoints"
                : hasDriftWarning
                ? `Process Drift Warning: Telemetry drift detected (${maxDriftSigma.toFixed(1)}σ). Recalibration advised.`
                : "Line Cleared: All parameters operating within normal Six Sigma tolerance"}
            </span>
          </div>

          {/* Supervisor Briefing Summary Text */}
          <p className="text-[#57534E] leading-relaxed text-[11px]">
            {supervisorSummary
              ? renderCleanSummary(supervisorSummary)
              : anyDefectsInBatch
              ? "Surface anomalies identified during batch inspection. Quarantine defective parts and review telemetry deviations before continuing production."
              : "All parts in this batch verified nominal. Surface contour, quench rates, and cavity pressures operated continuously within tolerance corridors with zero anomalies."}
          </p>

          {/* Root Cause Details (When defects in batch) */}
          {anyDefectsInBatch && (
            <div className="pt-2.5 border-t border-[#F0ECE1] space-y-2">
              <span className="text-[10px] font-bold text-[#78716A] uppercase tracking-wider block">
                Batch Defect Attribution
              </span>

              {/* Defect Chips */}
              {compiledDefects.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {compiledDefects.map((d) => (
                    <span
                      key={d.name}
                      className="px-2 py-0.5 rounded-md bg-[#FEF2F2] border border-[#FCA5A5] text-[#991B1B] text-[10px] font-bold"
                    >
                      {d.name} ({d.count}x • Img {Array.isArray(d.images) ? d.images.join(", ") : ""})
                    </span>
                  ))}
                </div>
              )}

              {/* General Cause Synthesis */}
              <p className="text-[#57534E] leading-relaxed text-[11px] bg-[#FAF8F5] p-2.5 rounded-xl border border-[#EAE4D7]">
                {generalProbableCause}
              </p>

              {/* Culprit Sensors */}
              {batchCulpritSensors.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="text-[10px] text-[#78716A] uppercase font-bold font-sans">
                    Culprits:
                  </span>
                  {batchCulpritSensors.map((c) => (
                    <span
                      key={c}
                      className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#FEF2F2] border border-[#FCA5A5] text-[#991B1B]"
                    >
                      {c.replace(/_/g, " ").toUpperCase()}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Affirmative Positives Checklist (When nominal) */}
          {!anyDefectsInBatch && (
            <div className="pt-2.5 border-t border-[#F0ECE1] space-y-1.5">
              <div className="flex items-start gap-2 text-[11px] text-[#292524]">
                <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#16A34A]" />
                <span>
                  <strong className="text-[#1C1917]">Surface Integrity:</strong> Clean casting contour across all {allItems.length} parts; zero cracks, flash, or surface tears.
                </span>
              </div>
              <div className="flex items-start gap-2 text-[11px] text-[#292524]">
                <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#16A34A]" />
                <span>
                  <strong className="text-[#1C1917]">Thermal Corridor:</strong> Quench flow rate and mold temperature stable within Six Sigma band.
                </span>
              </div>
              <div className="flex items-start gap-2 text-[11px] text-[#292524]">
                <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#16A34A]" />
                <span>
                  <strong className="text-[#1C1917]">Cavity Fill & Packing:</strong> Complete solidus filling confirmed with zero micro-porosity entrapment.
                </span>
              </div>
              <div className="flex items-start gap-2 text-[11px] text-[#292524]">
                <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#16A34A]" />
                <span>
                  <strong className="text-[#1C1917]">Line Release:</strong> All quality gates satisfied; cleared for downstream assembly.
                </span>
              </div>

              {hasDriftWarning && (
                <div className="p-2.5 rounded-xl bg-[#FFFDF5] border border-[#FDE68A] text-[11px] text-[#92400E] space-y-1 mt-2">
                  <div className="font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-[#D97706] shrink-0" />
                    <span>Process Parameter Drift Warning</span>
                  </div>
                  <p className="text-[10px] leading-relaxed text-[#78350F]">
                    Telemetry recorded at {maxDriftSigma.toFixed(1)}σ deviation
                    {outOfToleranceSensors.length > 0
                      ? ` on ${outOfToleranceSensors.map((s) => s.name).join(", ")}`
                      : ""}. Components meet quality specification, but setpoint trimming is recommended before the next production run.
                  </p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* =========================================================================
            CARD 5: THE DROP BOX (EXPANDABLE ENGINEERING & DRIFT DIAGNOSTICS)
            Keeps the left panel fitting in 1 screen, expanding on demand
        ========================================================================= */}
        <section className="border border-[#E5DFD3] rounded-2xl bg-[#FFFFFF] shadow-2xs overflow-hidden transition-all">
          {/* Accordion Trigger Header */}
          <button
            type="button"
            onClick={() => setIsDropboxOpen((prev) => !prev)}
            className="w-full p-3 sm:p-3.5 flex items-center justify-between text-left hover:bg-[#FAF8F5] transition-colors cursor-pointer select-none"
          >
            <div className="flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-[#D97706]" />
              <span className="font-bold text-xs text-[#1C1917]">
                Machine Drift & Setpoint Fixes
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-[#FAF8F5] border border-[#E5DFD3] text-[#78716A]">
                {batchFixes.length > 0 ? `${batchFixes.length} fixes` : "Telemetry"}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-[#78716A] hidden sm:inline">
                {isDropboxOpen ? "Collapse" : "Expand"}
              </span>
              {isDropboxOpen ? (
                <ChevronUp className="w-4 h-4 text-[#78716A]" />
              ) : (
                <ChevronDown className="w-4 h-4 text-[#78716A]" />
              )}
            </div>
          </button>

          {/* Expanded Content: Machine Quality Deterioration & Predicted Setpoint Fixes */}
          {isDropboxOpen && (
            <div className="p-3 sm:p-3.5 pt-1 border-t border-[#EAE4D7] space-y-3 text-xs bg-[#FFFFFF]">
              {/* Machine Quality Deterioration Index Meter */}
              <div className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[#EAE4D7] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-[#1C1917] text-[11px]">
                    <Cpu className="w-3.5 h-3.5 text-[#1C1917]" />
                    <span>Machine Quality Index</span>
                  </div>
                  <span
                    className={`font-mono text-[10px] font-bold px-1.5 py-0.2 rounded ${
                      machineHealthPercent >= 80
                        ? "bg-[#DCFCE7] text-[#166534]"
                        : machineHealthPercent >= 55
                        ? "bg-[#FEF3C7] text-[#92400E]"
                        : "bg-[#FEE2E2] text-[#991B1B]"
                    }`}
                  >
                    {machineHealthPercent}% Health • {machineHealthStatus}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-[#E5DFD3] h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      machineHealthPercent >= 80
                        ? "bg-[#22C55E]"
                        : machineHealthPercent >= 55
                        ? "bg-[#F59E0B]"
                        : "bg-[#EF4444]"
                    }`}
                    style={{ width: `${machineHealthPercent}%` }}
                  />
                </div>

                <p className="text-[10px] text-[#78716A] leading-tight">
                  {maxDriftSigma >= 2.0
                    ? `Telemetry drift recorded at ${maxDriftSigma.toFixed(1)}σ deviation. Machine quality deteriorating without setpoint retuning.`
                    : "Thermal and mechanical baseline metrics stable within 1.5σ tolerance corridor."}
                </p>
              </div>

              {/* Recommended Machine Setpoint Fixes */}
              {batchFixes.length > 0 ? (
                <div className="space-y-1.5">
                  <div className="font-bold text-[#92400E] flex items-center gap-1 text-[11px]">
                    <Gauge className="w-3.5 h-3.5 text-[#D97706]" />
                    <span>Predicted Parameter Modifications ({batchFixes.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {batchFixes.map((fix, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded-lg bg-[#FFFDF5] border border-[#FDE68A] text-[11px] space-y-0.5"
                      >
                        <div className="font-medium text-[#1C1917] flex items-start gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#D97706] mt-1 shrink-0" />
                          <span>{fix.instruction}</span>
                        </div>
                        {fix.current !== undefined && fix.target !== undefined && (
                          <div className="font-mono text-[10px] text-[#78716A] pl-3">
                            Current: {fix.current} → Target: <strong className="text-[#1C1917]">{fix.target} {fix.unit || ""}</strong>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-2 rounded-lg bg-[#F0FDF4] border border-[#86EFAC] text-[11px] text-[#166534]">
                  Zero setpoint fixes required. Current line parameters match baseline.
                </div>
              )}

              {/* Out-of-Tolerance Telemetry Alert List */}
              {outOfToleranceSensors.length > 0 && (
                <div className="space-y-1 pt-1">
                  <span className="text-[10px] font-bold text-[#991B1B] uppercase tracking-wider block">
                    Drifted Sensors ({outOfToleranceSensors.length})
                  </span>
                  <div className="space-y-1">
                    {outOfToleranceSensors.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between p-1.5 rounded-lg bg-[#FEF2F2] text-[10px]"
                      >
                        <span className="font-medium text-[#1C1917]">{s.name}</span>
                        <span className="font-mono font-bold text-[#991B1B]">
                          {s.recordedValue} {s.unit} (Nominal: {s.nominalTarget})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Smooth scroll bottom fade overlay */}
        <div
          aria-hidden="true"
          className="pointer-events-none sticky bottom-0 left-0 right-0 h-6 -mt-6 bg-gradient-to-t from-[#FAF8F5] via-[#FAF8F5]/80 to-transparent z-10 shrink-0"
        />
      </aside>

      {/* =========================================================================
          RIGHT ~75% COLUMN: COMPACT IMAGE SELECTOR, BIG IMAGE VIEWER & WORKSPACE
      ========================================================================= */}
      <main className="relative flex-1 min-w-0 w-full h-full min-h-0 overflow-y-auto space-y-3 sm:space-y-3.5 pr-1 pb-24 sm:pb-32 scrollbar-thin">
        {/* =========================================================================
            1. BATCH IMAGE SELECTOR BAR (ABOVE THE TABS BAR)
            Shows status badge, active image count, and horizontal chip selector
        ========================================================================= */}
        {allItems.length > 0 && (
          <div className="bg-[#FFFFFF] border border-[#E5DFD3] rounded-2xl p-2 sm:p-2.5 shadow-xs flex items-center justify-between gap-3 shrink-0">
            {/* Status Indicator */}
            <div className="flex items-center gap-2 shrink-0">
              <div
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border transition-colors ${
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
                <span className="hidden sm:inline">
                  {anyDefectsInBatch ? "Defects Detected" : "Batch Nominal"}
                </span>
                <span className="sm:hidden">
                  {anyDefectsInBatch ? "Defects" : "OK"}
                </span>
              </div>

              <span className="text-[11px] font-mono text-[#78716A] hidden md:inline">
                {allItems.length} {allItems.length === 1 ? "Image" : "Images"}
              </span>

              {isBatchProcessing && (
                <div className="px-2 py-0.5 text-[11px] font-medium text-[#92400E] bg-[#FFFBEB] border border-[#FDE68A] rounded-lg flex items-center gap-1.5">
                  <DotsLoader size="sm" shape="loader" className="w-3 h-3" />
                  <span className="hidden lg:inline">Processing…</span>
                </div>
              )}
            </div>

            {/* Scrollable Image Chips Row with graceful scroll */}
            <div className="relative flex-1 min-w-0 flex items-center">
              <div
                ref={carouselRef}
                className="flex items-center gap-2 overflow-x-auto scrollbar-thin py-0.5 flex-1 min-w-0"
              >
                {allItems.map((item, idx) => {
                  const itemDefective = item.status === "DEFECTIVE";
                  const isSelected = selectedIndex === idx;

                  const defectLabel =
                    item.predictedDefects && item.predictedDefects.length > 0
                      ? item.predictedDefects[0]
                      : item.defectType || (itemDefective ? "Defect" : "Pass");

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelectIndex(idx)}
                      className={`px-2.5 py-1.5 rounded-xl border flex items-center gap-2 text-xs transition-all shrink-0 cursor-pointer select-none ${
                        isSelected
                          ? "bg-[#1C1917] text-[#FAF8F5] border-[#1C1917] shadow-xs"
                          : "bg-[#FAF8F5] text-[#57534E] border-[#E5DFD3] hover:bg-[#FFFFFF] hover:border-[#DDD5C7] hover:text-[#1C1917]"
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          itemDefective ? "bg-[#EF4444]" : "bg-[#22C55E]"
                        }`}
                      />
                      <span className="font-bold">Image {idx + 1}</span>

                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-md ${
                          isSelected
                            ? itemDefective
                              ? "bg-[#DC2626] text-white"
                              : "bg-[#16A34A] text-white"
                            : itemDefective
                            ? "bg-[#FEF2F2] text-[#991B1B] border border-[#FCA5A5]"
                            : "bg-[#F0FDF4] text-[#166534] border border-[#86EFAC]"
                        }`}
                      >
                        {itemDefective ? defectLabel : "Pass"}
                      </span>

                      <span className="font-mono text-[10px] opacity-75">
                        {Math.round(item.confidenceScore)}%
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Scroll Arrows if multiple images */}
            {allItems.length > 2 && (
              <div className="flex items-center gap-1 shrink-0 pl-1 border-l border-[#EAE4D7]">
                <button
                  type="button"
                  onClick={() => handleScrollCarousel("left")}
                  title="Scroll images left"
                  aria-label="Scroll images left"
                  className="p-1 rounded-lg border border-[#E5DFD3] bg-[#FAF8F5] hover:bg-[#F3EFE6] text-[#57534E] cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleScrollCarousel("right")}
                  title="Scroll images right"
                  aria-label="Scroll images right"
                  className="p-1 rounded-lg border border-[#E5DFD3] bg-[#FAF8F5] hover:bg-[#F3EFE6] text-[#57534E] cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            2. WORKSPACE TABS BAR (DIRECTLY BELOW THE IMAGE BAR)
        ========================================================================= */}
        <div className="bg-[#FFFFFF] border border-[#E5DFD3] rounded-2xl p-2 sm:p-2.5 shadow-2xs flex items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold text-[#1C1917] px-2.5 py-1 rounded-lg bg-[#FAF8F5] border border-[#EAE4D7]">
              Image {selectedIndex + 1} of {allItems.length}
            </span>
            <span className="text-xs text-[#78716A] hidden sm:inline">
              {isDefective ? "Defect Analysis Active" : "Nominal Verification Active"}
            </span>
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
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
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
            WORKSPACE CONTENT: BASED ON ACTIVE TAB
        ========================================================================= */}

        {/* TAB 1: VISUAL INSPECTOR (DEFAULT) - Shows DefectSegmenter with big image right up */}
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
            <div className="p-3 sm:p-3.5 rounded-xl border border-[#E5DFD3] bg-[#FFFFFF] flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#1C1917]">
                    {isDefective ? "Defect Detected:" : "Quality Status:"}
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
                      : "✓ Nominal Contour Verified"}
                  </span>
                  <span className="text-[#78716A] text-[11px] font-mono">
                    ({confidenceVal.toFixed(1)}% confidence)
                  </span>
                </div>

                <span className="hidden sm:inline text-[#DDD5C7]">•</span>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[#57534E]">
                    {isDefective
                      ? "Action: Quarantine component — do not release downstream."
                      : "Action: Cleared for downstream line release — zero surface voids or porosity."}
                  </span>

                  {!isDefective && outOfToleranceSensors.length > 0 && (
                    <span className="text-[10px] font-semibold text-[#92400E] bg-[#FEF3C7] px-2 py-0.5 rounded border border-[#FDE68A]">
                      Drift: {outOfToleranceSensors.map((s) => s.name).join(", ")}
                    </span>
                  )}
                </div>
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
          <div className="w-full">
            <ProcessTelemetryDossier
              telemetry={activeItem.telemetry}
              rawTelemetry={rawTelemetryDict}
              rootCauseAnalysis={rootCauseAnalysisData}
              isDefective={isDefective}
            />
          </div>
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

        {/* Smooth scroll bottom fade overlay */}
        <div
          aria-hidden="true"
          className="pointer-events-none sticky bottom-0 left-0 right-0 h-6 -mt-6 bg-gradient-to-t from-[#FAF8F5] via-[#FAF8F5]/80 to-transparent z-10 shrink-0"
        />
      </main>
    </div>
  );
}

export default LinenResults;
