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
  Sliders,
  Check,
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
  // Track operator manual toggles per part ID.
  // Defaults: Defective parts -> image open by default (true).
  //           OK parts -> image hidden by default (false).
  const [userToggledImage, setUserToggledImage] = useState<Record<string, boolean>>({});

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
            Evaluating image and running integrated inspection pipeline.
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
            Ready for Component Intake
          </h2>
          <p className="text-xs text-[#78716A] leading-relaxed">
            Upload a component image in the left panel to begin automated inspection. The pipeline evaluates surface contour, defect segmentation, and telemetry in real time.
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
  const predictedDefects = activeItem.predictedDefects || [];
  const confidenceScores = activeItem.confidenceScores || {};
  const confidenceVal = Math.min(Math.max(activeItem.confidenceScore, 0), 100);

  // If defective: image is open by default.
  // If OK: image is hidden by default.
  const showImage =
    userToggledImage[activeItem.id] !== undefined
      ? userToggledImage[activeItem.id]
      : isDefective;

  const toggleShowImage = () => {
    setUserToggledImage((prev) => ({
      ...prev,
      [activeItem.id]: !showImage,
    }));
  };

  const originalImg =
    activeItem.visionResults?.original_image_base64 ||
    activeItem.visionResults?.original_url ||
    activeItem.rawImageUrl;

  const heatmapImg =
    activeItem.visionResults?.heatmap_image_base64 ||
    activeItem.visionResults?.heatmap_png_url ||
    activeItem.heatmapImageUrl;

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
              className="bg-[#D97706] h-full transition-all duration-300"
              style={{
                width: `${Math.round(
                  (Math.min(batchProcessingIndex + 1, batchTotalCount) / batchTotalCount) * 100
                )}%`,
              }}
            />
          </div>

          {/* Sequential Step Badges */}
          <div className="flex items-center gap-2 overflow-x-auto pt-1">
            {Array.from({ length: batchTotalCount }).map((_, idx) => {
              const isPast = idx < batchProcessingIndex;
              const isCurrent = idx === batchProcessingIndex;
              const pastItem = allItems[idx];
              const pastDefective = pastItem?.status === "DEFECTIVE";

              return (
                <div
                  key={`step-${idx}`}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all shrink-0 flex items-center gap-1.5 ${
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
                      ? "bg-[#1C1917] border-[#1C1917] text-[#FAF8F5] shadow-xs font-semibold"
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

      {/* =========================================================================
          BRANCH A: DEFECTIVE PART INSPECTION
          Brings the AI segmentation viewer right to the top, open by default!
      ========================================================================= */}
      {isDefective ? (
        <div className="space-y-5">
          {/* Defect Summary Header Bar */}
          <div className="p-4 sm:p-5 rounded-2xl border border-[#FCA5A5]/70 bg-[#FEF2F2] flex flex-wrap items-center justify-between gap-4 shadow-xs text-[#991B1B]">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#FFFFFF] border border-[#FCA5A5] text-[#991B1B] shadow-2xs">
                <ShieldAlert aria-hidden="true" className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="text-sm font-bold text-[#1C1917]">
                    Defect Detected • Integrated Pipeline Active
                  </h3>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FFFFFF] text-[#991B1B] border border-[#FCA5A5]">
                    {activeItem.severity || "Critical"}
                  </span>
                </div>
                <p className="text-xs text-[#78716A] mt-0.5">
                  {activeItem.fileName || "Component Analysis"} • Scanned at{" "}
                  <span className="font-mono tabular-nums">{activeItem.timestamp}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleShowImage}
                aria-label={showImage ? "Collapse visual inspection" : "Expand visual inspection"}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#DDD5C7] bg-[#FFFFFF] text-[#57534E] hover:text-[#1C1917] hover:bg-[#F3EFE6] text-xs font-medium transition-colors cursor-pointer"
              >
                {showImage ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showImage ? "Hide Visual Viewer" : "Show Visual Viewer"}</span>
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                aria-label="Print report"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#DDD5C7] bg-[#FFFFFF] text-[#57534E] hover:text-[#1C1917] hover:bg-[#F3EFE6] text-xs font-medium transition-colors cursor-pointer"
              >
                <Printer aria-hidden="true" className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
            </div>
          </div>

          {/* 1. VISUAL INSPECTION CENTERPIECE (Brought up & open by default!) */}
          {showImage && (
            <DefectSegmenter
              originalImage={originalImg}
              heatmapImage={heatmapImg}
              segmentationInstances={activeItem.segmentationInstances}
              defectType={
                predictedDefects.length > 0
                  ? predictedDefects.join(", ")
                  : activeItem.defectType || "Localized Defect"
              }
              severity={activeItem.severity || "Critical"}
              confidence={activeItem.confidenceScore}
              stationName={activeItem.metadata?.stationId || "Automated Line • Station 04"}
              hotspots={activeItem.visionResults?.hotspots}
            />
          )}

          {/* 2. Categorized Defects & Root Cause Analysis Section */}
          <section
            aria-label="Defect Diagnostic Data"
            className="rounded-2xl border border-[#E5DFD3] bg-[#FFFFFF] p-5 space-y-4 shadow-xs"
          >
            {/* Categorized Defects Pills */}
            {predictedDefects.length > 0 && (
              <div className="p-4 rounded-xl border border-[#E5DFD3] bg-[#FAF8F5] space-y-2.5">
                <div className="text-xs font-semibold text-[#1C1917]">
                  Categorized Defects (Model 2 Multi-Label)
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

            {/* Root Cause Summary & Recommended Action */}
            {activeItem.rootCauseSummary && (
              <div className="p-4 rounded-xl border border-[#FED7D7] bg-[#FFF5F5] space-y-2 text-xs">
                <div className="font-semibold text-[#991B1B] flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-[#DC2626]" />
                  <span>Model 3 Telemetry Diagnostic Attribution</span>
                </div>
                <p className="text-[#57534E] leading-relaxed">
                  {activeItem.rootCauseSummary}
                </p>
                {activeItem.recommendedAction && (
                  <div className="pt-2 border-t border-[#FCA5A5]/40 text-[#78350F] font-medium">
                    <span className="font-semibold text-[#1C1917]">Corrective Action: </span>
                    {activeItem.recommendedAction}
                  </div>
                )}
              </div>
            )}

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl border border-[#EAE4D7] bg-[#FAF8F5]">
                <div className="text-[11px] text-[#78716A]">Verdict</div>
                <div className="text-sm font-bold text-[#991B1B] mt-0.5">
                  Defective
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-[#EAE4D7] bg-[#FAF8F5]">
                <div className="text-[11px] text-[#78716A]">Confidence</div>
                <div className="text-sm font-semibold font-mono text-[#1C1917] mt-0.5">
                  {confidenceVal.toFixed(1)}%
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-[#EAE4D7] bg-[#FAF8F5]">
                <div className="text-[11px] text-[#78716A]">Gate Decision</div>
                <div className="text-sm font-semibold text-[#991B1B] mt-0.5">
                  {gateDecision || "CRITICAL STOP"}
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-[#EAE4D7] bg-[#FAF8F5]">
                <div className="text-[11px] text-[#78716A]">Line Action</div>
                <div className="text-sm font-semibold text-[#1C1917] mt-0.5">
                  Quarantine Part
                </div>
              </div>
            </div>

            {/* Confidence Meter Bar */}
            <div className="p-3.5 rounded-xl border border-[#EAE4D7] bg-[#FAF8F5] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#78716A] font-medium flex items-center gap-1.5">
                  <Gauge aria-hidden="true" className="w-3.5 h-3.5 text-[#57534E]" />
                  <span>Anomaly Confidence Level</span>
                </span>
                <span className="font-mono font-semibold text-[#1C1917] tabular-nums">
                  {confidenceVal.toFixed(1)}%
                </span>
              </div>
              <div className="h-2 w-full bg-[#E5DFD3] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#DC2626] transition-all duration-300"
                  style={{ width: `${confidenceVal}%` }}
                />
              </div>
            </div>

            {/* Telemetry Sensor Readings Table */}
            {activeItem.telemetry && activeItem.telemetry.length > 0 && (
              <div className="space-y-2 pt-1">
                <div className="text-xs font-semibold text-[#1C1917]">
                  Sensor Readings (SCADA / PLC Virtual Telemetry)
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {activeItem.telemetry.map((t) => (
                    <div
                      key={t.id}
                      className={`p-3 rounded-xl border text-xs space-y-1 ${
                        t.isOutOfTolerance
                          ? "bg-[#FEF2F2] border-[#FCA5A5] text-[#991B1B]"
                          : "bg-[#FAF8F5] border-[#EAE4D7] text-[#57534E]"
                      }`}
                    >
                      <div className="text-[10px] text-[#78716A] truncate" title={t.name}>
                        {t.name}
                      </div>
                      <div className="font-mono font-bold text-sm text-[#1C1917]">
                        {t.recordedValue} {t.unit}
                      </div>
                      <div className="text-[10px] font-mono">
                        {t.isOutOfTolerance ? "OutOfTolerance" : "Nominal"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      ) : (
        /* =========================================================================
           BRANCH B: ALL OK (NOMINAL PASS)
           Hides the image by default and just shows the clean data card saying "all ok"!
        ========================================================================= */
        <div className="space-y-5">
          {/* All OK Primary Data Card */}
          <section
            aria-label="Nominal Component Pass Report"
            className="rounded-2xl border border-[#86EFAC]/70 bg-[#FFFFFF] overflow-hidden shadow-xs"
          >
            {/* Header: All OK Status */}
            <div className="p-5 bg-[#F0FDF4] border-b border-[#DCFCE7] flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="p-3 rounded-2xl bg-[#DCFCE7] border border-[#86EFAC] text-[#166534] shadow-2xs">
                  <ShieldCheck aria-hidden="true" className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-base font-bold text-[#1C1917]">
                      All OK • Nominal Component Pass
                    </h3>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#DCFCE7] text-[#166534] border border-[#86EFAC]">
                      Pass • Good to Go
                    </span>
                  </div>
                  <p className="text-xs text-[#78716A] mt-0.5">
                    {activeItem.fileName || "Component Analysis"} • Inspected at{" "}
                    <span className="font-mono tabular-nums">{activeItem.timestamp}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleShowImage}
                  aria-label={showImage ? "Hide reference photo" : "Inspect reference photo"}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#DDD5C7] bg-[#FFFFFF] text-[#57534E] hover:text-[#1C1917] hover:bg-[#F3EFE6] text-xs font-medium transition-colors cursor-pointer"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>{showImage ? "Hide Reference Photo" : "Inspect Reference Photo"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  aria-label="Print report"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#DDD5C7] bg-[#FFFFFF] text-[#57534E] hover:text-[#1C1917] hover:bg-[#F3EFE6] text-xs font-medium transition-colors cursor-pointer"
                >
                  <Printer aria-hidden="true" className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>
              </div>
            </div>

            {/* Body: Clean All OK Data Layout */}
            <div className="p-5 sm:p-6 space-y-5">
              {/* Executive All-Clear Banner */}
              <div className="p-4 rounded-xl border border-[#DCFCE7] bg-[#F6FEF8] flex items-start gap-3.5 text-[#166534]">
                <CheckCircle2 aria-hidden="true" className="w-6 h-6 shrink-0 mt-0.5 text-[#16A34A]" />
                <div className="space-y-1">
                  <div className="text-sm font-bold text-[#166534]">
                    The part is OK and good to go.
                  </div>
                  <p className="text-xs leading-relaxed text-[#57534E]">
                    All optical surface contours, concentric radial zones (hub, vane cavity, flange, rim), and dimensional tolerances are verified nominal. Zero surface defects or thermal anomalies detected.
                  </p>
                </div>
              </div>

              {/* Key Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-xl border border-[#EAE4D7] bg-[#FAF8F5]">
                  <div className="text-[11px] text-[#78716A]">Verdict</div>
                  <div className="text-sm font-bold text-[#166534] mt-1 flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-[#16A34A]" />
                    <span>Pass (Nominal)</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-[#EAE4D7] bg-[#FAF8F5]">
                  <div className="text-[11px] text-[#78716A]">Confidence Score</div>
                  <div className="text-sm font-semibold font-mono text-[#1C1917] mt-1">
                    {confidenceVal.toFixed(1)}%
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-[#EAE4D7] bg-[#FAF8F5]">
                  <div className="text-[11px] text-[#78716A]">Gate Decision</div>
                  <div className="text-sm font-semibold text-[#166534] mt-1">
                    {gateDecision || "GO"} (Line Cleared)
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-[#EAE4D7] bg-[#FAF8F5]">
                  <div className="text-[11px] text-[#78716A]">Line Action</div>
                  <div className="text-sm font-semibold text-[#1C1917] mt-1">
                    Release to Line
                  </div>
                </div>
              </div>

              {/* Confidence Meter Bar */}
              <div className="p-4 rounded-xl border border-[#EAE4D7] bg-[#FAF8F5] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#78716A] font-medium flex items-center gap-1.5">
                    <Gauge aria-hidden="true" className="w-3.5 h-3.5 text-[#57534E]" />
                    <span>Nominal Verification Confidence</span>
                  </span>
                  <span className="font-mono font-semibold text-[#1C1917] tabular-nums">
                    {confidenceVal.toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 w-full bg-[#E5DFD3] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#16A34A] transition-all duration-300"
                    style={{ width: `${confidenceVal}%` }}
                  />
                </div>
              </div>

              {/* Diagnostic Sensor Telemetry Strip (All nominal) */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-[#1C1917]">
                  Process Telemetry (All Sensors Within Permissible Band)
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {(activeItem.telemetry || []).map((t) => (
                    <div
                      key={t.id}
                      className="p-3 rounded-xl border border-[#EAE4D7] bg-[#FAF8F5] text-xs space-y-1"
                    >
                      <div className="text-[10px] text-[#78716A] truncate" title={t.name}>
                        {t.name}
                      </div>
                      <div className="font-mono font-bold text-sm text-[#1C1917]">
                        {t.recordedValue} {t.unit}
                      </div>
                      <div className="text-[10px] text-[#166534] font-medium flex items-center gap-1">
                        <Check className="w-3 h-3 text-[#16A34A]" />
                        <span>In Tolerance</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Operational Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
                <div className="p-3 rounded-lg border border-[#EAE4D7] bg-[#FCFBF8] flex items-center gap-2 text-[#78716A]">
                  <Clock aria-hidden="true" className="w-3.5 h-3.5 text-[#A8A29E]" />
                  <span>
                    Cycle Duration:{" "}
                    <span className="font-mono font-semibold text-[#1C1917]">
                      {activeItem.metadata?.cycleDurationMs || 120} ms
                    </span>
                  </span>
                </div>

                <div className="p-3 rounded-lg border border-[#EAE4D7] bg-[#FCFBF8] flex items-center gap-2 text-[#78716A]">
                  <Activity aria-hidden="true" className="w-3.5 h-3.5 text-[#A8A29E]" />
                  <span>
                    Pipeline Stage:{" "}
                    <span className="font-semibold text-[#1C1917]">
                      Pass 1 Classification Cleared
                    </span>
                  </span>
                </div>

                <div className="p-3 rounded-lg border border-[#EAE4D7] bg-[#FCFBF8] flex items-center gap-2 text-[#78716A]">
                  <ShieldCheck aria-hidden="true" className="w-3.5 h-3.5 text-[#A8A29E]" />
                  <span>
                    Human Review:{" "}
                    <span className="font-semibold text-[#166534]">
                      Not Required
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Optional Expanded Reference Photo (Only shown if operator explicitly clicks "Inspect Reference Photo") */}
          {showImage && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-[#78716A] px-1">
                <span>Reference Capture (Nominal Verification)</span>
                <button
                  type="button"
                  onClick={toggleShowImage}
                  className="text-xs text-[#57534E] hover:text-[#1C1917] underline cursor-pointer"
                >
                  Hide photo
                </button>
              </div>
              <DefectSegmenter
                originalImage={originalImg}
                heatmapImage={heatmapImg}
                segmentationInstances={activeItem.segmentationInstances}
                defectType="Nominal Baseline"
                severity="Nominal"
                confidence={activeItem.confidenceScore}
                stationName={activeItem.metadata?.stationId || "Automated Line • Station 04"}
                hotspots={[]}
              />
            </div>
          )}
        </div>
      )}

      {/* Raw Diagnostic JSON Output (Collapsed by Default) */}
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
