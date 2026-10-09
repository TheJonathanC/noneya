"use client";

import React, { useState, useRef } from "react";
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
  hotspots?: Array<{
    x: number;
    y: number;
    zone: string;
    severity: string;
    area_frac: number;
    peak_z?: number;
    score?: number;
  }>;
  className?: string;
}

/**
 * Procedural fallback thermal heatmap SVG generator if no image mask is provided
 */
function createSyntheticHeatmapUri(defectType: string = "Defect", isCritical: boolean = false): string {
  const safeDefectType = typeof defectType === "string" && defectType.trim().length > 0 ? defectType : "Defect";
  const cx = 416;
  const cy = 288;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
    <defs>
      <radialGradient id="hotspot" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#D60000" stop-opacity="0.95"/>
        <stop offset="24%" stop-color="#FF5100" stop-opacity="0.90"/>
        <stop offset="48%" stop-color="#FFC400" stop-opacity="0.75"/>
        <stop offset="68%" stop-color="#00E676" stop-opacity="0.55"/>
        <stop offset="84%" stop-color="#00B0FF" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="#070F26" stop-opacity="0.10"/>
      </radialGradient>
      <radialGradient id="nominal" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#00E676" stop-opacity="0.35"/>
        <stop offset="50%" stop-color="#00B0FF" stop-opacity="0.20"/>
        <stop offset="80%" stop-color="#070F26" stop-opacity="0.08"/>
        <stop offset="100%" stop-color="#070F26" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="800" height="600" fill="#070F26"/>
    ${
      isCritical
        ? `<circle cx="${cx}" cy="${cy}" r="185" fill="url(#hotspot)"/>
           <circle cx="${cx - 18}" cy="${cy + 12}" r="96" fill="url(#hotspot)"/>
           <line x1="${cx - 45}" y1="${cy}" x2="${cx + 45}" y2="${cy}" stroke="#FFFFFF" stroke-width="1.8" stroke-dasharray="3,3"/>
           <line x1="${cx}" y1="${cy - 45}" x2="${cx}" y2="${cy + 45}" stroke="#FFFFFF" stroke-width="1.8" stroke-dasharray="3,3"/>
           <circle cx="${cx}" cy="${cy}" r="26" fill="none" stroke="#FFFFFF" stroke-width="1.6"/>
           <rect x="${cx + 36}" y="${cy - 45}" width="165" height="44" rx="4" fill="#0F131D" fill-opacity="0.92" stroke="#FF003C" stroke-width="1.2"/>
           <text x="${cx + 46}" y="${cy - 28}" fill="#FF4060" font-family="monospace" font-size="11" font-weight="bold">GRAD-CAM: ${safeDefectType.toUpperCase()}</text>
           <text x="${cx + 46}" y="${cy - 12}" fill="#94A3B8" font-family="monospace" font-size="10">PEAK Z: 4.85 • CRITICAL</text>`
        : `<circle cx="400" cy="300" r="240" fill="url(#nominal)"/>
           <rect x="330" y="275" width="140" height="34" rx="4" fill="#0D1518" fill-opacity="0.9" stroke="#00E676" stroke-width="1"/>
           <text x="345" y="296" fill="#00E676" font-family="monospace" font-size="11" font-weight="bold">NOMINAL PASS</text>`
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
  hotspots,
  className = "",
}: DefectSegmenterProps) {
  // View mode switcher:
  // 'perception' = AI instance segmentation silhouette masks + floating pill tags
  // 'combined'   = Segmentation masks + Heatmap together
  // 'heatmap'    = JET thermal activation heatmap (Grad-CAM)
  // 'split'      = Dual side-by-side comparison
  // 'original'   = Optical capture alone
  const [viewMode, setViewMode] = useState<
    "perception" | "combined" | "heatmap" | "split" | "original"
  >("perception");

  // In side-by-side split view: what overlay to compare against optical photo
  // 'heatmap' = Original vs Heatmap
  // 'segmentation' = Original vs Defect Outlines
  // 'combined' = Original vs Combined HUD
  // 'all' = 3-way split: Original vs Heatmap vs Defect Outlines
  const [splitOverlay, setSplitOverlay] = useState<
    "heatmap" | "segmentation" | "combined" | "all"
  >("heatmap");

  const [showMask, setShowMask] = useState<boolean>(true);
  const [showBadges, setShowBadges] = useState<boolean>(true);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
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

  const primaryHotspot = hotspots && hotspots.length > 0 ? hotspots[0] : null;

  const hasOriginal = Boolean(originalImage && originalImage.trim().length > 0);
  const hasHeatmap = Boolean(resolvedHeatmap && resolvedHeatmap.trim().length > 0);

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.5, 3.5));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.5, 1));
  const handleResetZoom = () => setZoomLevel(1);

  const activeInstance = instances.find(
    (i) => i.id === (hoveredInstanceId || selectedInstanceId)
  );

  const tabs = [
    {
      id: "perception" as const,
      label: "Image Segmentation",
      icon: Crosshair,
      description: "AI instance polygon silhouettes and detection callouts",
    },
    {
      id: "heatmap" as const,
      label: "Heatmap",
      icon: Flame,
      description: "Grad-CAM thermal heatmap showing defect stress zones",
    },
    {
      id: "combined" as const,
      label: "Combined HUD",
      icon: Sparkles,
      description: "Segmentation contours fused with thermal heatmap",
    },
    {
      id: "split" as const,
      label: "Side-by-Side",
      icon: Columns,
      description: "Split comparison: optical original vs AI diagnosis",
    },
    {
      id: "original" as const,
      label: "Original Optical",
      icon: Eye,
      description: "Raw high-resolution photographic capture",
    },
  ];

  return (
    <div
      className={`flex flex-col bg-[#FFFFFF] border border-[#E5DFD3] rounded-2xl overflow-hidden shadow-xs transition-all duration-200 ${
        isExpanded
          ? "fixed inset-4 z-50 shadow-2xl border-[#D5CDC0] bg-[#FAF8F5]"
          : "relative"
      } ${className}`}
    >
      {/* Clean Single-Line Unified Toolbar Directly Above Image Viewport */}
      <div className="px-3 sm:px-4 py-2 bg-[#FCFBF8] border-b border-[#EAE4D7] flex items-center justify-between gap-2 text-xs overflow-x-auto no-scrollbar">
        {/* Left: View Mode Tabs + In-line Split Sub-options if Side-by-Side active */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex items-center gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = viewMode === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setViewMode(tab.id)}
                  title={tab.description}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 cursor-pointer ${
                    isActive
                      ? "bg-[#1C1917] text-[#FAF8F5] shadow-xs font-semibold"
                      : "bg-[#FFFFFF] border border-[#E5DFD3] text-[#57534E] hover:bg-[#F3EFE6] hover:text-[#1C1917]"
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 ${
                      isActive ? "text-[#FAF8F5]" : "text-[#78716A]"
                    }`}
                  />
                  <span className="whitespace-nowrap">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* In-line Split Comparison Selector (integrated seamlessly on same line) */}
          {viewMode === "split" && (
            <div className="flex items-center gap-1 pl-1.5 border-l border-[#DDD5C7] ml-1">
              <span className="text-[#78716A] text-[11px] font-medium hidden sm:inline mr-0.5">
                vs
              </span>
              {(
                [
                  { id: "heatmap", label: "Heatmap" },
                  { id: "segmentation", label: "Outlines" },
                  { id: "combined", label: "Combined" },
                  { id: "all", label: "3-Way" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSplitOverlay(opt.id)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer whitespace-nowrap ${
                    splitOverlay === opt.id
                      ? "bg-[#1C1917] text-[#FAF8F5] font-semibold"
                      : "bg-[#FAF8F5] border border-[#E5DFD3] text-[#57534E] hover:bg-[#F3EFE6] hover:text-[#1C1917]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Clean Viewport Utilities (AI Layer Toggle, Zoom, Fullscreen) on the Same Line */}
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          {/* Toggle AI Layer Visibility */}
          <button
            type="button"
            onClick={() => setShowMask((prev) => !prev)}
            disabled={!hasHeatmap}
            title={showMask ? "Hide AI Layer" : "Show AI Layer"}
            aria-pressed={showMask}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer select-none disabled:opacity-40 disabled:cursor-not-allowed ${
              showMask
                ? "bg-[#1C1917] border-[#1C1917] text-[#FAF8F5]"
                : "bg-[#FFFFFF] border-[#DDD5C7] text-[#57534E] hover:bg-[#F3EFE6]"
            }`}
          >
            {showMask ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span className="hidden md:inline">{showMask ? "AI Layer" : "Hidden"}</span>
          </button>

          {/* Zoom Group */}
          <div className="flex items-center bg-[#FFFFFF] border border-[#DDD5C7] rounded-lg p-0.5 text-[11px]">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoomLevel <= 1}
              aria-label="Zoom out"
              title="Zoom out"
              className="p-1 rounded text-[#78716A] hover:text-[#1C1917] hover:bg-[#F3EFE6] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-1 font-mono font-medium text-[#1C1917] tabular-nums select-none min-w-[32px] text-center text-[10px]">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoomLevel >= 3.5}
              aria-label="Zoom in"
              title="Zoom in"
              className="p-1 rounded text-[#78716A] hover:text-[#1C1917] hover:bg-[#F3EFE6] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            {zoomLevel > 1 && (
              <button
                type="button"
                onClick={handleResetZoom}
                aria-label="Reset zoom"
                title="Reset zoom"
                className="p-1 ml-0.5 rounded text-[#D97706] hover:bg-[#FEF3C7] cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Fullscreen Expand Button */}
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            aria-label={isExpanded ? "Exit enlarged view" : "Enlarge view"}
            title={isExpanded ? "Exit enlarged view" : "Enlarge view"}
            className="p-1.5 rounded-lg border border-[#DDD5C7] text-[#57534E] hover:text-[#1C1917] bg-[#FFFFFF] hover:bg-[#F3EFE6] transition-colors cursor-pointer"
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* 4. Inspection Viewport Stage */}
      <div className="relative p-3 sm:p-4 bg-[#FAF8F5] overflow-hidden flex-1 flex flex-col justify-center">
        <div
          ref={containerRef}
          className={`relative w-full rounded-xl overflow-hidden border border-[#DDD5C7] bg-[#0A0D12] select-none flex items-center justify-center ${
            isExpanded
              ? "h-[calc(100vh-170px)]"
              : viewMode === "split"
              ? "h-[500px] min-h-[440px] max-h-[620px]"
              : "aspect-[4/3] max-h-[540px] min-h-[320px]"
          }`}
        >
          {/* Subtle Technical Reticle Grid Background */}
          <div
            className="absolute inset-0 opacity-15 pointer-events-none"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.25) 1px, transparent 0)",
              backgroundSize: "28px 28px",
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
            {/* VIEW MODE: SPLIT VIEW (Side-by-Side Comparison) */}
            {viewMode === "split" ? (
              <div
                className={`w-full h-full p-3 gap-3 ${
                  splitOverlay === "all"
                    ? "grid grid-cols-1 md:grid-cols-3"
                    : "grid grid-cols-1 sm:grid-cols-2"
                }`}
              >
                {/* Pane 1: Optical Raw Photo */}
                <div className="relative h-full flex-1 rounded-lg overflow-hidden border border-[#2E333D] bg-[#0F131A] flex items-center justify-center p-2">
                  <div className="relative inline-block max-w-full max-h-full leading-none">
                    <img
                      src={hasOriginal ? originalImage! : resolvedHeatmap}
                      alt="Optical raw capture"
                      className="max-w-full max-h-[440px] w-auto h-auto object-contain block rounded-lg select-none"
                    />
                    <div className="absolute top-2 left-2 px-2.5 py-1 rounded-md bg-[#1C1917]/90 border border-[#3E3834] text-[10px] font-mono text-[#FAF8F5] shadow-md">
                      Optical Raw Capture
                    </div>
                  </div>
                </div>

                {/* Heatmap Pane (for 'heatmap' or 'all') */}
                {(splitOverlay === "heatmap" || splitOverlay === "all") && (
                  <div className="relative h-full flex-1 rounded-lg overflow-hidden border border-[#F59E0B]/40 bg-[#070F26] flex items-center justify-center p-2">
                    <div className="relative inline-block max-w-full max-h-full leading-none">
                      <img
                        src={resolvedHeatmap}
                        alt="Grad-CAM heatmap"
                        className="max-w-full max-h-[440px] w-auto h-auto object-contain block rounded-lg select-none"
                      />
                      <div className="absolute top-2 left-2 px-2.5 py-1 rounded-md bg-[#D97706]/90 border border-[#F59E0B] text-[10px] font-mono text-[#FAF8F5] shadow-md">
                        Grad-CAM Heatmap
                      </div>
                      <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-[#1C1917]/90 border border-[#3E3834] text-[9px] font-mono text-[#FAF8F5] flex items-center gap-1.5 shadow-md">
                        <div
                          className="w-12 h-1.5 rounded-full"
                          style={{
                            background:
                              "linear-gradient(to right, #0022FF, #00D5FF, #00FF66, #FFDD00, #FF002B)",
                          }}
                        />
                        <span>Thermal Z-Peak</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Defect Segmentation Pane (for 'segmentation' or 'all') */}
                {(splitOverlay === "segmentation" || splitOverlay === "all") && (
                  <div className="relative h-full flex-1 rounded-lg overflow-hidden border border-[#DC2626]/40 bg-[#0F131A] flex items-center justify-center p-2">
                    <div className="relative inline-block max-w-full max-h-full leading-none">
                      <img
                        src={hasOriginal ? originalImage! : resolvedHeatmap}
                        alt="Optical base"
                        className="max-w-full max-h-[440px] w-auto h-auto object-contain block rounded-lg select-none brightness-75"
                      />
                      {showMask && (
                        <svg
                          viewBox="0 0 800 600"
                          preserveAspectRatio="none"
                          className="absolute inset-0 w-full h-full pointer-events-none"
                        >
                          {instances.map((inst) => {
                            const isHovered =
                              hoveredInstanceId === inst.id || selectedInstanceId === inst.id;
                            return (
                              <polygon
                                key={inst.id}
                                points={inst.points}
                                fill={inst.color}
                                fillOpacity={0.65}
                                stroke={isHovered ? "#FFFFFF" : inst.borderColor}
                                strokeWidth={isHovered ? 2.8 : 1.8}
                                strokeLinejoin="round"
                                className="pointer-events-auto cursor-pointer transition-all duration-150"
                                style={{
                                  filter: isHovered
                                    ? "drop-shadow(0 0 8px rgba(255,255,255,0.8))"
                                    : "none",
                                }}
                                onMouseEnter={() => setHoveredInstanceId(inst.id)}
                                onMouseLeave={() => setHoveredInstanceId(null)}
                                onClick={() =>
                                  setSelectedInstanceId(
                                    inst.id === selectedInstanceId ? null : inst.id
                                  )
                                }
                              />
                            );
                          })}
                        </svg>
                      )}
                      {showMask && showBadges && (
                        <div className="absolute inset-0 pointer-events-none z-20">
                          {instances.map((inst) => (
                            <div
                              key={`split-badge-${inst.id}`}
                              style={{
                                left: `${inst.center.x}%`,
                                top: `${inst.center.y}%`,
                              }}
                              className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto"
                            >
                              <div
                                style={{
                                  backgroundColor: inst.badgeBg,
                                  color: inst.badgeTextColor || "#FFFFFF",
                                }}
                                className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold shadow-lg flex items-center gap-1 border border-white/60"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                                <span>{inst.className}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="absolute top-2 left-2 px-2.5 py-1 rounded-md bg-[#991B1B]/90 border border-[#DC2626] text-[10px] font-mono text-[#FAF8F5] shadow-md">
                        AI Defect Outlines
                      </div>
                    </div>
                  </div>
                )}

                {/* Combined HUD Pane (for 'combined') */}
                {splitOverlay === "combined" && (
                  <div className="relative h-full flex-1 rounded-lg overflow-hidden border border-[#8B5CF6]/40 bg-[#0F131A] flex items-center justify-center p-2">
                    <div className="relative inline-block max-w-full max-h-full leading-none">
                      <img
                        src={hasOriginal ? originalImage! : resolvedHeatmap}
                        alt="Optical base"
                        className="max-w-full max-h-[440px] w-auto h-auto object-contain block rounded-lg select-none brightness-80"
                      />
                      {showMask && hasHeatmap && (
                        <img
                          src={resolvedHeatmap}
                          alt="Grad-CAM heatmap"
                          className="absolute inset-0 w-full h-full object-fill pointer-events-none rounded-lg"
                          style={{
                            opacity: 0.55,
                            mixBlendMode: "normal",
                          }}
                        />
                      )}
                      {showMask && (
                        <svg
                          viewBox="0 0 800 600"
                          preserveAspectRatio="none"
                          className="absolute inset-0 w-full h-full pointer-events-none z-10"
                        >
                          {instances.map((inst) => {
                            const isHovered =
                              hoveredInstanceId === inst.id || selectedInstanceId === inst.id;
                            return (
                              <polygon
                                key={inst.id}
                                points={inst.points}
                                fill={inst.color}
                                fillOpacity={0.55}
                                stroke={isHovered ? "#FFFFFF" : inst.borderColor}
                                strokeWidth={isHovered ? 2.8 : 1.8}
                                strokeLinejoin="round"
                                className="pointer-events-auto cursor-pointer transition-all duration-150"
                                style={{
                                  filter: isHovered
                                    ? "drop-shadow(0 0 8px rgba(255,255,255,0.8))"
                                    : "none",
                                }}
                                onMouseEnter={() => setHoveredInstanceId(inst.id)}
                                onMouseLeave={() => setHoveredInstanceId(null)}
                                onClick={() =>
                                  setSelectedInstanceId(
                                    inst.id === selectedInstanceId ? null : inst.id
                                  )
                                }
                              />
                            );
                          })}
                        </svg>
                      )}
                      <div className="absolute top-2 left-2 px-2.5 py-1 rounded-md bg-[#6D28D9]/90 border border-[#8B5CF6] text-[10px] font-mono text-[#FAF8F5] shadow-md">
                        Combined HUD
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* VIEW MODES: PERCEPTION, COMBINED, OVERLAY, ORIGINAL, HEATMAP SOLO */
              <div className="relative max-w-full max-h-full flex items-center justify-center p-1">
                <div className="relative inline-block max-w-full max-h-full leading-none shadow-2xl rounded-lg overflow-hidden">
                  {/* Layer 1: Base Optical Photograph (Hidden in solo heatmap mode to prevent washed-out screening) */}
                  {viewMode !== "heatmap" ? (
                    <img
                      src={hasOriginal ? originalImage! : resolvedHeatmap}
                      alt="Component inspection"
                      className={`max-w-full max-h-[480px] w-auto h-auto object-contain block select-none transition-all duration-200 ${
                        viewMode === "perception"
                          ? "brightness-90 contrast-105"
                          : viewMode === "combined"
                          ? "brightness-85 contrast-105"
                          : ""
                      }`}
                    />
                  ) : (
                    /* Solo Heatmap: Raw authentic thermal JET map without washed-out base */
                    <img
                      src={resolvedHeatmap}
                      alt="AI Grad-CAM localization defect heatmap"
                      className="max-w-full max-h-[480px] w-auto h-auto object-contain block select-none rounded-lg"
                    />
                  )}

                  {/* Layer 2: Grad-CAM Thermal Heatmap Overlay (Used when in 'combined' mode) */}
                  {viewMode === "combined" && hasHeatmap && (
                    <img
                      src={resolvedHeatmap}
                      alt="AI Grad-CAM localization defect heatmap overlay"
                      className="absolute inset-0 w-full h-full object-fill pointer-events-none"
                      style={{
                        opacity: showMask ? 0.55 : 0,
                        mixBlendMode: "normal",
                      }}
                    />
                  )}

                  {/* Layer 3: Instance Segmentation Polygons / Silhouettes */}
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
                        const isHovered =
                          hoveredInstanceId === inst.id || selectedInstanceId === inst.id;
                        return (
                          <polygon
                            key={inst.id}
                            points={inst.points}
                            fill={inst.color}
                            fillOpacity={0.65}
                            stroke={isHovered ? "#FFFFFF" : inst.borderColor}
                            strokeWidth={isHovered ? 2.8 : 1.8}
                            strokeLinejoin="round"
                            className="pointer-events-auto cursor-pointer transition-all duration-150"
                            style={{
                              filter: isHovered ? "url(#segmentGlow)" : "none",
                            }}
                            onMouseEnter={() => setHoveredInstanceId(inst.id)}
                            onMouseLeave={() => setHoveredInstanceId(null)}
                            onClick={() =>
                              setSelectedInstanceId(
                                inst.id === selectedInstanceId ? null : inst.id
                              )
                            }
                          />
                        );
                      })}
                    </svg>
                  )}

                  {/* Layer 4: Floating Perception Badges / Pills */}
                  {(viewMode === "perception" || viewMode === "combined") &&
                    showMask &&
                    showBadges && (
                      <div className="absolute inset-0 pointer-events-none z-20">
                        {instances.map((inst) => {
                          const isHovered =
                            hoveredInstanceId === inst.id || selectedInstanceId === inst.id;
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
                              onClick={() =>
                                setSelectedInstanceId(
                                  inst.id === selectedInstanceId ? null : inst.id
                                )
                              }
                            >
                              <div
                                style={{
                                  backgroundColor: inst.badgeBg,
                                  color: inst.badgeTextColor || "#FFFFFF",
                                }}
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold shadow-lg flex items-center gap-1.5 border border-white/60 backdrop-blur-md whitespace-nowrap transition-all duration-150 select-none ${
                                  isHovered
                                    ? "scale-110 ring-2 ring-white shadow-[0_0_15px_rgba(255,255,255,0.7)]"
                                    : "hover:scale-105"
                                }`}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0 inline-block" />
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
            <div className="absolute top-3 right-3 max-w-xs z-30 p-3.5 rounded-xl bg-[#1C1917]/95 border border-[#3E3834] backdrop-blur-md shadow-2xl text-xs space-y-2 pointer-events-auto animate-in fade-in duration-150 text-[#FAF8F5]">
              <div className="flex items-center justify-between gap-2 border-b border-[#3E3834] pb-2">
                <div className="flex items-center gap-2 font-bold text-white">
                  <span
                    className="w-2.5 h-2.5 rounded-full inline-block"
                    style={{ backgroundColor: activeInstance.badgeBg }}
                  />
                  <span className="font-mono uppercase">{activeInstance.className}</span>
                </div>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#2C2724] text-[#FAF8F5]">
                  {activeInstance.confidence}% match
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                <div>
                  <span className="text-[#A8A29E] block text-[10px]">Category</span>
                  <span className="text-white capitalize">{activeInstance.category}</span>
                </div>
                <div>
                  <span className="text-[#A8A29E] block text-[10px]">Area</span>
                  <span className="text-white">
                    {activeInstance.areaMm2 ? `${activeInstance.areaMm2} mm²` : "Localized"}
                  </span>
                </div>
                <div>
                  <span className="text-[#A8A29E] block text-[10px]">Center Coords</span>
                  <span className="text-white">
                    X:{activeInstance.center.x}% Y:{activeInstance.center.y}%
                  </span>
                </div>
                <div>
                  <span className="text-[#A8A29E] block text-[10px]">Severity</span>
                  <span
                    className={`font-semibold ${
                      activeInstance.severity === "Critical"
                        ? "text-[#FCA5A5]"
                        : activeInstance.severity === "Warning"
                        ? "text-[#FCD34D]"
                        : "text-[#86EFAC]"
                    }`}
                  >
                    {activeInstance.severity || "Nominal"}
                  </span>
                </div>
              </div>

              {activeInstance.details && (
                <p className="text-[10px] text-[#D6D3D1] leading-relaxed border-t border-[#3E3834] pt-1.5">
                  {activeInstance.details}
                </p>
              )}
            </div>
          )}

          {/* Thermal JET Intensity Scale / Legend Bar in Lower Right */}
          {(viewMode === "heatmap" || viewMode === "combined") && (
            <div className="absolute bottom-3 right-3 flex items-center gap-2 pointer-events-none select-none z-20">
              <div className="px-3 py-1.5 rounded-lg bg-[#1C1917]/90 border border-[#3E3834] backdrop-blur-md text-[10px] font-mono text-[#FAF8F5] flex items-center gap-2 shadow-lg">
                <span className="text-[#A8A29E]">0.0 Nominal</span>
                <div
                  className="w-20 sm:w-28 h-2 rounded-full overflow-hidden"
                  style={{
                    background:
                      "linear-gradient(to right, #0022FF, #00D5FF, #00FF66, #FFDD00, #FF002B)",
                  }}
                />
                <span className="text-[#FCA5A5] font-semibold">1.0 Defect</span>
              </div>
            </div>
          )}

          {/* Status HUD Stamp in Lower Left */}
          <div className="absolute bottom-3 left-3 flex items-center gap-2 pointer-events-none select-none z-20">
            <div className="px-2.5 py-1 rounded-md bg-[#1C1917]/85 border border-[#3E3834] backdrop-blur-md text-[10px] font-mono text-[#FAF8F5] flex items-center gap-1.5 shadow-lg">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] inline-block" />
              <span>Optical Feed Active</span>
            </div>

            {hasHeatmap && (
              <div className="px-2.5 py-1 rounded-md bg-[#1C1917]/85 border border-[#3E3834] backdrop-blur-md text-[10px] font-mono text-[#FAF8F5] flex items-center gap-1.5 shadow-lg">
                <span
                  className={`w-1.5 h-1.5 rounded-full inline-block ${
                    viewMode === "perception" ? "bg-[#38BDF8]" : "bg-[#EF4444]"
                  }`}
                />
                <span className="uppercase">
                  Mode: {viewMode}
                  {viewMode === "perception" && ` • ${instances.length} Objects`}
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
