"use client";

import React from "react";
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Scan,
  RotateCcw,
  Sparkles,
  Printer,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import { InspectionItem } from "@/lib/inspection-adapter";
import { InspectionError } from "@/lib/api";
import { LinenJsonViewer } from "./LinenJsonViewer";
import { LinenImageViewer } from "./LinenImageViewer";

interface LinenResultsProps {
  activeItem: InspectionItem | null;
  allItems: InspectionItem[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  rawJson: Record<string, unknown> | null;
  isLoading: boolean;
  isBatch: boolean;
  gateDecision?: "GO" | "ADJUST" | "CRITICAL STOP";
  batchStats?: { total: number; passed: number; defective: number };
  onLoadQuickSample: () => void;
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
  batchStats,
  onLoadQuickSample,
  errorState,
  onRetry,
}: LinenResultsProps) {
  // Loading State
  if (isLoading) {
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

  // Empty Idle State
  if (!activeItem) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 sm:p-14 bg-[#FAF8F5] text-center space-y-6">
        <div className="w-14 h-14 rounded-2xl bg-[#F3EFE6] border border-[#E2DBD0] flex items-center justify-center text-[#78716A]">
          <Scan aria-hidden="true" className="w-7 h-7" />
        </div>

        <div className="space-y-1 max-w-md">
          <h2 className="text-base font-semibold text-[#1C1917]">
            No Component Inspected Yet
          </h2>
          <p className="text-xs text-[#78716A] leading-relaxed">
            Upload an image on the left to start inspection. If a defect is detected, the integrated diagnostic pipeline will classify it; otherwise the part is marked OK and good to go.
          </p>
        </div>

        <button
          type="button"
          onClick={onLoadQuickSample}
          className="py-2.5 px-4 rounded-xl border border-[#DDD5C7] bg-[#FFFFFF] hover:bg-[#F3EFE6] text-[#1C1917] text-xs font-medium flex items-center gap-2 transition-[background-color,border-color,transform] duration-150 active:scale-[0.97] cursor-pointer shadow-xs"
        >
          <Sparkles aria-hidden="true" className="w-3.5 h-3.5 text-[#D97706]" />
          <span>Load Sample Image</span>
        </button>
      </div>
    );
  }

  const isDefective = activeItem.status === "DEFECTIVE";
  const predictedDefects = activeItem.predictedDefects || [];
  const confidenceScores = activeItem.confidenceScores || {};

  return (
    <div className="flex-1 flex flex-col bg-[#FAF8F5] overflow-y-auto p-4 sm:p-6 space-y-6">
      {/* Batch Navigation (when inspecting multiple parts) */}
      {isBatch && allItems.length > 1 && (
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
                  className={`py-1.5 px-3 rounded-xl border text-xs font-medium flex items-center gap-2 shrink-0 transition-[background-color,border-color,box-shadow,transform] duration-150 active:scale-[0.97] cursor-pointer ${
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
          </div>

          {batchStats && (
            <span className="text-xs text-[#78716A] shrink-0 font-mono">
              {batchStats.passed}/{batchStats.total} OK
            </span>
          )}
        </div>
      )}

      {/* 1. Clean Optical Component Image (No red markers) */}
      <LinenImageViewer item={activeItem} />

      {/* 2. Sleek Inspection Report */}
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

        {/* Executive Summary Message */}
        <div className="p-5 space-y-4">
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
                      className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-[#FFFFFF] border border-[#FCA5A5] text-[#991B1B] text-xs font-medium shadow-2xs"
                    >
                      <span className="font-semibold uppercase tracking-wide">
                        {defect}
                      </span>
                      {score && (
                        <span className="font-mono text-[11px] text-[#7F1D1D] bg-[#FEE2E2] px-1.5 py-0.2 rounded font-semibold">
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <div className="p-3 rounded-xl border border-[#EAE4D7] bg-[#FAF8F5]">
              <div className="text-[11px] text-[#78716A]">Verdict</div>
              <div
                className={`text-sm font-semibold mt-0.5 ${
                  isDefective ? "text-[#991B1B]" : "text-[#166534]"
                }`}
              >
                {isDefective ? "Defective" : "OK"}
              </div>
            </div>

            <div className="p-3 rounded-xl border border-[#EAE4D7] bg-[#FAF8F5]">
              <div className="text-[11px] text-[#78716A]">Confidence</div>
              <div className="text-sm font-semibold font-mono text-[#1C1917] mt-0.5">
                {activeItem.confidenceScore.toFixed(1)}%
              </div>
            </div>

            <div className="p-3 rounded-xl border border-[#EAE4D7] bg-[#FAF8F5]">
              <div className="text-[11px] text-[#78716A]">Human Review</div>
              <div className="text-sm font-semibold text-[#1C1917] mt-0.5">
                {isDefective
                  ? activeItem.requiresHumanReview !== false
                    ? "Required"
                    : "Not Required"
                  : "None"}
              </div>
            </div>

            <div className="p-3 rounded-xl border border-[#EAE4D7] bg-[#FAF8F5]">
              <div className="text-[11px] text-[#78716A]">Action</div>
              <div className="text-sm font-semibold text-[#1C1917] mt-0.5">
                {isDefective ? "Quarantine & Review" : "Release to Line"}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Clean JSON Output */}
      {rawJson && (
        <LinenJsonViewer
          data={rawJson}
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
