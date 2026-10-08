"use client";

import React, { useState, useEffect, useCallback } from "react";
import { LinenHeader } from "@/components/linen/LinenHeader";
import { LinenIntake, StagedItem } from "@/components/linen/LinenIntake";
import { LinenResults } from "@/components/linen/LinenResults";
import {
  inspectSinglePhoto,
  inspectBatchPhotos,
  createSampleFile,
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

  const [useMockFallback, setUseMockFallback] = useState(false);
  const [serverOnline, setServerOnline] = useState(true);
  const [announcement, setAnnouncement] = useState("");

  const activeItem = resultItems[selectedIndex] || resultItems[0] || null;

  // Probe live backend server health on mount
  useEffect(() => {
    async function checkHealth() {
      try {
        const res = await fetch("http://82.112.231.102/health", {
          signal: AbortSignal.timeout(3000),
        });
        setServerOnline(res.ok);
      } catch {
        try {
          const proxyRes = await fetch("/api/classify?mock=OK", {
            method: "POST",
            signal: AbortSignal.timeout(3000),
          });
          setServerOnline(proxyRes.ok);
        } catch {
          setServerOnline(false);
        }
      }
    }
    checkHealth();
  }, []);

  // Handle adding files to staged intake queue
  const handleAddFiles = useCallback((files: File[]) => {
    const newItems: StagedItem[] = files.map((file, i) => ({
      id: `staged-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
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
    setAnnouncement(
      mode === "single"
        ? `Staged component image: ${files[0].name}`
        : `Staged ${files.length} images for batch inspection.`
    );
  }, [mode]);

  // Remove individual staged file
  const handleRemoveStagedItem = useCallback((id: string) => {
    setStagedItems((prev) => prev.filter((item) => item.id !== id));
    setAnnouncement("Removed item from intake staging queue.");
  }, []);

  // Clear staged queue
  const handleClearStagedQueue = useCallback(() => {
    setStagedItems([]);
    setAnnouncement("Intake staging queue cleared.");
  }, []);

  // Load sample presets for 1-click testing
  const handleLoadPreset = useCallback((preset: "nominal" | "defective" | "pilot_5") => {
    if (preset === "nominal") {
      const file = createSampleFile("nominal", 1);
      const item: StagedItem = {
        id: `staged-preset-${Date.now()}`,
        file,
        previewUrl: URL.createObjectURL(file),
        presetType: "nominal",
      };
      setStagedItems([item]);
      setMode("single");
      setAnnouncement("Loaded nominal sample part into intake.");
    } else if (preset === "defective") {
      const file = createSampleFile("defective", 1);
      const item: StagedItem = {
        id: `staged-preset-${Date.now()}`,
        file,
        previewUrl: URL.createObjectURL(file),
        presetType: "defective",
      };
      setStagedItems([item]);
      setMode("single");
      setAnnouncement("Loaded defective sample part into intake.");
    } else if (preset === "pilot_5") {
      const files = [
        createSampleFile("defective", 1),
        createSampleFile("defective", 2),
        createSampleFile("nominal", 3),
        createSampleFile("nominal", 4),
        createSampleFile("nominal", 5),
      ];
      const items: StagedItem[] = files.map((file, idx) => ({
        id: `staged-preset-batch-${Date.now()}-${idx}`,
        file,
        previewUrl: URL.createObjectURL(file),
        presetType: idx < 2 ? "defective" : "nominal",
      }));
      setStagedItems(items);
      setMode("batch");
      setAnnouncement("Loaded 5 calibrated sample parts for pilot batch inspection.");
    }
    setActiveStep(1);
  }, []);

  // Primary Dispatch Flow: Call backend models and hand off images
  const handleDispatch = useCallback(async () => {
    if (stagedItems.length === 0) return;

    setIsDispatching(true);
    setActiveStep(2);
    setAnnouncement(
      mode === "single"
        ? "Handing off component to backend model at 82.112.231.102…"
        : `Handing off batch of ${stagedItems.length} parts to backend model…`
    );

    try {
      if (mode === "single") {
        const singleFile = stagedItems[0].file;
        const result = await inspectSinglePhoto(singleFile, {
          mockState: useMockFallback ? "DEFECTIVE" : undefined,
        });

        setResultItems([result.item]);
        setSelectedIndex(0);
        setRawJson(result.rawJson);
        setActiveStep(3);
        setAnnouncement(
          `Model classification returned: ${result.item.status}. Latency: ${result.latencyMs} ms.`
        );
      } else {
        const files = stagedItems.map((item) => item.file);
        const result = await inspectBatchPhotos(files, {
          mockState: useMockFallback ? "DEFECTIVE" : undefined,
        });

        setResultItems(result.items);
        setSelectedIndex(0);
        setRawJson(result.rawJson);
        setGateDecision(result.gateDecision);
        setActiveStep(3);
        setAnnouncement(
          `Batch inspection complete. Decision: ${result.gateDecision}. ${result.defectsCount} defects found.`
        );
      }
    } catch (err) {
      console.error("Model dispatch failed:", err);
      setAnnouncement("Model dispatch encountered an error. Applied resilient fallback.");
    } finally {
      setIsDispatching(false);
    }
  }, [stagedItems, mode, useMockFallback]);

  // Reset entire flow
  const handleResetAll = useCallback(() => {
    setStagedItems([]);
    setResultItems([]);
    setSelectedIndex(0);
    setRawJson(null);
    setActiveStep(1);
    setAnnouncement("Inspection flow reset to initial intake state.");
  }, []);

  // Quick-start sample when in idle state
  const handleQuickStart = useCallback(() => {
    handleLoadPreset("defective");
  }, [handleLoadPreset]);

  // Arrow key scrubbing between batch parts
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
    <div className="min-h-screen bg-[#FAF8F5] text-[#1C1917] flex flex-col font-sans selection:bg-[#FCE7D8] selection:text-[#7C2D12]">
      {/* Skip Navigation Link for Keyboard Accessibility */}
      <a
        href="#main-linen-flow"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 z-50 px-3.5 py-2 bg-[#1C1917] text-[#FAF8F5] font-mono text-xs font-semibold rounded-lg shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A3412]"
      >
        Skip to inspection flow
      </a>

      {/* Screen Reader Live Region for Async Batch Updates */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      {/* Warm Linen Minimalist Header */}
      <LinenHeader
        useMockFallback={useMockFallback}
        onToggleMockFallback={() => setUseMockFallback(!useMockFallback)}
        onResetAll={handleResetAll}
        serverOnline={serverOnline}
      />

      {/* Main Two-Column Progressive Flow Workspace */}
      <main
        id="main-linen-flow"
        className="flex-1 max-w-[1900px] w-full mx-auto flex flex-col lg:flex-row overflow-hidden"
      >
        {/* Left Side (~38% width): Intake & Model Hand-Off Station */}
        <section
          aria-label="Component intake station"
          className="w-full lg:w-[40%] xl:w-[36%] min-h-[460px] lg:min-h-0 flex flex-col shrink-0"
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

        {/* Right Side (~62% width): Model Execution, Returned JSON & Output */}
        <section
          aria-label="Model inspection results and JSON output"
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
          />
        </section>
      </main>
    </div>
  );
}
