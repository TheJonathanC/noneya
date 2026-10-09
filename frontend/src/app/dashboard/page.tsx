"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight, Upload, Layers } from "lucide-react";
import { LinenHeader } from "@/components/linen/LinenHeader";
import { LinenIntake, StagedItem } from "@/components/linen/LinenIntake";
import { LinenResults } from "@/components/linen/LinenResults";
import {
  inspectSinglePhoto,
  inspectBatchPhotos,
  InspectionError,
} from "@/lib/api";
import { InspectionItem } from "@/lib/inspection-adapter";

export default function QualityInspectionDashboard() {
  const [mode, setMode] = useState<"single" | "batch">("batch");
  const [stagedItems, setStagedItems] = useState<StagedItem[]>([]);
  const [isDispatching, setIsDispatching] = useState(false);
  const [currentProcessingIndex, setCurrentProcessingIndex] = useState<number>(-1);
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const [resultItems, setResultItems] = useState<InspectionItem[]>([]);
  const [rawJsons, setRawJsons] = useState<(Record<string, unknown> | null)[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [gateDecision, setGateDecision] = useState<"GO" | "ADJUST" | "CRITICAL STOP">("GO");
  const [errorState, setErrorState] = useState<InspectionError | null>(null);

  const cancelProcessingRef = useRef(false);

  const activeItem = resultItems[selectedIndex] || resultItems[0] || null;
  const activeRawJson = rawJsons[selectedIndex] || null;

  // Handle adding files to staged intake queue (single batch set at a time)
  const handleAddFiles = useCallback((files: File[]) => {
    setErrorState(null);
    const newItems: StagedItem[] = files.map((file, i) => ({
      id: `file-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      presetType: "custom",
      status: "queued",
    }));

    setStagedItems((prev) => {
      // If a batch is already staged or analyzed, replace or lock to ensure a single batch set
      if (prev.length > 0 || resultItems.length > 0) {
        // Reset previously analyzed results when loading a new batch set
        setResultItems([]);
        setRawJsons([]);
        setSelectedIndex(0);
        return newItems.slice(0, 10);
      }
      return newItems.slice(0, 10);
    });

    setActiveStep(1);
  }, [resultItems.length]);

  // Remove individual staged file
  const handleRemoveStagedItem = useCallback((id: string) => {
    setStagedItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  // Clear staged queue
  const handleClearStagedQueue = useCallback(() => {
    setStagedItems([]);
    setErrorState(null);
  }, []);

  // Primary Dispatch Flow: Process sequentially one by one in batch mode
  const handleDispatch = useCallback(async () => {
    if (stagedItems.length === 0) return;

    setIsDispatching(true);
    setActiveStep(2);
    setIsSidebarCollapsed(true); // Automatically minimize sidebar to focus on inspection viewport!
    setErrorState(null);
    cancelProcessingRef.current = false;

    if (mode === "single") {
      setCurrentProcessingIndex(0);
      setStagedItems((prev) =>
        prev.map((item, idx) => (idx === 0 ? { ...item, status: "processing" } : item))
      );
      try {
        const singleFile = stagedItems[0].file;
        const result = await inspectSinglePhoto(singleFile, {
          useMockFallback: true,
        });

        setResultItems([result.item]);
        setRawJsons([result.rawJson]);
        setSelectedIndex(0);
        setActiveStep(3);

        const decisionFromRaw =
          typeof result.rawJson?.gate_decision === "string"
            ? (result.rawJson.gate_decision as "GO" | "ADJUST" | "CRITICAL STOP")
            : typeof result.rawJson?.batch_status === "string"
            ? (result.rawJson.batch_status as "GO" | "ADJUST" | "CRITICAL STOP")
            : result.item.status === "DEFECTIVE"
            ? result.item.severity === "Critical"
              ? "CRITICAL STOP"
              : "ADJUST"
            : "GO";
        setGateDecision(decisionFromRaw);

        setStagedItems((prev) =>
          prev.map((item, idx) =>
            idx === 0
              ? {
                  ...item,
                  status: "completed",
                  verdict: result.item.status === "DEFECTIVE" ? "defective" : "ok",
                }
              : item
          )
        );
      } catch (err: unknown) {
        console.error("Model dispatch failed:", err);
        const inspectionErr: InspectionError =
          err && typeof err === "object" && "title" in err
            ? (err as InspectionError)
            : {
                title: "Inspection Dispatch Error",
                message:
                  err instanceof Error
                    ? err.message
                    : "Failed to communicate with diagnostic backend service.",
                code: "DISPATCH_FAILED",
                retryable: true,
                timestamp: new Date().toLocaleTimeString(),
              };
        setErrorState(inspectionErr);
        setActiveStep(1);
        setStagedItems((prev) =>
          prev.map((item, idx) => (idx === 0 ? { ...item, status: "error" } : item))
        );
      } finally {
        setCurrentProcessingIndex(-1);
        setIsDispatching(false);
      }
    } else {
      // BATCH MODE: Dispatch to backend batch engine (/api/inspect)
      setStagedItems((prev) =>
        prev.map((item) => ({ ...item, status: "processing", verdict: undefined }))
      );
      setCurrentProcessingIndex(-1);

      try {
        const filesToProcess = stagedItems.map((item) => item.file);
        const batchResult = await inspectBatchPhotos(filesToProcess, {
          useMockFallback: true,
        });

        if (cancelProcessingRef.current) return;

        setResultItems(batchResult.items);
        setRawJsons(new Array(batchResult.items.length).fill(batchResult.rawJson));
        setSelectedIndex(0);
        setActiveStep(3);
        setGateDecision(batchResult.gateDecision);

        setStagedItems((prev) =>
          prev.map((item, idx) => {
            const itemRes = batchResult.items[idx];
            return {
              ...item,
              status: "completed",
              verdict: itemRes && itemRes.status === "DEFECTIVE" ? "defective" : "ok",
            };
          })
        );
      } catch (err: unknown) {
        console.error("Batch dispatch failed:", err);
        const inspectionErr: InspectionError =
          err && typeof err === "object" && "title" in err
            ? (err as InspectionError)
            : {
                title: "Batch Inspection Error",
                message:
                  err instanceof Error
                    ? err.message
                    : "Failed to communicate with batch inspection backend service.",
                code: "BATCH_DISPATCH_FAILED",
                retryable: true,
                timestamp: new Date().toLocaleTimeString(),
              };
        setErrorState(inspectionErr);
        setActiveStep(1);
        setStagedItems((prev) =>
          prev.map((item) => ({ ...item, status: "error" }))
        );
      } finally {
        setCurrentProcessingIndex(-1);
        setIsDispatching(false);
      }
    }
  }, [stagedItems, mode]);

  // Retry previous dispatch
  const handleRetryDispatch = useCallback(() => {
    handleDispatch();
  }, [handleDispatch]);

  // Dismiss active error notice
  const handleDismissError = useCallback(() => {
    setErrorState(null);
  }, []);

  // Reset entire flow
  const handleResetAll = useCallback(() => {
    cancelProcessingRef.current = true;
    setIsDispatching(false);
    setCurrentProcessingIndex(-1);
    setStagedItems([]);
    setResultItems([]);
    setRawJsons([]);
    setSelectedIndex(0);
    setGateDecision("GO");
    setErrorState(null);
    setActiveStep(1);
  }, []);

  // Arrow key navigation between batch parts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      if (resultItems.length > 1) {
        if (e.key === "ArrowDown" || e.key === "ArrowRight") {
          e.preventDefault();
          setSelectedIndex((prev) => (prev < resultItems.length - 1 ? prev + 1 : 0));
        } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : resultItems.length - 1));
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [resultItems.length]);

  const batchStats = {
    total: resultItems.length,
    passed: resultItems.filter((i) => i.status === "PASSED").length,
    defective: resultItems.filter((i) => i.status === "DEFECTIVE").length,
  };

  return (
    <div className="min-h-screen lg:h-screen flex flex-col bg-[#FAF8F5] text-[#1C1917] font-sans selection:bg-[#F3EFE6] selection:text-[#1C1917] lg:overflow-hidden">
      {/* Sleek Minimalist Header */}
      <LinenHeader
        onResetAll={handleResetAll}
        hasActiveInspection={resultItems.length > 0 || stagedItems.length > 0}
      />

      {/* Main Clean Workspace: Collapsible Left Intake Station, Full-Focus Right Inspection Area */}
      <main className="flex-1 max-w-[1700px] w-full mx-auto flex flex-col lg:flex-row min-h-0 lg:overflow-hidden relative">
        {/* Left Side: Intake Station (Collapsible) */}
        <section
          aria-label="Component intake"
          className={`border-b lg:border-b-0 lg:border-r border-[#EAE4D7] bg-[#FAF8F5] lg:h-full flex flex-col transition-all duration-300 ease-in-out relative ${
            isSidebarCollapsed
              ? "w-full lg:w-14 shrink-0 overflow-visible"
              : "w-full lg:w-[380px] xl:w-[420px] shrink-0 overflow-hidden"
          }`}
        >
          {isSidebarCollapsed ? (
            /* Minimized Sidebar Rail */
            <div className="h-full flex flex-col items-center py-4 px-1.5 justify-between bg-[#FAF8F5]">
              <div className="flex flex-col items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsSidebarCollapsed(false)}
                  title="Expand intake sidebar"
                  aria-label="Expand intake sidebar"
                  className="w-10 h-10 rounded-xl bg-[#FFFFFF] border border-[#DDD5C7] text-[#1C1917] hover:bg-[#F3EFE6] flex items-center justify-center transition-all cursor-pointer shadow-xs group"
                >
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </button>

                <div
                  className="writing-mode-vertical text-[11px] font-semibold text-[#78716A] tracking-wider uppercase select-none pt-2 cursor-pointer flex items-center gap-1.5"
                  onClick={() => setIsSidebarCollapsed(false)}
                  style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
                >
                  <span>Intake ({stagedItems.length})</span>
                </div>
              </div>

              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsSidebarCollapsed(false)}
                  title="Upload more components"
                  aria-label="Upload more components"
                  className="w-9 h-9 rounded-xl bg-[#1C1917] text-[#FAF8F5] flex items-center justify-center hover:bg-[#2C2724] transition-colors cursor-pointer shadow-xs"
                >
                  <Upload className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            /* Expanded Intake Panel */
            <div className="h-full flex flex-col relative overflow-hidden">
              <LinenIntake
                mode={mode}
                onModeChange={(newMode) => {
                  setMode(newMode);
                  if (newMode === "single" && stagedItems.length > 1) {
                    setStagedItems([stagedItems[0]]);
                  }
                }}
                stagedItems={stagedItems}
                onAddFiles={handleAddFiles}
                onRemoveItem={handleRemoveStagedItem}
                onClearQueue={handleClearStagedQueue}
                isDispatching={isDispatching}
                onDispatch={handleDispatch}
                activeStep={activeStep}
                currentProcessingIndex={currentProcessingIndex}
                selectedItemIndex={selectedIndex}
                onSelectItem={(idx) => {
                  if (resultItems[idx]) {
                    setSelectedIndex(idx);
                  }
                }}
                onToggleCollapse={() => setIsSidebarCollapsed(true)}
              />
            </div>
          )}
        </section>

        {/* Right Side: Inspection Report & JSON Output (Scrolls freely) */}
        <section
          aria-label="Inspection results and report"
          className="flex-1 min-w-0 lg:h-full overflow-y-auto bg-[#FAF8F5]"
        >
          <LinenResults
            activeItem={activeItem}
            allItems={resultItems}
            selectedIndex={selectedIndex}
            onSelectIndex={setSelectedIndex}
            rawJson={activeRawJson}
            isLoading={isDispatching && resultItems.length === 0}
            isBatch={mode === "batch" || resultItems.length > 1}
            isBatchProcessing={isDispatching && mode === "batch"}
            batchProcessingIndex={currentProcessingIndex}
            batchTotalCount={stagedItems.length}
            gateDecision={gateDecision}
            batchStats={resultItems.length > 0 ? batchStats : undefined}
            errorState={errorState}
            onRetry={handleRetryDispatch}
            onDismissError={handleDismissError}
          />
        </section>
      </main>
    </div>
  );
}
