"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { LinenHeader } from "@/components/linen/LinenHeader";
import { LinenIntake, StagedItem } from "@/components/linen/LinenIntake";
import { LinenResults } from "@/components/linen/LinenResults";
import {
  inspectSinglePhoto,
  InspectionError,
} from "@/lib/api";
import { InspectionItem } from "@/lib/inspection-adapter";

export default function QualityInspectionDashboard() {
  const [mode, setMode] = useState<"single" | "batch">("single");
  const [stagedItems, setStagedItems] = useState<StagedItem[]>([]);
  const [isDispatching, setIsDispatching] = useState(false);
  const [currentProcessingIndex, setCurrentProcessingIndex] = useState<number>(-1);
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);

  const [resultItems, setResultItems] = useState<InspectionItem[]>([]);
  const [rawJsons, setRawJsons] = useState<(Record<string, unknown> | null)[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [gateDecision, setGateDecision] = useState<"GO" | "ADJUST" | "CRITICAL STOP">("GO");
  const [errorState, setErrorState] = useState<InspectionError | null>(null);

  const cancelProcessingRef = useRef(false);

  const activeItem = resultItems[selectedIndex] || resultItems[0] || null;
  const activeRawJson = rawJsons[selectedIndex] || null;

  // Handle adding files to staged intake queue
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

  // Primary Dispatch Flow: Process sequentially one by one in batch mode
  const handleDispatch = useCallback(async () => {
    if (stagedItems.length === 0) return;

    setIsDispatching(true);
    setActiveStep(2);
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
      // BATCH MODE: Process one by one sequentially!
      // Mark all items as queued initially
      setStagedItems((prev) =>
        prev.map((item) => ({ ...item, status: "queued", verdict: undefined }))
      );
      setResultItems([]);
      setRawJsons([]);
      setSelectedIndex(0);

      const itemsToProcess = [...stagedItems];
      const collectedResults: InspectionItem[] = [];
      const collectedJsons: (Record<string, unknown> | null)[] = [];

      for (let i = 0; i < itemsToProcess.length; i++) {
        if (cancelProcessingRef.current) break;

        setCurrentProcessingIndex(i);
        setStagedItems((prev) =>
          prev.map((item, idx) => (idx === i ? { ...item, status: "processing" } : item))
        );

        try {
          const file = itemsToProcess[i].file;
          const result = await inspectSinglePhoto(file, {
            useMockFallback: true,
          });

          if (cancelProcessingRef.current) break;

          collectedResults.push(result.item);
          collectedJsons.push(result.rawJson);

          // Real-time update: Output shows immediately as each part is processed!
          setResultItems([...collectedResults]);
          setRawJsons([...collectedJsons]);
          setSelectedIndex(collectedResults.length - 1);
          setActiveStep(3);

          const anyDefective = collectedResults.some((it) => it.status === "DEFECTIVE");
          const anyCritical = collectedResults.some(
            (it) => it.status === "DEFECTIVE" && (it.severity === "Critical" || it.confidenceScore >= 90)
          );
          const currentDecision =
            anyCritical || collectedResults.filter((it) => it.status === "DEFECTIVE").length > 1
              ? "CRITICAL STOP"
              : anyDefective
              ? "ADJUST"
              : "GO";
          setGateDecision(currentDecision);

          setStagedItems((prev) =>
            prev.map((item, idx) =>
              idx === i
                ? {
                    ...item,
                    status: "completed",
                    verdict: result.item.status === "DEFECTIVE" ? "defective" : "ok",
                  }
                : item
            )
          );

          // Subtle micro-delay (300ms) between items for smooth flow perception
          if (i < itemsToProcess.length - 1 && !cancelProcessingRef.current) {
            await new Promise((res) => setTimeout(res, 300));
          }
        } catch (err) {
          console.error(`Item ${i + 1} processing failed:`, err);
          setStagedItems((prev) =>
            prev.map((item, idx) => (idx === i ? { ...item, status: "error" } : item))
          );
        }
      }

      setCurrentProcessingIndex(-1);
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

      {/* Main Clean Workspace: Locked Left Station, Independently Scrolling Right Area */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto flex flex-col lg:flex-row min-h-0 lg:overflow-hidden">
        {/* Left Side: Intake Station (Locked layout) */}
        <section
          aria-label="Component intake"
          className="w-full lg:w-[380px] xl:w-[420px] shrink-0 border-b lg:border-b-0 lg:border-r border-[#EAE4D7] bg-[#FAF8F5] lg:h-full flex flex-col overflow-hidden"
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
          />
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
