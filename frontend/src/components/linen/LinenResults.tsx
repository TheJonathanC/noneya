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
  Activity,
  Gauge,
  Clock,
  RefreshCw,
  Check,
  Crosshair,
  FileText,
  Sliders,
  Layers,
} from "lucide-react";
import { InspectionItem } from "@/lib/inspection-adapter";
import { InspectionError } from "@/lib/api";
import { LinenJsonViewer } from "./LinenJsonViewer";
import { DefectSegmenter } from "@/components/inspection/DefectSegmenter";
import { ProcessTelemetryDossier } from "@/components/inspection/ProcessTelemetryDossier";
import { DotsLoader } from "@/components/common/DotsLoader";

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
  // Primary Tabs State:
  // For Defective parts: 'visual' (Image Forward) | 'audit' | 'telemetry' | 'json'
  // For OK parts:        'report' (All OK) | 'visual' (Reference) | 'telemetry' | 'json'
  const [activeTabOverride, setActiveTabOverride] = useState<string | null>(null);
  const [lastPartId, setLastPartId] = useState<string | null>(null);

  // If operator switches active part in batch, reset tab override to default for that part
  if (activeItem && activeItem.id !== lastPartId) {
    setLastPartId(activeItem.id);
    setActiveTabOverride(null);
  }

  // Loading State with Particle Swarm
  if (isLoading && !activeItem) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#FAF8F5] text-center space-y-4">
        <div className="p-3 rounded-2xl bg-[#FFFFFF] border border-[#E5DFD3] shadow-xs flex items-center justify-center">
          <DotsLoader size="md" shape="loader" />
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

  // Defaults: Defective -> 'visual' (Image Forward). OK -> 'report' (All OK data card).
  const defaultTab = isDefective ? "visual" : "report";
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

  // Primary Top-Level Tabs (Operator friendly, non-technical)
  const primaryTabs = isDefective
    ? [
        {
          id: "visual",
          label: "Image",
          icon: ImageIcon,
        },
        {
          id: "report",
          label: "Report",
          icon: FileText,
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
      ]
    : [
        {
          id: "report",
          label: "Report",
          icon: ShieldCheck,
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
          Clean, simple, non-technical, and keeps the image front and center.
      ========================================================================= */}
      <div className="bg-[#FFFFFF] border border-[#E5DFD3] rounded-2xl p-3 sm:p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Left: Clean Verdict Pill + Optional Batch Part Selector */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Status Pill */}
          <div
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold border transition-colors ${
              isDefective
                ? "bg-[#FEF2F2] border-[#FCA5A5] text-[#991B1B]"
                : "bg-[#F0FDF4] border-[#86EFAC] text-[#166534]"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isDefective ? "bg-[#EF4444] animate-pulse" : "bg-[#22C55E]"
              }`}
            />
            <span>{isDefective ? "Defect Detected" : "All Good • Part OK"}</span>
          </div>

          {/* Batch Selector (Simple Part 1, Part 2 pills - NO raw filenames!) */}
          {isBatch && (allItems.length > 1 || isBatchProcessing) && (
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
                      className={`w-1.5 h-1.5 rounded-full ${
                        itemDefective ? "bg-[#EF4444]" : "bg-[#22C55E]"
                      }`}
                    />
                    <span>Part {idx + 1}</span>
                  </button>
                );
              })}

              {isBatchProcessing && batchTotalCount > allItems.length && (
                <div className="px-2 py-0.5 text-[11px] font-medium text-[#92400E] flex items-center gap-1.5">
                  <DotsLoader size="sm" shape="loader" className="w-3.5 h-3.5" />
                  <span>Part {batchProcessingIndex + 1} Analyzing…</span>
                </div>
              )}

              {batchStats && (
                <span className="text-[11px] text-[#78716A] px-2 font-mono border-l border-[#E5DFD3] ml-0.5">
                  {batchStats.passed}/{batchStats.total} OK
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right: Primary Tabs (Image | Report | Sensors | Details) */}
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

      {/* =========================================================================
          TAB 1: VISUAL DIAGNOSTICS (IMAGE FORWARD)
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
                View Full Report →
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
          TAB 2: QUALITY AUDIT / REPORT
      ========================================================================= */}
      {(currentTab === "audit" || currentTab === "report") && (
        <div className="space-y-5">
          {isDefective ? (
            /* Defective Audit Ticket Dossier */
            <section
              aria-label="Defect Diagnostic Data"
              className="rounded-2xl border border-[#E5DFD3] bg-[#FFFFFF] p-5 sm:p-6 space-y-5 shadow-xs"
            >
              {/* Categorized Defects Pills */}
              {predictedDefects.length > 0 && (
                <div className="p-4 rounded-xl border border-[#E5DFD3] bg-[#FAF8F5] space-y-2.5">
                  <div className="text-xs font-semibold text-[#1C1917]">
                    Detected Defects
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
                <div className="p-4 sm:p-5 rounded-xl border border-[#FED7D7] bg-[#FFF5F5] space-y-2 text-xs">
                  <div className="font-semibold text-[#991B1B] flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-[#DC2626]" />
                    <span>Probable Root Cause</span>
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
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <div className="p-4 rounded-xl border border-[#EAE4D7] bg-[#FAF8F5]">
                  <div className="text-[11px] text-[#78716A]">Verdict</div>
                  <div className="text-sm font-bold text-[#991B1B] mt-0.5">
                    Defective
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-[#EAE4D7] bg-[#FAF8F5]">
                  <div className="text-[11px] text-[#78716A]">Confidence</div>
                  <div className="text-sm font-semibold font-mono text-[#1C1917] mt-0.5">
                    {confidenceVal.toFixed(1)}%
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-[#EAE4D7] bg-[#FAF8F5]">
                  <div className="text-[11px] text-[#78716A]">Gate Decision</div>
                  <div className="text-sm font-semibold text-[#991B1B] mt-0.5">
                    {gateDecision || "CRITICAL STOP"}
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-[#EAE4D7] bg-[#FAF8F5]">
                  <div className="text-[11px] text-[#78716A]">Line Action</div>
                  <div className="text-sm font-semibold text-[#1C1917] mt-0.5">
                    Quarantine Part
                  </div>
                </div>
              </div>

              {/* Confidence Meter Bar */}
              <div className="p-4 rounded-xl border border-[#EAE4D7] bg-[#FAF8F5] space-y-2">
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
                    Pipeline:{" "}
                    <span className="font-semibold text-[#1C1917]">
                      Integrated 4-Stage
                    </span>
                  </span>
                </div>

                <div className="p-3 rounded-lg border border-[#EAE4D7] bg-[#FCFBF8] flex items-center gap-2 text-[#78716A]">
                  <ShieldCheck aria-hidden="true" className="w-3.5 h-3.5 text-[#A8A29E]" />
                  <span>
                    Human Review:{" "}
                    <span className="font-semibold text-[#991B1B]">
                      Mandatory Sign-off
                    </span>
                  </span>
                </div>
              </div>

              {/* Quick Actions for Operator */}
              <div className="flex items-center gap-2 pt-2 border-t border-[#EAE4D7]">
                <button
                  type="button"
                  onClick={() => setActiveTabOverride("visual")}
                  className="px-3 py-1.5 rounded-lg border border-[#DDD5C7] bg-[#FFFFFF] hover:bg-[#F3EFE6] text-[#1C1917] font-medium text-xs transition-colors cursor-pointer"
                >
                  View Defect Photo →
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTabOverride("telemetry")}
                  className="px-3 py-1.5 rounded-lg border border-[#DDD5C7] bg-[#FFFFFF] hover:bg-[#F3EFE6] text-[#57534E] hover:text-[#1C1917] text-xs transition-colors cursor-pointer"
                >
                  Check Sensors →
                </button>
              </div>
            </section>
          ) : (
            /* All OK Clean Data Card */
            <section
              aria-label="Nominal Component Pass Report"
              className="rounded-2xl border border-[#86EFAC]/70 bg-[#FFFFFF] overflow-hidden shadow-xs"
            >
              {/* Executive All-Clear Banner */}
              <div className="p-5 sm:p-6 bg-[#F0FDF4] border-b border-[#DCFCE7] flex items-start gap-3.5 text-[#166534]">
                <CheckCircle2 aria-hidden="true" className="w-6 h-6 shrink-0 mt-0.5 text-[#16A34A]" />
                <div className="space-y-1">
                  <div className="text-base font-bold text-[#166534]">
                    The part is OK and good to go.
                  </div>
                  <p className="text-xs leading-relaxed text-[#57534E]">
                    All optical surface contours, concentric radial zones (hub, vane cavity, flange, rim), and dimensional tolerances are verified nominal. Zero surface defects or thermal anomalies detected.
                  </p>
                </div>
              </div>

              {/* Key Metrics Grid */}
              <div className="p-5 sm:p-6 space-y-5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
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

                {/* Quick Actions for Operator */}
                <div className="flex items-center gap-2 pt-2 border-t border-[#EAE4D7]">
                  <button
                    type="button"
                    onClick={() => setActiveTabOverride("visual")}
                    className="px-3 py-1.5 rounded-lg border border-[#DDD5C7] bg-[#FFFFFF] hover:bg-[#F3EFE6] text-[#1C1917] font-medium text-xs transition-colors cursor-pointer"
                  >
                    View Reference Photo →
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTabOverride("telemetry")}
                    className="px-3 py-1.5 rounded-lg border border-[#DDD5C7] bg-[#FFFFFF] hover:bg-[#F3EFE6] text-[#57534E] hover:text-[#1C1917] text-xs transition-colors cursor-pointer"
                  >
                    View Sensors →
                  </button>
                </div>
              </div>
            </section>
          )}
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
