"use client";

import React, { useState, useEffect, useCallback } from "react";
import { StationHeader } from "@/components/inspection/StationHeader";
import { BatchReel } from "@/components/inspection/BatchReel";
import { AnomalySlider } from "@/components/inspection/AnomalySlider";
import { TelemetryDeltaPanel } from "@/components/inspection/TelemetryDeltaPanel";
import { RootCauseDossier } from "@/components/inspection/RootCauseDossier";
import {
  InspectionItem,
  MOCK_INSPECTION_ITEMS,
  calculateStationStats,
} from "@/lib/inspection-adapter";
import { runBatchInspection } from "@/lib/api";
import { RotateCcw, Scan } from "lucide-react";

export default function QualityInspectionDashboard() {
  const [items, setItems] = useState<InspectionItem[]>(() => MOCK_INSPECTION_ITEMS.slice(0, 5));
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [sampleSize, setSampleSize] = useState(5);
  const [isRunning, setIsRunning] = useState(false);
  const [useMockFallback, setUseMockFallback] = useState(true);

  const selectedItem = items[selectedIndex] || items[0] || null;
  const stats = calculateStationStats(items);

  // Screen reader announcer message for batch operations
  const [announcement, setAnnouncement] = useState("");

  // Run or refresh inspection batch
  const handleRunBatch = useCallback(async () => {
    setIsRunning(true);
    setAnnouncement(`Initiating inspection batch with sample size of ${sampleSize} parts.`);
    try {
      const result = await runBatchInspection([], sampleSize, {
        useMockFallback,
      });
      setItems(result.items);
      setSelectedIndex(0);
      setAnnouncement(`Batch scan complete. Inspected ${result.items.length} parts.`);
    } catch (err) {
      console.error("Batch inspection failed:", err);
      setAnnouncement("Batch inspection encountered an error.");
    } finally {
      setIsRunning(false);
    }
  }, [sampleSize, useMockFallback]);

  // Handle uploaded images from operator
  const handleUploadFiles = useCallback(
    async (files: File[]) => {
      setIsRunning(true);
      setAnnouncement(`Processing ${files.length} uploaded component captures.`);
      try {
        const result = await runBatchInspection(files, Math.max(files.length, sampleSize), {
          useMockFallback,
        });
        setItems(result.items);
        setSelectedIndex(0);
        setAnnouncement(`Upload analysis complete. ${result.items.length} components evaluated.`);
      } catch (err) {
        console.error("Upload inspection failed:", err);
        setAnnouncement("Upload analysis encountered an error.");
      } finally {
        setIsRunning(false);
      }
    },
    [sampleSize, useMockFallback]
  );

  // Remove individual item from the inspection queue
  const handleRemoveItem = useCallback((id: string) => {
    setItems((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) {
        setAnnouncement(`Removed part ${target.partId} from queue.`);
      }
      const nextItems = prev.filter((item) => item.id !== id);
      return nextItems;
    });
    setSelectedIndex((prev) => Math.max(0, prev > 0 ? prev - 1 : 0));
  }, []);

  // Clear all items from queue
  const handleClearQueue = useCallback(() => {
    setItems([]);
    setSelectedIndex(0);
    setAnnouncement("Inspection queue cleared.");
  }, []);

  // Restore default sample lot
  const handleResetQueue = useCallback(() => {
    setItems(MOCK_INSPECTION_ITEMS.slice(0, sampleSize));
    setSelectedIndex(0);
    setAnnouncement(`Sample lot restored with ${sampleSize} parts.`);
  }, [sampleSize]);

  // Micro-interaction: Keyboard frame scrubbing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0));
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [items.length]);

  return (
    <div className="min-h-screen bg-[#0A0B0E] text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Skip Navigation Link for Keyboard Accessibility */}
      <a
        href="#main-terminal-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 z-50 px-3 py-1.5 bg-cyan-500 text-[#090C12] font-mono text-xs font-bold rounded shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
      >
        Skip to inspection terminal
      </a>

      {/* Screen Reader Live Region for Async Batch Updates */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      {/* 1. Operational Header */}
      <StationHeader
        stats={stats}
        sampleSize={sampleSize}
        onSampleSizeChange={setSampleSize}
        isRunning={isRunning}
        onRunBatch={handleRunBatch}
        useMockFallback={useMockFallback}
        onToggleMockFallback={() => setUseMockFallback(!useMockFallback)}
      />

      {/* Main Terminal Workspace Layout */}
      <main id="main-terminal-content" className="flex-1 max-w-[1800px] w-full mx-auto flex flex-col lg:flex-row overflow-hidden">
        {/* 2. Part Inspection Queue (~35% width) */}
        <section aria-label="Component queue" className="w-full lg:w-[35%] xl:w-[32%] min-h-[400px] lg:min-h-0 flex flex-col shrink-0">
          <BatchReel
            items={items}
            selectedItem={selectedItem}
            onSelectItem={(item) => {
              const idx = items.findIndex((i) => i.id === item.id);
              if (idx !== -1) setSelectedIndex(idx);
            }}
            onUploadFiles={handleUploadFiles}
            onRemoveItem={handleRemoveItem}
            onClearQueue={handleClearQueue}
            onResetQueue={handleResetQueue}
            isLoading={isRunning}
          />
        </section>

        {/* 3. Deep Diagnostics Stage (~65% width) */}
        <section aria-label="Component diagnostics stage" className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-6 bg-[#0A0B0E]">
          {selectedItem ? (
            <>
              {/* Visual Anomaly Reticle with Split Curtain Slider */}
              <div className="w-full">
                <AnomalySlider item={selectedItem} />
              </div>

              {/* Bottom Twin Diagnostic Stage */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
                {/* Telemetry Anomaly Panel */}
                <div className="min-h-[340px]">
                  <TelemetryDeltaPanel telemetry={selectedItem.telemetry} />
                </div>

                {/* Root Cause & Action Dossier */}
                <div className="min-h-[340px]">
                  <RootCauseDossier item={selectedItem} />
                </div>
              </div>
            </>
          ) : (
            <div className="h-full min-h-[480px] flex flex-col items-center justify-center p-12 text-slate-500 font-mono text-xs border border-dashed border-[#1F2430] rounded-2xl bg-[#0D0F16] text-center gap-4">
              <div className="p-4 rounded-full bg-[#141724] border border-[#23293D] text-cyan-400">
                <Scan aria-hidden="true" className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <div className="text-sm font-semibold text-slate-200 text-balance">
                  No Component Active for Diagnostic Stage
                </div>
                <p className="text-slate-500 max-w-md text-xs text-balance">
                  The inspection queue is currently empty. Drop component captures into the intake
                  zone or restore the sample batch.
                </p>
              </div>
              <button
                onClick={handleResetQueue}
                type="button"
                aria-label={`Restore sample lot with ${sampleSize} parts`}
                className="px-4 py-2 rounded-lg border border-cyan-500/40 bg-cyan-950/30 text-cyan-300 hover:bg-cyan-950/50 text-xs font-semibold flex items-center gap-2 transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.97] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0D0F16]"
              >
                <RotateCcw aria-hidden="true" className="w-3.5 h-3.5" />
                <span>Restore Sample Lot ({sampleSize} Parts)</span>
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
