"use client";

import React, { useState, useRef } from "react";
import Image from "next/image";
import { ZoomIn, ZoomOut, RotateCcw, Maximize2, Minimize2 } from "lucide-react";
import { InspectionItem } from "@/lib/inspection-adapter";

interface LinenImageViewerProps {
  item: InspectionItem;
}

export function LinenImageViewer({ item }: LinenImageViewerProps) {
  const [zoomLevel, setZoomLevel] = useState<number>(1);
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
      {/* Sleek Toolbar */}
      <div className="px-4 py-2.5 bg-[#FAF8F5] border-b border-[#EAE4D7] flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="font-medium text-[#1C1917] truncate">
            {item.fileName || item.partId || "Component Capture"}
          </span>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
              isDefective
                ? "bg-[#FEF2F2] text-[#991B1B] border border-[#FCA5A5]/60"
                : "bg-[#F0FDF4] text-[#166534] border border-[#86EFAC]/60"
            }`}
          >
            {isDefective ? "Defect Detected" : "OK"}
          </span>
        </div>

        {/* Minimalist Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex items-center bg-[#F3EFE6] border border-[#E2DBD0] rounded-lg p-0.5 text-[11px]">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoomLevel <= 1}
              aria-label="Zoom out"
              title="Zoom out"
              className="p-1 rounded text-[#78716A] hover:text-[#1C1917] disabled:opacity-30 disabled:cursor-not-allowed transition-[color,transform] duration-150 active:scale-[0.95] cursor-pointer"
            >
              <ZoomOut aria-hidden="true" className="w-3.5 h-3.5" />
            </button>

            <span className="px-2 text-[10px] font-mono font-medium text-[#57534E] tabular-nums select-none min-w-[38px] text-center">
              {Math.round(zoomLevel * 100)}%
            </span>

            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoomLevel >= 3}
              aria-label="Zoom in"
              title="Zoom in"
              className="p-1 rounded text-[#78716A] hover:text-[#1C1917] disabled:opacity-30 disabled:cursor-not-allowed transition-[color,transform] duration-150 active:scale-[0.95] cursor-pointer"
            >
              <ZoomIn aria-hidden="true" className="w-3.5 h-3.5" />
            </button>

            {zoomLevel > 1 && (
              <button
                type="button"
                onClick={handleResetZoom}
                aria-label="Reset zoom to 100%"
                title="Reset zoom"
                className="p-1 ml-0.5 rounded text-[#9A3412] hover:text-[#7C2D12] transition-[color,transform] duration-150 active:scale-[0.95] cursor-pointer"
              >
                <RotateCcw aria-hidden="true" className="w-3 h-3" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-pressed={isExpanded}
            aria-label={isExpanded ? "Exit enlarged view" : "Enlarge view"}
            title={isExpanded ? "Exit enlarged view" : "Enlarge view"}
            className="p-1.5 rounded-lg border border-[#E2DBD0] text-[#78716A] hover:text-[#1C1917] bg-[#FFFFFF] transition-[background-color,color,transform] duration-150 active:scale-[0.95] cursor-pointer"
          >
            {isExpanded ? (
              <Minimize2 aria-hidden="true" className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 aria-hidden="true" className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Pure Image Stage (No Red Markers, No Crosshairs, Clean and High Quality) */}
      <div className="relative p-3 bg-[#FAF8F5] overflow-hidden">
        <div
          ref={containerRef}
          className={`relative w-full rounded-xl overflow-hidden border border-[#E5DFD3] bg-[#12141C] select-none ${
            isExpanded ? "h-[calc(100vh-140px)]" : "aspect-[4/3] max-h-[460px]"
          }`}
        >
          <div
            className="absolute inset-0 flex items-center justify-center transition-transform duration-200 ease-out"
            style={{
              transform: `scale(${zoomLevel})`,
              transformOrigin: "center center",
            }}
          >
            <Image
              src={item.rawImageUrl}
              alt={item.fileName || "Component capture"}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 65vw"
              className="object-contain pointer-events-none"
              unoptimized
            />
          </div>
        </div>
      </div>
    </div>
  );
}
