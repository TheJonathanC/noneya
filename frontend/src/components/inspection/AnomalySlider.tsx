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

interface AnomalySliderProps {
  item: InspectionItem;
}

export function AnomalySlider({ item }: AnomalySliderProps) {
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
    <div className="flex flex-col bg-[#12141C] border border-[#1F2430] rounded-xl overflow-hidden shadow-2xl">
      {/* Top Inspection Stage Toolbar */}
      <div className="px-4 py-2.5 bg-[#161924] border-b border-[#1F2430] flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        {/* Left: Reticle Status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-slate-200 font-semibold">
            <Scan className="w-4 h-4 text-cyan-400" />
            <span>VISUAL ANOMALY RETICLE</span>
          </div>

          <Badge variant={isDefective ? "defective" : "nominal"} size="sm" dot>
            {isDefective ? `HEATMAP: ${item.defectType.toUpperCase()}` : "SURFACE NOMINAL"}
          </Badge>

          {isDefective && item.anomalyCoordinate && (
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              FOCUS: X:{(item.anomalyCoordinate.xPercent * 8).toFixed(0)}px Y:
              {(item.anomalyCoordinate.yPercent * 6).toFixed(0)}px
            </span>
          )}
        </div>

        {/* Right: Controls & Modes */}
        <div className="flex items-center gap-3">
          {/* Mode Switcher */}
          <div className="flex items-center bg-[#0E1017] border border-[#232938] rounded-md p-0.5 text-[11px]">
            <button
              onClick={() => setViewMode("curtain")}
              className={`px-2 py-0.5 rounded transition-colors ${
                viewMode === "curtain"
                  ? "bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Split Curtain
            </button>
            <button
              onClick={() => setViewMode("blend")}
              className={`px-2 py-0.5 rounded transition-colors ${
                viewMode === "blend"
                  ? "bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Blend Heatmap
            </button>
            <button
              onClick={() => setViewMode("side-by-side")}
              className={`px-2 py-0.5 rounded transition-colors ${
                viewMode === "side-by-side"
                  ? "bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Dual View
            </button>
          </div>

          {/* Toggle Crosshairs Reticle */}
          <button
            onClick={() => setShowReticle(!showReticle)}
            className={`flex items-center gap-1 px-2 py-1 rounded border text-[11px] transition-colors cursor-pointer ${
              showReticle
                ? "bg-slate-800 border-cyan-500/40 text-cyan-300"
                : "border-[#262D3D] text-slate-500 hover:text-slate-300"
            }`}
            title="Toggle calibrated crosshairs reticle"
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reticle</span>
          </button>
        </div>
      </div>

      {/* Main Image Stage */}
      <div className="relative p-3 bg-[#090B0F]">
        {/* SIDE BY SIDE MODE */}
        {viewMode === "side-by-side" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Raw Feed */}
            <div className="relative aspect-[4/3] rounded-lg overflow-hidden border border-[#1F2430] bg-[#0A0C10]">
              <Image
                src={item.rawImageUrl}
                alt="Raw Component Feed"
                fill
                className="object-contain"
                unoptimized
              />
              <div className="absolute top-2 left-2 px-2 py-0.5 bg-[#0A0D14]/85 border border-[#1F2430] rounded text-[10px] font-mono text-slate-300">
                RAW OPTICAL CAPTURE
              </div>
            </div>

            {/* Grad-CAM Feed */}
            <div className="relative aspect-[4/3] rounded-lg overflow-hidden border border-[#1F2430] bg-[#0A0C10]">
              <Image
                src={item.heatmapImageUrl}
                alt="Grad-CAM Thermal Defect Heatmap"
                fill
                className="object-contain"
                unoptimized
              />
              <div className="absolute top-2 left-2 px-2 py-0.5 bg-[#0A0D14]/85 border border-[#1F2430] rounded text-[10px] font-mono text-cyan-300 flex items-center gap-1">
                <Flame className="w-3 h-3 text-rose-400" />
                GRAD-CAM THERMAL LOCALIZATION
              </div>
            </div>
          </div>
        ) : (
          /* CURTAIN SPLIT OR BLEND MODE */
          <div
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            className={`relative w-full aspect-[4/3] max-h-[520px] rounded-lg overflow-hidden border border-[#1F2430] bg-[#0A0C10] select-none ${
              viewMode === "curtain" ? "cursor-ew-resize" : "cursor-default"
            }`}
          >
            {/* Base Image: Raw Component Feed */}
            <div className="absolute inset-0">
              <Image
                src={item.rawImageUrl}
                alt="Raw Component Feed"
                fill
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
                  alt="Grad-CAM Thermal Map"
                  fill
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
                  alt="Grad-CAM Thermal Map"
                  fill
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
                {/* Vertical Laser Divider Line */}
                <div className="w-[2px] h-full bg-cyan-400 shadow-[0_0_8px_#00F0FF]" />

                {/* Tactile Grab Handle */}
                <div className="absolute w-8 h-8 rounded-full bg-[#0D1017] border-2 border-cyan-400 shadow-[0_0_12px_rgba(0,240,255,0.6)] flex items-center justify-center text-cyan-300">
                  <div className="flex gap-0.5">
                    <div className="w-0.5 h-3 bg-cyan-400 rounded-full" />
                    <div className="w-0.5 h-3 bg-cyan-400 rounded-full" />
                  </div>
                </div>
              </div>
            )}

            {/* Crosshair Target Reticle Overlay */}
            {showReticle && isDefective && item.anomalyCoordinate && (
              <div
                className="absolute pointer-events-none transition-all duration-200"
                style={{
                  left: `${item.anomalyCoordinate.xPercent}%`,
                  top: `${item.anomalyCoordinate.yPercent}%`,
                  transform: "translate(-50%, -50%)",
                }}
              >
                {/* Pulsing Target Ring */}
                <div className="relative flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full border border-rose-500/60 animate-ping absolute" />
                  <div className="w-12 h-12 rounded-full border border-rose-400 bg-rose-500/10 flex items-center justify-center">
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
              <div className="px-2 py-1 bg-[#090C12]/90 border border-[#1F2430] rounded backdrop-blur-xs text-slate-300">
                RAW OPTICAL (LEFT)
              </div>
              {viewMode === "curtain" && (
                <div className="px-2 py-1 bg-[#090C12]/90 border border-cyan-500/40 rounded backdrop-blur-xs text-cyan-300 flex items-center gap-1">
                  <Flame className="w-3 h-3 text-rose-400" />
                  GRAD-CAM OVERLAY (RIGHT)
                </div>
              )}
            </div>

            {/* Bottom Slider Position HUD */}
            <div className="absolute bottom-3 right-3 pointer-events-none font-mono text-[10px]">
              {viewMode === "curtain" ? (
                <div className="px-2.5 py-1 bg-[#090C12]/90 border border-[#1F2430] rounded text-slate-400 flex items-center gap-2">
                  <span>SPLIT CURTAIN:</span>
                  <span className="text-cyan-300 font-bold">{sliderPosition}%</span>
                </div>
              ) : (
                <div className="px-2.5 py-1 bg-[#090C12]/90 border border-[#1F2430] rounded text-slate-400 flex items-center gap-2">
                  <span>OVERLAY OPACITY:</span>
                  <span className="text-cyan-300 font-bold">{blendOpacity}%</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Blend Opacity Slider Control (in Blend mode) */}
        {viewMode === "blend" && (
          <div className="mt-3 px-3 py-2 bg-[#12141C] border border-[#1F2430] rounded-lg flex items-center gap-4 text-xs font-mono">
            <span className="text-slate-400 shrink-0 flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
              HEATMAP DENSITY:
            </span>
            <input
              type="range"
              min="0"
              max="100"
              value={blendOpacity}
              onChange={(e) => setBlendOpacity(Number(e.target.value))}
              className="flex-1 accent-cyan-400 cursor-pointer"
            />
            <span className="text-cyan-300 font-bold w-12 text-right">{blendOpacity}%</span>
          </div>
        )}
      </div>

      {/* Frame Diagnostic Status Bar */}
      <div className="px-4 py-2 bg-[#0E1017] border-t border-[#1F2430] flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-slate-400">
        <div className="flex items-center gap-3">
          <span>PART ID: <strong className="text-slate-200">{item.partId}</strong></span>
          <span className="text-slate-600">•</span>
          <span>SN: <strong className="text-slate-200">{item.serialNumber}</strong></span>
          <span className="text-slate-600">•</span>
          <span>CONFIDENCE: <strong className="text-cyan-300">{item.confidenceScore.toFixed(1)}%</strong></span>
        </div>

        <div className="text-[11px] text-slate-500">
          SCAN TIME: <span className="text-slate-400">{item.timestamp}</span>
        </div>
      </div>
    </div>
  );
}
