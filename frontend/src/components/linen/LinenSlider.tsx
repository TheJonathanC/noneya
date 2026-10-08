"use client";

import React, { useState, useRef, useEffect, MouseEvent, TouchEvent } from "react";
import Image from "next/image";
import {
  Crosshair,
  Scan,
  SlidersHorizontal,
  Flame,
} from "lucide-react";
import { InspectionItem } from "@/lib/inspection-adapter";
import { Badge } from "@/components/ui/badge";

interface LinenSliderProps {
  item: InspectionItem;
}

export function LinenSlider({ item }: LinenSliderProps) {
  const [sliderPosition, setSliderPosition] = useState(50); // 0 to 100%
  const [isDragging, setIsDragging] = useState(false);
  const [showReticle, setShowReticle] = useState(true);
  const [viewMode, setViewMode] = useState<"curtain" | "blend" | "side-by-side">("curtain");
  const [blendOpacity, setBlendOpacity] = useState(70);

  const containerRef = useRef<HTMLDivElement>(null);
  const isDefective = item.status === "DEFECTIVE";

  // Handle position update from client coordinate
  const updatePosition = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.min(Math.max((x / rect.width) * 100, 0), 100);
    setSliderPosition(Math.round(percentage * 10) / 10);
  };

  const handleMouseDown = (e: MouseEvent) => {
    setIsDragging(true);
    updatePosition(e.clientX);
  };

  const handleTouchStart = (e: TouchEvent) => {
    setIsDragging(true);
    if (e.touches[0]) updatePosition(e.touches[0].clientX);
  };

  const handleSliderKeyDown = (e: React.KeyboardEvent) => {
    if (viewMode !== "curtain") return;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      setSliderPosition((prev) => Math.max(0, Math.round((prev - (e.shiftKey ? 10 : 2)) * 10) / 10));
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      setSliderPosition((prev) => Math.min(100, Math.round((prev + (e.shiftKey ? 10 : 2)) * 10) / 10));
    } else if (e.key === "Home") {
      e.preventDefault();
      setSliderPosition(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setSliderPosition(100);
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: globalThis.MouseEvent) => {
      if (!isDragging) return;
      updatePosition(e.clientX);
    };

    const handleTouchMove = (e: globalThis.TouchEvent) => {
      if (!isDragging || !e.touches[0]) return;
      updatePosition(e.touches[0].clientX);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      window.addEventListener("touchmove", handleTouchMove);
      window.addEventListener("touchend", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div className="flex flex-col bg-[#FFFFFF] border border-[#E5DFD3] rounded-2xl overflow-hidden shadow-xs">
      {/* Top Inspection Stage Toolbar */}
      <div className="px-4 py-3 bg-[#F7F4EC] border-b border-[#E6E0D3] flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        {/* Left: Reticle Status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[#1C1917] font-semibold">
            <Scan aria-hidden="true" className="w-4 h-4 text-[#9A3412]" />
            <span>VISUAL ANOMALY RETICLE</span>
          </div>

          <Badge variant={isDefective ? "defective" : "nominal"} size="sm" dot>
            {isDefective ? `HEATMAP: ${item.defectType.toUpperCase()}` : "SURFACE NOMINAL"}
          </Badge>

          {isDefective && item.anomalyCoordinate && (
            <span className="text-[11px] text-[#78716A] hidden sm:inline tabular-nums">
              FOCUS: X:{(item.anomalyCoordinate.xPercent * 8).toFixed(0)}px Y:
              {(item.anomalyCoordinate.yPercent * 6).toFixed(0)}px
            </span>
          )}
        </div>

        {/* Right: Controls & Modes */}
        <div className="flex items-center gap-2.5">
          {/* Mode Switcher */}
          <div
            role="tablist"
            aria-label="Inspection display modes"
            className="flex items-center bg-[#ECE6DA] border border-[#DDD5C7] rounded-lg p-0.5 text-[11px]"
          >
            <button
              role="tab"
              type="button"
              aria-selected={viewMode === "curtain"}
              aria-controls="linen-inspection-viewport"
              onClick={() => setViewMode("curtain")}
              className={`px-2.5 py-1 rounded-md transition-[background-color,color,box-shadow,transform] duration-150 active:scale-[0.97] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A3412] ${
                viewMode === "curtain"
                  ? "bg-[#FFFFFF] text-[#1C1917] font-bold shadow-xs"
                  : "text-[#78716A] hover:text-[#1C1917]"
              }`}
            >
              Split Curtain
            </button>
            <button
              role="tab"
              type="button"
              aria-selected={viewMode === "blend"}
              aria-controls="linen-inspection-viewport"
              onClick={() => setViewMode("blend")}
              className={`px-2.5 py-1 rounded-md transition-[background-color,color,box-shadow,transform] duration-150 active:scale-[0.97] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A3412] ${
                viewMode === "blend"
                  ? "bg-[#FFFFFF] text-[#1C1917] font-bold shadow-xs"
                  : "text-[#78716A] hover:text-[#1C1917]"
              }`}
            >
              Blend Heatmap
            </button>
            <button
              role="tab"
              type="button"
              aria-selected={viewMode === "side-by-side"}
              aria-controls="linen-inspection-viewport"
              onClick={() => setViewMode("side-by-side")}
              className={`px-2.5 py-1 rounded-md transition-[background-color,color,box-shadow,transform] duration-150 active:scale-[0.97] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A3412] ${
                viewMode === "side-by-side"
                  ? "bg-[#FFFFFF] text-[#1C1917] font-bold shadow-xs"
                  : "text-[#78716A] hover:text-[#1C1917]"
              }`}
            >
              Dual View
            </button>
          </div>

          {/* Toggle Crosshairs Reticle */}
          <button
            type="button"
            onClick={() => setShowReticle(!showReticle)}
            aria-pressed={showReticle}
            aria-label="Toggle calibrated crosshairs reticle"
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.97] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A3412] ${
              showReticle
                ? "bg-[#FFFFFF] border-[#D6CEBF] text-[#9A3412] shadow-xs font-semibold"
                : "border-[#E4DDD1] text-[#78716A] hover:text-[#1C1917] bg-transparent"
            }`}
            title="Toggle calibrated crosshairs reticle"
          >
            <Crosshair aria-hidden="true" className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reticle</span>
          </button>
        </div>
      </div>

      {/* Main Image Stage on Clean Linen Canvas */}
      <div className="relative p-3.5 bg-[#F9F7F2]">
        {/* SIDE BY SIDE MODE */}
        {viewMode === "side-by-side" ? (
          <div id="linen-inspection-viewport" className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* Raw Feed */}
            <div className="relative aspect-[4/3] rounded-xl overflow-hidden border border-[#E5DFD3] bg-[#0E1017] shadow-xs">
              <Image
                src={item.rawImageUrl}
                alt={`Raw optical capture for part ${item.partId}`}
                fill
                priority
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-contain"
                unoptimized
              />
              <div className="absolute top-2.5 left-2.5 px-2 py-0.5 bg-[#1C1917]/80 backdrop-blur-xs rounded text-[10px] font-mono text-[#FAF8F5]">
                RAW OPTICAL CAPTURE
              </div>
            </div>

            {/* Grad-CAM Feed */}
            <div className="relative aspect-[4/3] rounded-xl overflow-hidden border border-[#E5DFD3] bg-[#0E1017] shadow-xs">
              <Image
                src={item.heatmapImageUrl}
                alt={`Grad-CAM thermal defect heatmap for part ${item.partId}`}
                fill
                priority
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-contain"
                unoptimized
              />
              <div className="absolute top-2.5 left-2.5 px-2 py-0.5 bg-[#1C1917]/80 backdrop-blur-xs rounded text-[10px] font-mono text-[#FDBA74] flex items-center gap-1">
                <Flame aria-hidden="true" className="w-3 h-3 text-[#FB7185]" />
                GRAD-CAM THERMAL LOCALIZATION
              </div>
            </div>
          </div>
        ) : (
          /* CURTAIN SPLIT OR BLEND MODE */
          <div
            id="linen-inspection-viewport"
            ref={containerRef}
            role={viewMode === "curtain" ? "slider" : undefined}
            tabIndex={viewMode === "curtain" ? 0 : undefined}
            aria-label={viewMode === "curtain" ? "Inspection curtain split comparison" : undefined}
            aria-valuenow={viewMode === "curtain" ? sliderPosition : undefined}
            aria-valuemin={viewMode === "curtain" ? 0 : undefined}
            aria-valuemax={viewMode === "curtain" ? 100 : undefined}
            onKeyDown={handleSliderKeyDown}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            className={`relative w-full aspect-[4/3] max-h-[500px] rounded-xl overflow-hidden border border-[#E5DFD3] bg-[#0E1017] select-none shadow-xs ${
              viewMode === "curtain"
                ? "cursor-ew-resize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A3412]"
                : "cursor-default"
            }`}
          >
            {/* Base Image: Raw Component Feed */}
            <div className="absolute inset-0">
              <Image
                src={item.rawImageUrl}
                alt={`Raw optical capture for part ${item.partId}`}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 65vw"
                className="object-contain pointer-events-none"
                unoptimized
              />
            </div>

            {/* Overlay Image: Grad-CAM Thermal Map */}
            {viewMode === "curtain" ? (
              <div
                className="absolute inset-0 overflow-hidden pointer-events-none"
                style={{
                  clipPath: `polygon(${sliderPosition}% 0, 100% 0, 100% 100%, ${sliderPosition}% 100%)`,
                }}
              >
                <Image
                  src={item.heatmapImageUrl}
                  alt={`Grad-CAM thermal overlay for part ${item.partId}`}
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 65vw"
                  className="object-contain"
                  unoptimized
                />
              </div>
            ) : (
              <div
                className="absolute inset-0 pointer-events-none transition-opacity duration-150"
                style={{ opacity: blendOpacity / 100 }}
              >
                <Image
                  src={item.heatmapImageUrl}
                  alt={`Grad-CAM thermal overlay for part ${item.partId}`}
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 65vw"
                  className="object-contain"
                  unoptimized
                />
              </div>
            )}

            {/* Curtain Dividing Bar & Scrub Handle */}
            {viewMode === "curtain" && (
              <div
                className="absolute top-0 bottom-0 pointer-events-none flex items-center justify-center"
                style={{ left: `${sliderPosition}%`, transform: "translateX(-50%)" }}
              >
                {/* Vertical Terracotta Divider Line */}
                <div className="w-[2px] h-full bg-[#EA580C] shadow-[0_0_8px_rgba(234,88,12,0.8)]" />

                {/* Tactile Grab Handle */}
                <div className="absolute w-8 h-8 rounded-full bg-[#FFFFFF] border-2 border-[#EA580C] shadow-md flex items-center justify-center text-[#EA580C]">
                  <div className="flex gap-0.5" aria-hidden="true">
                    <div className="w-0.5 h-3 bg-[#EA580C] rounded-full" />
                    <div className="w-0.5 h-3 bg-[#EA580C] rounded-full" />
                  </div>
                </div>
              </div>
            )}

            {/* Crosshair Target Reticle Overlay */}
            {showReticle && isDefective && item.anomalyCoordinate && (
              <div
                aria-hidden="true"
                className="absolute pointer-events-none transition-[left,top] duration-200 ease-out"
                style={{
                  left: `${item.anomalyCoordinate.xPercent}%`,
                  top: `${item.anomalyCoordinate.yPercent}%`,
                  transform: "translate(-50%, -50%)",
                }}
              >
                {/* Pulsing Target Ring */}
                <div className="relative flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full border border-rose-500/70 animate-ping motion-reduce:animate-none absolute" />
                  <div className="w-12 h-12 rounded-full border border-rose-400 bg-rose-500/15 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-rose-500" />
                  </div>

                  {/* Crosshair Spikes */}
                  <div className="absolute w-20 h-[1px] bg-rose-400/80" />
                  <div className="absolute h-20 w-[1px] bg-rose-400/80" />
                </div>
              </div>
            )}

            {/* HUD Status Badges inside Viewport */}
            <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none font-mono text-[10px]">
              <div className="px-2 py-1 bg-[#1C1917]/85 backdrop-blur-xs rounded text-slate-200">
                RAW OPTICAL (LEFT)
              </div>
              {viewMode === "curtain" && (
                <div className="px-2 py-1 bg-[#1C1917]/85 backdrop-blur-xs rounded text-[#FDBA74] flex items-center gap-1">
                  <Flame aria-hidden="true" className="w-3 h-3 text-[#FB7185]" />
                  GRAD-CAM (RIGHT)
                </div>
              )}
            </div>

            {/* Bottom Slider Position HUD */}
            <div className="absolute bottom-3 right-3 pointer-events-none font-mono text-[10px]">
              {viewMode === "curtain" ? (
                <div className="px-2.5 py-1 bg-[#1C1917]/85 backdrop-blur-xs rounded text-slate-300 flex items-center gap-2">
                  <span>SPLIT CURTAIN:</span>
                  <span className="text-[#FDBA74] font-bold tabular-nums">{sliderPosition}%</span>
                </div>
              ) : (
                <div className="px-2.5 py-1 bg-[#1C1917]/85 backdrop-blur-xs rounded text-slate-300 flex items-center gap-2">
                  <span>OVERLAY OPACITY:</span>
                  <span className="text-[#FDBA74] font-bold tabular-nums">{blendOpacity}%</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Blend Opacity Slider Control (in Blend mode) */}
        {viewMode === "blend" && (
          <div className="mt-3 px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E5DFD3] rounded-xl flex items-center gap-4 text-xs font-mono">
            <label htmlFor="linen-heatmap-density-slider" className="text-[#57534E] shrink-0 flex items-center gap-1.5 cursor-pointer font-medium">
              <SlidersHorizontal aria-hidden="true" className="w-3.5 h-3.5 text-[#9A3412]" />
              HEATMAP DENSITY:
            </label>
            <input
              id="linen-heatmap-density-slider"
              type="range"
              min="0"
              max="100"
              aria-label="Heatmap blend density percentage"
              value={blendOpacity}
              onChange={(e) => setBlendOpacity(Number(e.target.value))}
              className="flex-1 accent-[#C2410C] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A3412] rounded"
            />
            <span className="text-[#9A3412] font-bold w-12 text-right tabular-nums">{blendOpacity}%</span>
          </div>
        )}
      </div>

      {/* Frame Diagnostic Status Bar */}
      <div className="px-4 py-2.5 bg-[#F7F4EC] border-t border-[#E6E0D3] flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-[#78716A]">
        <div className="flex items-center gap-3">
          <span>PART ID: <strong className="text-[#1C1917]">{item.partId}</strong></span>
          <span className="text-[#D6CEBF]" aria-hidden="true">•</span>
          <span>SN: <strong className="text-[#1C1917]">{item.serialNumber}</strong></span>
          <span className="text-[#D6CEBF]" aria-hidden="true">•</span>
          <span>CONFIDENCE: <strong className="text-[#9A3412] tabular-nums">{item.confidenceScore.toFixed(1)}%</strong></span>
        </div>

        <div className="text-[11px] text-[#78716A]">
          SCAN TIME: <span className="text-[#1C1917] tabular-nums">{item.timestamp}</span>
        </div>
      </div>
    </div>
  );
}
