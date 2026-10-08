"use client";

import React, { useState, useEffect, useCallback } from "react";
import { LinenHeader } from "@/components/linen/LinenHeader";
import { LinenIntake, StagedItem } from "@/components/linen/LinenIntake";
import { LinenResults } from "@/components/linen/LinenResults";
import {
  inspectSinglePhoto,
  inspectBatchPhotos,
  createSampleFile,
  InspectionError,
} from "@/lib/api";
import { InspectionItem } from "@/lib/inspection-adapter";

export default function QualityInspectionDashboard() {
  const [mode, setMode] = useState<"single" | "batch">("single");
  const [stagedItems, setStagedItems] = useState<StagedItem[]>([]);
  const [isDispatching, setIsDispatching] = useState(false);
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);

  const [resultItems, setResultItems] = useState<InspectionItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [rawJson, setRawJson] = useState<Record<string, unknown> | null>(null);
  const [gateDecision, setGateDecision] = useState<"GO" | "ADJUST" | "CRITICAL STOP">("GO");
  const [errorState, setErrorState] = useState<InspectionError | null>(null);

  const activeItem = resultItems[selectedIndex] || resultItems[0] || null;

  // Handle adding files to staged intake queue
  const handleAddFiles = useCallback((files: File[]) => {
    setErrorState(null);
    const newItems: StagedItem[] = files.map((file, i) => ({
      id: `file-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      presetType: "custom",
    }));

    setStagedItems((prev) => {
      if (mode === "single") {
        return [newItems[0]];
      }
      return [...prev, ...newItems].slice(0, 10);
    });

    setActiveStep(1);
  }, [mode]);

  // Remove individual staged file
  const handleRemoveStagedItem = useCallback((id: string) => {
    setStagedItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  // Clear staged queue
  const handleClearStagedQueue = useCallback(() => {
    setStagedItems([]);
    setErrorState(null);
  }, []);

  // Load sample presets for 1-click testing
  const handleLoadPreset = useCallback((preset: "nominal" | "defective" | "pilot_5") => {
    setErrorState(null);
    if (preset === "nominal") {
      const file = createSampleFile("nominal", 1);
      const item: StagedItem = {
        id: `sample-clean-${Date.now()}`,
        file,
        previewUrl: URL.createObjectURL(file),
        presetType: "nominal",
      };
      setStagedItems([item]);
      setMode("single");
    } else if (preset === "defective") {
      const file = createSampleFile("defective", 1);
      const item: StagedItem = {
        id: `sample-defect-${Date.now()}`,
        file,
        previewUrl: URL.createObjectURL(file),
        presetType: "defective",
      };
      setStagedItems([item]);
      setMode("single");
    } else if (preset === "pilot_5") {
      const files = [
        createSampleFile("defective", 1),
        createSampleFile("defective", 2),
        createSampleFile("nominal", 3),
        createSampleFile("nominal", 4),
        createSampleFile("nominal", 5),
      ];
      const items: StagedItem[] = files.map((file, idx) => ({
        id: `batch-${Date.now()}-${idx}`,
        file,
        previewUrl: URL.createObjectURL(file),
        presetType: idx < 2 ? "defective" : "nominal",
      }));
      setStagedItems(items);
      setMode("batch");
    }
    setActiveStep(1);
  }, []);

  // Primary Dispatch Flow: Call backend classification and integrated pipeline if defective
  const handleDispatch = useCallback(async () => {
    if (stagedItems.length === 0) return;

    setIsDispatching(true);
    setActiveStep(2);
    setErrorState(null);

    try {
      if (mode === "single") {
        const singleFile = stagedItems[0].file;
        const result = await inspectSinglePhoto(singleFile, {
          useMockFallback: true,
        });

        setResultItems([result.item]);
        setSelectedIndex(0);
        setRawJson(result.rawJson);
        setActiveStep(3);
      } else {
        const files = stagedItems.map((item) => item.file);
        const result = await inspectBatchPhotos(files, {
          useMockFallback: true,
        });

        setResultItems(result.items);
        setSelectedIndex(0);
        setRawJson(result.rawJson);
        setGateDecision(result.gateDecision);
        setActiveStep(3);
      }
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
                  : "An unexpected error occurred communicating with inspection pipeline.",
              code: "DISPATCH_FAILED",
              retryable: true,
              timestamp: new Date().toLocaleTimeString(),
            };
      setErrorState(inspectionErr);
      setActiveStep(1);
    } finally {
      setIsDispatching(false);
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
    setStagedItems([]);
    setResultItems([]);
    setSelectedIndex(0);
    setRawJson(null);
    setErrorState(null);
    setActiveStep(1);
  }, []);

  // Quick-start sample when in idle state
  const handleQuickStart = useCallback(() => {
    handleLoadPreset("nominal");
  }, [handleLoadPreset]);

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
    <div className="min-h-screen bg-[#FAF8F5] text-[#1C1917] flex flex-col font-sans selection:bg-[#F3EFE6] selection:text-[#1C1917]">
      {/* Sleek Minimalist Header */}
      <LinenHeader
        onResetAll={handleResetAll}
        hasActiveInspection={resultItems.length > 0 || stagedItems.length > 0}
      />

      {/* Main Clean Workspace */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto flex flex-col lg:flex-row overflow-hidden">
        {/* Left Side (~36% width): Intake Station */}
        <section
          aria-label="Component intake"
          className="w-full lg:w-[38%] xl:w-[35%] min-h-[420px] lg:min-h-0 flex flex-col shrink-0"
        >
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
            onLoadPreset={handleLoadPreset}
            isDispatching={isDispatching}
            onDispatch={handleDispatch}
            activeStep={activeStep}
          />
        </section>

        {/* Right Side (~64% width): Inspection Report & JSON Output */}
        <section
          aria-label="Inspection results and report"
          className="flex-1 flex flex-col min-h-0 bg-[#FAF8F5]"
        >
          <LinenResults
            activeItem={activeItem}
            allItems={resultItems}
            selectedIndex={selectedIndex}
            onSelectIndex={setSelectedIndex}
            rawJson={rawJson}
            isLoading={isDispatching}
            isBatch={mode === "batch" || resultItems.length > 1}
            gateDecision={gateDecision}
            batchStats={resultItems.length > 0 ? batchStats : undefined}
            onLoadQuickSample={handleQuickStart}
            errorState={errorState}
            onRetry={handleRetryDispatch}
            onDismissError={handleDismissError}
          />
        </section>
      </main>
    </div>
  );
}
