"use client";

import React, { useState, useRef } from "react";
import Image from "next/image";
import {
  Layers,
  Eye,
  EyeOff,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Minimize2,
  AlertTriangle,
  Sliders,
  Sparkles,
  Columns,
  Flame,
  CheckCircle2,
  Tag,
  Crosshair,
  Info,
  ShieldAlert,
} from "lucide-react";
import {
  SegmentationInstance,
  generateDefaultSegmentationInstances,
} from "@/lib/inspection-adapter";

export interface DefectSegmenterProps {
  originalImage?: string; // Base64 data URI (data:image/jpeg;base64,...) or URL
  heatmapImage?: string;  // Base64 data URI (data:image/jpeg;base64,...) or URL
  segmentationInstances?: SegmentationInstance[];
  defectType?: string;    // e.g. "Porosity", "Crack", "Critical STOP"
  severity?: "Critical" | "High" | "Moderate" | "Minor" | "Nominal" | string;
  confidence?: number | string;
  stationName?: string;
  className?: string;
}

/**
 * Procedural fallback thermal heatmap SVG generator if no image mask is provided
 */
function createSyntheticHeatmapUri(defectType: string, isCritical: boolean): string {
  const cx = 416;
  const cy = 288;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
    <defs>
      <radialGradient id="hotspot" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#FF002B" stop-opacity="0.95"/>
        <stop offset="28%" stop-color="#FF6200" stop-opacity="0.88"/>
        <stop offset="55%" stop-color="#FFD000" stop-opacity="0.75"/>
        <stop offset="75%" stop-color="#00E5FF" stop-opacity="0.45"/>
        <stop offset="90%" stop-color="#0037FF" stop-opacity="0.2"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="nominal" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#00FF9D" stop-opacity="0.32"/>
        <stop offset="65%" stop-color="#00B4D8" stop-opacity="0.12"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="800" height="600" fill="#05070A"/>
    ${
      isCritical
        ? `<circle cx="${cx}" cy="${cy}" r="185" fill="url(#hotspot)"/>
           <circle cx="${cx - 18}" cy="${cy + 12}" r="96" fill="url(#hotspot)"/>
           <line x1="${cx - 45}" y1="${cy}" x2="${cx + 45}" y2="${cy}" stroke="#FFFFFF" stroke-width="1.8" stroke-dasharray="3,3"/>
           <line x1="${cx}" y1="${cy - 45}" x2="${cx}" y2="${cy + 45}" stroke="#FFFFFF" stroke-width="1.8" stroke-dasharray="3,3"/>
           <circle cx="${cx}" cy="${cy}" r="26" fill="none" stroke="#FFFFFF" stroke-width="1.6"/>
           <rect x="${cx + 36}" y="${cy - 45}" width="165" height="44" rx="4" fill="#0F131D" fill-opacity="0.92" stroke="#FF003C" stroke-width="1.2"/>
           <text x="${cx + 46}" y="${cy - 28}" fill="#FF4060" font-family="monospace" font-size="11" font-weight="bold">GRAD-CAM: ${defectType.toUpperCase()}</text>
           <text x="${cx + 46}" y="${cy - 12}" fill="#94A3B8" font-family="monospace" font-size="10">PEAK Z: 4.85 • CRITICAL</text>`
        : `<circle cx="400" cy="300" r="240" fill="url(#nominal)"/>
           <rect x="330" y="275" width="140" height="34" rx="4" fill="#0D1518" fill-opacity="0.9" stroke="#00FF9D" stroke-width="1"/>
           <text x="345" y="296" fill="#00FF9D" font-family="monospace" font-size="11" font-weight="bold">NOMINAL PASS</text>`
    }
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function DefectSegmenter({
  originalImage,
  heatmapImage,
  segmentationInstances,
  defectType = "Defect Detected",
  severity = "Critical",
  confidence = 94.8,
  stationName = "Station 04 • Casting Cell B",
  className = "",
}: DefectSegmenterProps) {
  // View mode switcher:
  // 'perception' = AI instance segmentation silhouette masks + floating pill tags (matching reference image)
  // 'combined'   = Segmentation masks + Grad-CAM heatmap together
  // 'overlay'    = Blended Grad-CAM heatmap overlay
  // 'heatmap'    = Heatmap solo
  // 'split'      = Dual side-by-side
  // 'original'   = Optical capture alone
  const [viewMode, setViewMode] = useState<"perception" | "combined" | "overlay" | "heatmap" | "split" | "original">("perception");
  
  const [showMask, setShowMask] = useState<boolean>(true);
  const [showBadges, setShowBadges] = useState<boolean>(true);
  const [showContours, setShowContours] = useState<boolean>(true);
  const [maskOpacity, setMaskOpacity] = useState<number>(0.65);
  const [blendMode, setBlendMode] = useState<"screen" | "multiply" | "color-dodge">("screen");
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [showControls, setShowControls] = useState<boolean>(false);
  const [hoveredInstanceId, setHoveredInstanceId] = useState<string | null>(null);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const isCritical =
    typeof severity === "string" &&
    (severity.toLowerCase().includes("crit") ||
      severity.toLowerCase().includes("high") ||
      severity.toLowerCase().includes("defect") ||
      severity.toLowerCase().includes("crack") ||
      severity.toLowerCase().includes("porosity"));

  // Ensure an effective heatmap is ALWAYS present
  const resolvedHeatmap =
    heatmapImage && heatmapImage.trim().length > 0
      ? heatmapImage
      : createSyntheticHeatmapUri(defectType, isCritical);

  // Active segmentation instances: strictly filter to only show defects / issues
  const rawInstances: SegmentationInstance[] =
    segmentationInstances && segmentationInstances.length > 0
      ? segmentationInstances
      : generateDefaultSegmentationInstances(defectType, isCritical);

  const instances = rawInstances.filter((inst) => {
    const name = inst.className.toLowerCase();
    const cat = (inst.category || "").toLowerCase();
    return (
      !name.includes("casting_body") &&
      !name.includes("hub_bore") &&
      !name.includes("vane") &&
      cat !== "component"
    );
  });

  const hasOriginal = Boolean(originalImage && originalImage.trim().length > 0);
  const hasHeatmap = Boolean(resolvedHeatmap && resolvedHeatmap.trim().length > 0);

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.5, 3.5));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.5, 1));
  const handleResetZoom = () => setZoomLevel(1);

  const activeInstance = instances.find((i) => i.id === (hoveredInstanceId || selectedInstanceId));

  return (
    <div
      className={`flex flex-col bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl transition-all duration-200 ${
        isExpanded ? "fixed inset-4 z-50 shadow-[0_0_50px_rgba(0,0,0,0.85)] border-slate-700" : "relative"
      } ${className}`}
    >
      {/* 1. Industrial Header Bar */}
      <div className="px-4 py-3 bg-slate-900/90 border-b border-slate-800/80 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Left: Defect & Station Status Indicator */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isCritical ? "bg-red-400" : "bg-emerald-400"
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                  isCritical ? "bg-red-500" : "bg-emerald-500"
                }`}
              />
            </span>
            <span className="font-mono text-[11px] font-semibold tracking-wider text-slate-300 uppercase">
              {stationName}
            </span>
          </div>

          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
              isCritical
                ? "bg-red-950/60 border-red-500/40 text-red-300 shadow-[0_0_12px_rgba(239,68,68,0.2)]"
                : "bg-emerald-950/60 border-emerald-500/40 text-emerald-300"
            }`}
          >
            {isCritical ? <AlertTriangle className="w-3 h-3 shrink-0" /> : <CheckCircle2 className="w-3 h-3 shrink-0" />}
            <span className="capitalize">{defectType}</span>
            {confidence && (
              <span className="font-mono opacity-80 text-[10px]">
                ({typeof confidence === "number" ? `${confidence}%` : confidence})
              </span>
            )}
          </div>
        </div>

        {/* Center: Perception View Mode Switcher */}
        <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5">
          <button
            type="button"
            onClick={() => setViewMode("perception")}
            title="Instance segmentation polygon silhouettes with pinned detection badges"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
              viewMode === "perception"
                ? "bg-cyan-500/25 text-cyan-200 border border-cyan-500/40 shadow-xs font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
            <span>AI Segmentation</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode("combined")}
            title="Combined instance segmentation silhouettes and Grad-CAM thermal heatmap"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
              viewMode === "combined"
                ? "bg-purple-500/25 text-purple-200 border border-purple-500/40 shadow-xs font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>Combined HUD</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode("overlay")}
            title="Grad-CAM thermal heatmap blended over the metal part"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
              viewMode === "overlay"
                ? "bg-red-600/30 text-red-200 border border-red-500/40 shadow-xs font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-red-400" />
            <span>Grad-CAM</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode("heatmap")}
            title="Pure Grad-CAM thermal heatmap field alone"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
              viewMode === "heatmap"
                ? "bg-amber-500/30 text-amber-200 border border-amber-500/40 shadow-xs font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>Heatmap Solo</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode("split")}
            title="Side-by-side comparison"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
              viewMode === "split"
                ? "bg-slate-800 text-slate-100 border border-slate-600 shadow-xs font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Columns className="w-3.5 h-3.5 text-slate-300" />
            <span>Side-by-Side</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode("original")}
            title="Raw optical capture without overlay"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
              viewMode === "original"
                ? "bg-slate-800 text-slate-100 border border-slate-600 shadow-xs font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>Original</span>
          </button>
        </div>

        {/* Right: Quick Action Buttons & Optical Zoom */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Toggle Badges Button (when in perception or combined mode) */}
          {(viewMode === "perception" || viewMode === "combined") && (
            <button
              type="button"
              onClick={() => setShowBadges((prev) => !prev)}
              title={showBadges ? "Hide Floating Object Badges" : "Show Floating Object Badges"}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                showBadges
                  ? "bg-cyan-950/60 border-cyan-500/50 text-cyan-200"
                  : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>{showBadges ? "Labels ON" : "Labels OFF"}</span>
            </button>
          )}

          {/* Toggle Mask Visibility */}
          <button
            type="button"
            onClick={() => setShowMask((prev) => !prev)}
            disabled={!hasHeatmap}
            title={showMask ? "Hide AI Layer" : "Show AI Layer"}
            aria-pressed={showMask}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer select-none active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
              showMask
                ? "bg-red-600/20 border-red-500/50 text-red-200 shadow-[0_0_15px_rgba(239,68,68,0.25)] hover:bg-red-600/30"
                : "bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700/80"
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-red-400" />
            <span>{showMask ? "Mask Active" : "Show AI Mask"}</span>
            {showMask ? <Eye className="w-3 h-3 ml-0.5 text-red-300" /> : <EyeOff className="w-3 h-3 ml-0.5 text-slate-400" />}
          </button>

          {/* Opacity & Parameter Adjust Toggle */}
          <button
            type="button"
            onClick={() => setShowControls((prev) => !prev)}
            aria-expanded={showControls}
            title="Adjust segmentation & heatmap parameters"
            className={`p-1.5 rounded-lg border text-xs transition-colors cursor-pointer active:scale-95 ${
              showControls
                ? "bg-slate-800 border-slate-600 text-slate-200"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
          </button>

          {/* Optical Zoom Controls */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-[11px]">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoomLevel <= 1}
              aria-label="Zoom out"
              title="Zoom out"
              className="p-1 rounded text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer active:scale-95"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 font-mono font-medium text-slate-300 tabular-nums select-none min-w-[36px] text-center text-[10px]">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoomLevel >= 3.5}
              aria-label="Zoom in"
              title="Zoom in"
              className="p-1 rounded text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer active:scale-95"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            {zoomLevel > 1 && (
              <button
                type="button"
                onClick={handleResetZoom}
                aria-label="Reset zoom"
                title="Reset zoom"
                className="p-1 ml-0.5 rounded text-amber-400 hover:text-amber-300 cursor-pointer active:scale-95"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Expand Fullscreen Button */}
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            aria-label={isExpanded ? "Exit enlarged view" : "Enlarge view"}
            title={isExpanded ? "Exit enlarged view" : "Enlarge view"}
            className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-slate-200 bg-slate-900 transition-colors cursor-pointer active:scale-95"
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* 2. Secondary Quick Controls Drawer */}
      {showControls && (
        <div className="px-4 py-2.5 bg-slate-900/70 border-b border-slate-800/70 flex flex-wrap items-center justify-between gap-4 text-xs backdrop-blur-md">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-[11px] font-medium flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-cyan-400" />
                Silhouette Opacity:
              </span>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.05"
                value={maskOpacity}
                onChange={(e) => setMaskOpacity(parseFloat(e.target.value))}
                className="w-28 accent-cyan-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
              <span className="font-mono text-slate-300 text-[10px] tabular-nums">
                {Math.round(maskOpacity * 100)}%
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowContours((prev) => !prev)}
              className={`px-2 py-0.5 rounded text-[11px] font-mono border transition-colors cursor-pointer ${
                showContours
                  ? "bg-slate-800 text-slate-200 border-slate-600"
                  : "bg-slate-900 text-slate-500 border-slate-800"
              }`}
            >
              Contours: {showContours ? "ON" : "OFF"}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-[11px]">Heatmap Blend:</span>
            <div className="flex items-center rounded-lg bg-slate-950 border border-slate-800 p-0.5">
              {(["screen", "multiply", "color-dodge"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setBlendMode(mode)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono capitalize transition-colors cursor-pointer ${
                    blendMode === mode
                      ? "bg-slate-800 text-slate-100 font-bold"
                      : "text-slate-400 hover:text-slate-300"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. The Perception Segmentation Stage */}
      <div className="relative p-3 bg-slate-950 overflow-hidden flex-1 flex flex-col justify-center">
        <div
          ref={containerRef}
          className={`relative w-full rounded-xl overflow-hidden border border-slate-800/90 bg-[#07090E] select-none flex items-center justify-center ${
            isExpanded ? "h-[calc(100vh-160px)]" : "aspect-[4/3] max-h-[520px] min-h-[300px]"
          }`}
        >
          {/* Subtle Grid Reticle Calibration Backdrop */}
          <div
            className="absolute inset-0 opacity-15 pointer-events-none"
            style={{
              backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.2) 1px, transparent 0)",
              backgroundSize: "24px 24px",
            }}
          />

          {/* MAIN CANVAS WRAPPER (Zoomable & Pannable) */}
          <div
            className="absolute inset-0 flex items-center justify-center transition-transform duration-200 ease-out"
            style={{
              transform: `scale(${zoomLevel})`,
              transformOrigin: "center center",
            }}
          >
            {/* VIEW MODE: SPLIT VIEW (Side-by-Side: Optical vs Segmentation) */}
            {viewMode === "split" ? (
              <div className="w-full h-full grid grid-cols-2 gap-2 p-2">
                {/* Left Pane: Optical Raw Photo */}
                <div className="relative h-full rounded-lg overflow-hidden border border-slate-800 bg-slate-900/60 flex items-center justify-center p-2">
                  <div className="relative inline-block max-w-full max-h-full leading-none">
                    <img
                      src={hasOriginal ? originalImage! : resolvedHeatmap}
                      alt="Optical raw capture"
                      className="max-w-full max-h-[460px] w-auto h-auto object-contain block rounded-lg select-none"
                    />
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-slate-900/90 border border-slate-700 text-[10px] font-mono text-slate-300">
                      Optical Raw
                    </div>
                  </div>
                </div>

                {/* Right Pane: AI Segmentation Masks with Floating Badges */}
                <div className="relative h-full rounded-lg overflow-hidden border border-cyan-900/50 bg-slate-900/60 flex items-center justify-center p-2">
                  <div className="relative inline-block max-w-full max-h-full leading-none">
                    <img
                      src={hasOriginal ? originalImage! : resolvedHeatmap}
                      alt="Optical base"
                      className="max-w-full max-h-[460px] w-auto h-auto object-contain block rounded-lg select-none brightness-75"
                    />
                    <svg
                      viewBox="0 0 800 600"
                      preserveAspectRatio="none"
                      className="absolute inset-0 w-full h-full pointer-events-none"
                    >
                      {instances.map((inst) => {
                        const isHovered = hoveredInstanceId === inst.id || selectedInstanceId === inst.id;
                        return (
                          <polygon
                            key={inst.id}
                            points={inst.points}
                            fill={inst.color}
                            fillOpacity={showMask ? maskOpacity : 0}
                            stroke={showContours ? (isHovered ? "#FFFFFF" : inst.borderColor) : "none"}
                            strokeWidth={isHovered ? 2.8 : 1.8}
                            strokeLinejoin="round"
                            className="pointer-events-auto cursor-pointer transition-all duration-150"
                            style={{
                              filter: isHovered ? "drop-shadow(0 0 8px rgba(255,255,255,0.8))" : "none",
                            }}
                            onMouseEnter={() => setHoveredInstanceId(inst.id)}
                            onMouseLeave={() => setHoveredInstanceId(null)}
                            onClick={() => setSelectedInstanceId(inst.id === selectedInstanceId ? null : inst.id)}
                          />
                        );
                      })}
                    </svg>
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-cyan-950/90 border border-cyan-700 text-[10px] font-mono text-cyan-200">
                      Perception Mask
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* VIEW MODES: PERCEPTION, COMBINED, OVERLAY, ORIGINAL, HEATMAP SOLO */
              <div className="relative max-w-full max-h-full flex items-center justify-center p-1">
                {/* Synced Stage: Tight bounding box derived directly from the optical image */}
                <div className="relative inline-block max-w-full max-h-full leading-none shadow-2xl rounded-lg overflow-hidden">
                  {/* Layer 1: Base Optical Photograph */}
                  <img
                    src={hasOriginal ? originalImage! : resolvedHeatmap}
                    alt="Component inspection"
                    className={`max-w-full max-h-[480px] w-auto h-auto object-contain block select-none transition-all duration-200 ${
                      viewMode === "perception" ? "brightness-90 contrast-105" : ""
                    }`}
                  />

                  {/* Layer 2: Grad-CAM Thermal Heatmap (Exact 1:1 overlay with base image) */}
                  {(viewMode === "overlay" || viewMode === "combined" || viewMode === "heatmap") && hasHeatmap && (
                    <img
                      src={resolvedHeatmap}
                      alt="AI Grad-CAM localization defect heatmap"
                      className="absolute inset-0 w-full h-full object-fill pointer-events-none"
                      style={{
                        opacity: viewMode === "heatmap" ? 1 : showMask ? (viewMode === "combined" ? maskOpacity * 0.75 : maskOpacity) : 0,
                        mixBlendMode: viewMode === "heatmap" ? "normal" : blendMode,
                      }}
                    />
                  )}

                  {/* Layer 3: Instance Segmentation Polygons / Silhouettes (Exact 1:1 overlay) */}
                  {(viewMode === "perception" || viewMode === "combined") && showMask && (
                    <svg
                      viewBox="0 0 800 600"
                      preserveAspectRatio="none"
                      className="absolute inset-0 w-full h-full pointer-events-none z-10"
                    >
                      <defs>
                        <filter id="segmentGlow" x="-20%" y="-20%" width="140%" height="140%">
                          <feGaussianBlur stdDeviation="3" result="blur" />
                          <feComposite in="SourceGraphic" in2="blur" operator="over" />
                        </filter>
                      </defs>

                      {instances.map((inst) => {
                        const isHovered = hoveredInstanceId === inst.id || selectedInstanceId === inst.id;
                        return (
                          <polygon
                            key={inst.id}
                            points={inst.points}
                            fill={inst.color}
                            fillOpacity={maskOpacity}
                            stroke={showContours ? (isHovered ? "#FFFFFF" : inst.borderColor) : "none"}
                            strokeWidth={isHovered ? 2.8 : 1.8}
                            strokeLinejoin="round"
                            className="pointer-events-auto cursor-pointer transition-all duration-150"
                            style={{
                              filter: isHovered ? "url(#segmentGlow)" : "none",
                            }}
                            onMouseEnter={() => setHoveredInstanceId(inst.id)}
                            onMouseLeave={() => setHoveredInstanceId(null)}
                            onClick={() => setSelectedInstanceId(inst.id === selectedInstanceId ? null : inst.id)}
                          />
                        );
                      })}
                    </svg>
                  )}

                  {/* Layer 4: Floating Perception Badges / Pills (Exact 1:1 overlay) */}
                  {(viewMode === "perception" || viewMode === "combined") && showMask && showBadges && (
                    <div className="absolute inset-0 pointer-events-none z-20">
                      {instances.map((inst) => {
                        const isHovered = hoveredInstanceId === inst.id || selectedInstanceId === inst.id;
                        return (
                          <div
                            key={`badge-${inst.id}`}
                            style={{
                              left: `${inst.center.x}%`,
                              top: `${inst.center.y}%`,
                            }}
                            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer"
                            onMouseEnter={() => setHoveredInstanceId(inst.id)}
                            onMouseLeave={() => setHoveredInstanceId(null)}
                            onClick={() => setSelectedInstanceId(inst.id === selectedInstanceId ? null : inst.id)}
                          >
                            {/* Floating Horizontal Pill Badge (Like Reference Screenshot) */}
                            <div
                              style={{
                                backgroundColor: inst.badgeBg,
                                color: inst.badgeTextColor || "#FFFFFF",
                              }}
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold shadow-lg flex items-center gap-1.5 border border-white/50 backdrop-blur-md whitespace-nowrap transition-all duration-150 select-none ${
                                isHovered
                                  ? "scale-110 ring-2 ring-white shadow-[0_0_15px_rgba(255,255,255,0.7)]"
                                  : "hover:scale-105"
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full bg-white ${
                                  inst.category === "defect" ? "animate-ping" : ""
                                }`}
                              />
                              <span>
                                {inst.className}: {inst.confidence}%
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Interactive Inspection HUD Details Card (Appears on Hover / Selection) */}
          {activeInstance && (
            <div className="absolute top-3 right-3 max-w-xs z-30 p-3 rounded-xl bg-slate-900/95 border border-slate-700 backdrop-blur-lg shadow-2xl text-xs space-y-2 pointer-events-auto animate-in fade-in duration-150">
              <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5">
                <div className="flex items-center gap-1.5 font-bold text-slate-100">
                  <span
                    className="w-2.5 h-2.5 rounded-full inline-block"
                    style={{ backgroundColor: activeInstance.badgeBg }}
                  />
                  <span className="font-mono uppercase">{activeInstance.className}</span>
                </div>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                  {activeInstance.confidence}% match
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                <div>
                  <span className="text-slate-500 block text-[10px]">Category</span>
                  <span className="text-slate-300 capitalize">{activeInstance.category}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Area</span>
                  <span className="text-slate-300">{activeInstance.areaMm2 ? `${activeInstance.areaMm2} mm²` : "Localized"}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Center Coords</span>
                  <span className="text-slate-300">X:{activeInstance.center.x}% Y:{activeInstance.center.y}%</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Severity</span>
                  <span
                    className={`font-semibold ${
                      activeInstance.severity === "Critical"
                        ? "text-red-400"
                        : activeInstance.severity === "Warning"
                        ? "text-amber-400"
                        : "text-emerald-400"
                    }`}
                  >
                    {activeInstance.severity || "Nominal"}
                  </span>
                </div>
              </div>

              {activeInstance.details && (
                <p className="text-[10px] text-slate-400 leading-relaxed border-t border-slate-800/80 pt-1">
                  {activeInstance.details}
                </p>
              )}
            </div>
          )}

          {/* Thermal JET Intensity Scale / Legend Bar in Lower Right (when in heatmap / overlay mode) */}
          {(viewMode === "heatmap" || viewMode === "overlay" || viewMode === "combined") && (
            <div className="absolute bottom-3 right-3 flex items-center gap-2 pointer-events-none select-none z-20">
              <div className="px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800/90 backdrop-blur-md text-[10px] font-mono text-slate-300 flex items-center gap-2 shadow-lg">
                <span className="text-slate-400">0.0 (Nominal)</span>
                <div
                  className="w-20 sm:w-28 h-2 rounded-full overflow-hidden"
                  style={{
                    background: "linear-gradient(to right, #0022FF, #00D5FF, #00FF66, #FFDD00, #FF002B)",
                  }}
                />
                <span className="text-red-400 font-semibold">1.0 (Defect)</span>
              </div>
            </div>
          )}

          {/* Status HUD Stamp in Lower Left */}
          <div className="absolute bottom-3 left-3 flex items-center gap-2 pointer-events-none select-none z-20">
            <div className="px-2.5 py-1 rounded-md bg-slate-900/80 border border-slate-800/80 backdrop-blur-md text-[10px] font-mono text-slate-300 flex items-center gap-1.5 shadow-lg">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              <span>Optical Feed Raw</span>
            </div>

            {hasHeatmap && (
              <div className="px-2.5 py-1 rounded-md bg-slate-900/80 border border-slate-700/80 backdrop-blur-md text-[10px] font-mono text-slate-300 flex items-center gap-1.5 shadow-lg">
                <span
                  className={`w-1.5 h-1.5 rounded-full animate-pulse inline-block ${
                    viewMode === "perception" ? "bg-cyan-400" : "bg-red-400"
                  }`}
                />
                <span>
                  Mode: {viewMode.toUpperCase()}
                  {viewMode === "perception" && ` • ${instances.length} INSTANCES`}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DefectSegmenter;
