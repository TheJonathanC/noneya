"use client";

import React, { useState, useRef } from "react";
import Image from "next/image";
import {
  Scan,
  Crosshair,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Minimize2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { InspectionItem } from "@/lib/inspection-adapter";
import { Badge } from "@/components/ui/badge";

interface LinenImageViewerProps {
  item: InspectionItem;
}

export function LinenImageViewer({ item }: LinenImageViewerProps) {
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [showReticle, setShowReticle] = useState<boolean>(true);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isDefective = item.status === "DEFECTIVE";

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 0.5, 3));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - 0.5, 1));
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
  };

  return (
    <div
      className={`flex flex-col bg-[#FFFFFF] border border-[#E5DFD3] rounded-2xl overflow-hidden shadow-xs transition-all duration-200 ${
        isExpanded ? "fixed inset-4 z-50 shadow-2xl" : "relative"
      }`}
    >
      {/* Top Inspection Stage Toolbar */}
      <div className="px-4 py-3 bg-[#F7F4EC] border-b border-[#E6E0D3] flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        {/* Left: Component Inspection Title & Status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[#1C1917] font-semibold">
            <Scan aria-hidden="true" className="w-4 h-4 text-[#9A3412]" />
            <span>OPTICAL INSPECTION FEED</span>
          </div>

          <Badge variant={isDefective ? "defective" : "nominal"} size="sm" dot>
            {isDefective ? `ANOMALY: ${item.defectType.toUpperCase()}` : "SURFACE NOMINAL"}
          </Badge>

          {isDefective && item.anomalyCoordinate && (
            <span className="text-[11px] text-[#78716A] hidden sm:inline tabular-nums">
              LOC: X:{(item.anomalyCoordinate.xPercent * 8).toFixed(0)}px Y:
              {(item.anomalyCoordinate.yPercent * 6).toFixed(0)}px
            </span>
          )}
        </div>

        {/* Right: Optical Viewing Controls */}
        <div className="flex items-center gap-2">
          {/* Reticle Toggle (defective items only) */}
          {isDefective && (
            <button
              type="button"
              onClick={() => setShowReticle(!showReticle)}
              aria-pressed={showReticle}
              aria-label="Toggle optical defect target crosshairs"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.97] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A3412] ${
                showReticle
                  ? "bg-[#FFFFFF] border-[#D6CEBF] text-[#9A3412] shadow-xs font-semibold"
                  : "border-[#E4DDD1] text-[#78716A] hover:text-[#1C1917] bg-transparent"
              }`}
              title="Toggle target crosshair"
            >
              <Crosshair aria-hidden="true" className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Defect Crosshair</span>
            </button>
          )}

          {/* Zoom In/Out Toolbar */}
          <div className="flex items-center bg-[#ECE6DA] border border-[#DDD5C7] rounded-lg p-0.5 text-[11px]">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoomLevel <= 1}
              aria-label="Zoom out"
              title="Zoom out"
              className="p-1 rounded text-[#78716A] hover:text-[#1C1917] disabled:opacity-40 disabled:cursor-not-allowed transition-[color,transform] duration-150 active:scale-[0.95] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A3412]"
            >
              <ZoomOut aria-hidden="true" className="w-3.5 h-3.5" />
            </button>

            <span className="px-2 text-[10px] font-bold text-[#1C1917] tabular-nums select-none min-w-[42px] text-center">
              {Math.round(zoomLevel * 100)}%
            </span>

            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoomLevel >= 3}
              aria-label="Zoom in"
              title="Zoom in"
              className="p-1 rounded text-[#78716A] hover:text-[#1C1917] disabled:opacity-40 disabled:cursor-not-allowed transition-[color,transform] duration-150 active:scale-[0.95] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A3412]"
            >
              <ZoomIn aria-hidden="true" className="w-3.5 h-3.5" />
            </button>

            {zoomLevel > 1 && (
              <button
                type="button"
                onClick={handleResetZoom}
                aria-label="Reset zoom to 100%"
                title="Reset zoom"
                className="p-1 ml-0.5 rounded text-[#9A3412] hover:text-[#7C2D12] transition-[color,transform] duration-150 active:scale-[0.95] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A3412]"
              >
                <RotateCcw aria-hidden="true" className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Expand Viewport Toggle */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-pressed={isExpanded}
            aria-label={isExpanded ? "Exit enlarged image view" : "Enlarge image view"}
            title={isExpanded ? "Exit enlarged view" : "Enlarge view"}
            className="p-1.5 rounded-lg border border-[#E4DDD1] text-[#78716A] hover:text-[#1C1917] bg-[#FFFFFF] transition-[background-color,color,transform] duration-150 active:scale-[0.95] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A3412] shadow-xs"
          >
            {isExpanded ? (
              <Minimize2 aria-hidden="true" className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 aria-hidden="true" className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Main Optical Image Stage */}
      <div className="relative p-3.5 bg-[#F9F7F2] overflow-hidden">
        <div
          ref={containerRef}
          id="linen-inspection-viewport"
          className={`relative w-full rounded-xl overflow-hidden border border-[#E5DFD3] bg-[#0E1017] select-none shadow-xs ${
            isExpanded ? "h-[calc(100vh-180px)]" : "aspect-[4/3] max-h-[500px]"
          }`}
        >
          {/* Scalable Optical Component Layer */}
          <div
            className="absolute inset-0 flex items-center justify-center transition-transform duration-200 ease-out"
            style={{
              transform: `scale(${zoomLevel})`,
              transformOrigin: isDefective && item.anomalyCoordinate
                ? `${item.anomalyCoordinate.xPercent}% ${item.anomalyCoordinate.yPercent}%`
                : "center center",
            }}
          >
            <Image
              src={item.rawImageUrl}
              alt={`High-resolution optical capture for part ${item.partId}`}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 65vw"
              className="object-contain pointer-events-none"
              unoptimized
            />

            {/* Precision Defect Crosshairs Reticle (clean geometric ring, no thermal cloud) */}
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
                {/* Thin Calibrated Precision Target Reticle */}
                <div className="relative flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full border border-[#EA580C]/80 animate-ping motion-reduce:animate-none absolute" />
                  <div className="w-10 h-10 rounded-full border border-[#EA580C] bg-[#EA580C]/10 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#EA580C]" />
                  </div>

                  {/* Crosshair Alignment Ticks */}
                  <div className="absolute w-16 h-[1px] bg-[#EA580C]/80" />
                  <div className="absolute h-16 w-[1px] bg-[#EA580C]/80" />

                  {/* Coordinate Label */}
                  <div className="absolute top-6 left-6 px-1.5 py-0.5 rounded bg-[#1C1917]/90 text-[9px] font-mono text-[#FAF8F5] whitespace-nowrap shadow-xs pointer-events-none">
                    TARGET: {item.defectType.toUpperCase()}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Top HUD Badges */}
          <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none font-mono text-[10px]">
            <div className="px-2.5 py-1 bg-[#1C1917]/85 backdrop-blur-xs rounded text-slate-200 flex items-center gap-1.5 shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>HIGH-RES OPTICAL CAPTURE</span>
            </div>

            {isDefective ? (
              <div className="px-2.5 py-1 bg-[#9A3412]/90 backdrop-blur-xs rounded text-[#FAF8F5] flex items-center gap-1.5 shadow-xs">
                <AlertTriangle aria-hidden="true" className="w-3 h-3 text-[#FED7AA]" />
                <span>DEFECT TARGETED: {item.defectType.toUpperCase()}</span>
              </div>
            ) : (
              <div className="px-2.5 py-1 bg-[#166534]/90 backdrop-blur-xs rounded text-[#FAF8F5] flex items-center gap-1.5 shadow-xs">
                <CheckCircle2 aria-hidden="true" className="w-3 h-3 text-[#BBF7D0]" />
                <span>CASTING INTEGRITY NOMINAL</span>
              </div>
            )}
          </div>

          {/* Bottom HUD Metadata */}
          <div className="absolute bottom-3 left-3 pointer-events-none font-mono text-[10px]">
            <div className="px-2.5 py-1 bg-[#1C1917]/85 backdrop-blur-xs rounded text-slate-300 flex items-center gap-2">
              <span>FIELD: FULL CASTING APERTURE</span>
              <span className="text-slate-500">•</span>
              <span className="text-amber-300 tabular-nums">1.0X–3.0X OPTICAL RESOLUTION</span>
            </div>
          </div>

          <div className="absolute bottom-3 right-3 pointer-events-none font-mono text-[10px]">
            <div className="px-2.5 py-1 bg-[#1C1917]/85 backdrop-blur-xs rounded text-slate-300 flex items-center gap-2">
              <span>SCALE:</span>
              <span className="text-amber-300 font-bold tabular-nums">
                {Math.round(zoomLevel * 100)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Frame Diagnostic Status Bar */}
      <div className="px-4 py-2.5 bg-[#F7F4EC] border-t border-[#E6E0D3] flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-[#78716A]">
        <div className="flex items-center gap-3">
          <span>
            PART ID: <strong className="text-[#1C1917]">{item.partId}</strong>
          </span>
          <span className="text-[#D6CEBF]" aria-hidden="true">•</span>
          <span>
            SN: <strong className="text-[#1C1917]">{item.serialNumber}</strong>
          </span>
          <span className="text-[#D6CEBF]" aria-hidden="true">•</span>
          <span>
            CONFIDENCE:{" "}
            <strong className="text-[#9A3412] tabular-nums">
              {item.confidenceScore.toFixed(1)}%
            </strong>
          </span>
        </div>

        <div className="text-[11px] text-[#78716A]">
          SCAN TIME: <span className="text-[#1C1917] tabular-nums">{item.timestamp}</span>
        </div>
      </div>
    </div>
  );
}
