"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Camera,
  Tags,
  Activity,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Upload,
  ArrowRight,
  Layers,
  Flame,
  Crosshair,
  Gauge,
  Database,
  Cpu,
  Eye,
  Sliders,
  ExternalLink,
  ChevronRight,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  Terminal,
} from "lucide-react";
import { LinenHeader } from "@/components/linen/LinenHeader";

// Simulation Pipeline Stages
export type SimStage =
  | "idle" // Waiting for image
  | "intake" // Image uploaded & optical matrix alignment
  | "model1" // Model 1: Binary screening (ResNet-18)
  | "branching" // Decision branch: OK bypasses Model 2, Defect routes to Model 2
  | "model2" // Model 2: Deep multi-label classification & Grad-CAM heatmap
  | "telemetry" // Physical process telemetry corroboration
  | "report" // Gemini multi-modal synthesis & setpoint calibration
  | "completed"; // Finished: full interactive dossier ready

// Log entry for the engineering console
interface SimLog {
  id: string;
  time: string;
  source: "INTAKE" | "MODEL_1" | "BRANCH" | "MODEL_2" | "TELEMETRY" | "REPORT" | "SYSTEM";
  type: "info" | "success" | "warn" | "error";
  text: string;
}

// Preset definitions for 1-click testing
interface PresetScenario {
  id: string;
  title: string;
  category: "Nominal Pass" | "Porosity Defect" | "Surface Crack";
  isDefect: boolean;
  defectType: string;
  confidence: number;
  description: string;
  color: string;
  imageSvg: string;
  heatmapSvg: string;
  culpritSensor?: string;
  culpritZ?: number;
  gateDecision: "GO" | "ADJUST" | "CRITICAL STOP";
  telemetry: {
    mold_temp: number;
    injection_pressure: number;
    cooling_rate: number;
    vibration: number;
    machine_speed: number;
    humidity: number;
  };
  setpointFix?: { parameter: string; current: number; target: number; unit: string; instruction: string };
  reportText: string;
}

// Calibrated SVG Heatmap Generator for realistic Grad-CAM thermal rendering
function generateHeatmapSvg(defectType: string, isDefect: boolean, cx = 416, cy = 288): string {
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
    <rect width="800" height="600" fill="#000000"/>
    ${
      isDefect
        ? `<circle cx="${cx}" cy="${cy}" r="180" fill="url(#hotspot)"/>
           <circle cx="${cx - 18}" cy="${cy + 12}" r="92" fill="url(#hotspot)"/>
           <line x1="${cx - 45}" y1="${cy}" x2="${cx + 45}" y2="${cy}" stroke="#FFFFFF" stroke-width="1.8" stroke-dasharray="3,3"/>
           <line x1="${cx}" y1="${cy - 45}" x2="${cx}" y2="${cy + 45}" stroke="#FFFFFF" stroke-width="1.8" stroke-dasharray="3,3"/>
           <circle cx="${cx}" cy="${cy}" r="26" fill="none" stroke="#FFFFFF" stroke-width="1.6"/>
           <rect x="${cx + 36}" y="${cy - 45}" width="165" height="44" rx="4" fill="#0F131D" fill-opacity="0.92" stroke="#FF003C" stroke-width="1.2"/>
           <text x="${cx + 46}" y="${cy - 28}" fill="#FF4060" font-family="monospace" font-size="11" font-weight="bold">GRAD-CAM: ${defectType.toUpperCase()}</text>
           <text x="${cx + 46}" y="${cy - 12}" fill="#94A3B8" font-family="monospace" font-size="10">CONF: 94.8% • PEAK Z: 4.85</text>`
        : `<circle cx="400" cy="300" r="240" fill="url(#nominal)"/>
           <rect x="330" y="275" width="140" height="34" rx="4" fill="#0D1518" fill-opacity="0.9" stroke="#00FF9D" stroke-width="1"/>
           <text x="345" y="296" fill="#00FF9D" font-family="monospace" font-size="11" font-weight="bold">NOMINAL PASS</text>`
    }
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// Procedural Synthetic Casting Component SVGs
function createCastingSvg(defectType: "nominal" | "porosity" | "crack"): string {
  const isCrack = defectType === "crack";
  const isPorosity = defectType === "porosity";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
    <defs>
      <linearGradient id="metal" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#4B5563"/>
        <stop offset="50%" stop-color="#374151"/>
        <stop offset="100%" stop-color="#1F2937"/>
      </linearGradient>
      <radialGradient id="hub" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#9CA3AF"/>
        <stop offset="70%" stop-color="#4B5563"/>
        <stop offset="100%" stop-color="#1F2937"/>
      </radialGradient>
    </defs>
    <rect width="800" height="600" fill="#111827"/>
    <!-- Machine Base Grid -->
    <path d="M0 100 H800 M0 200 H800 M0 300 H800 M0 400 H800 M0 500 H800 M100 0 V600 M200 0 V600 M300 0 V600 M400 0 V600 M500 0 V600 M600 0 V600 M700 0 V600" stroke="#1F2937" stroke-width="1" stroke-opacity="0.6"/>
    <!-- Cast Aluminum Alloy Housing Body -->
    <circle cx="400" cy="300" r="210" fill="url(#metal)" stroke="#9CA3AF" stroke-width="4"/>
    <circle cx="400" cy="300" r="160" fill="url(#hub)" stroke="#6B7280" stroke-width="2"/>
    <circle cx="400" cy="300" r="90" fill="#111827" stroke="#9CA3AF" stroke-width="3"/>
    <!-- Mounting Holes -->
    ${[0, 60, 120, 180, 240, 300]
      .map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const x = 400 + Math.cos(rad) * 125;
        const y = 300 + Math.sin(rad) * 125;
        return `<circle cx="${x}" cy="${y}" r="12" fill="#111827" stroke="#9CA3AF" stroke-width="2"/>`;
      })
      .join("")}
    <!-- Center Shaft Bore -->
    <circle cx="400" cy="300" r="50" fill="#030712" stroke="#4B5563" stroke-width="2"/>
    <circle cx="400" cy="300" r="30" fill="#1F2937"/>
    <!-- Part Stamping Text -->
    <text x="400" y="475" fill="#9CA3AF" font-family="monospace" font-size="12" text-anchor="middle" letter-spacing="3">CAST-ALLOY-AL6061 • STN-04</text>
    ${
      isPorosity
        ? `<!-- Localized Porosity Voids Anomaly -->
           <circle cx="416" cy="288" r="14" fill="#000000" stroke="#EF4444" stroke-width="2"/>
           <circle cx="430" cy="275" r="9" fill="#000000" stroke="#EF4444" stroke-width="1.5"/>
           <circle cx="405" cy="300" r="8" fill="#000000" stroke="#EF4444" stroke-width="1.5"/>
           <circle cx="422" cy="305" r="11" fill="#000000" stroke="#EF4444" stroke-width="2"/>
           <circle cx="440" cy="295" r="7" fill="#000000" stroke="#EF4444" stroke-width="1.2"/>`
        : isCrack
        ? `<!-- Surface Fatigue Micro-Crack -->
           <path d="M 390 260 Q 405 285 416 295 T 445 330" fill="none" stroke="#EF4444" stroke-width="3.5" stroke-linecap="round"/>
           <path d="M 416 295 Q 430 305 440 310" fill="none" stroke="#EF4444" stroke-width="2"/>
           <path d="M 405 285 Q 395 290 388 300" fill="none" stroke="#EF4444" stroke-width="1.8"/>`
        : `<!-- Clean Machined Finish -->`
    }
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// Preset Library
const PRESETS: PresetScenario[] = [
  {
    id: "preset-ok",
    title: "Nominal Cast Hub",
    category: "Nominal Pass",
    isDefect: false,
    defectType: "nominal",
    confidence: 99.2,
    description: "Casting meets all surface and dimensional thresholds. Evaluated by Model 1 as nominal, bypassing Model 2 directly to report generation.",
    color: "#16A34A",
    imageSvg: createCastingSvg("nominal"),
    heatmapSvg: generateHeatmapSvg("nominal", false),
    gateDecision: "GO",
    telemetry: {
      mold_temp: 685.0,
      injection_pressure: 142.0,
      cooling_rate: 12.0,
      vibration: 1.1,
      machine_speed: 1200,
      humidity: 42.0,
    },
    reportText:
      "Component passed automated vision gate with 99.2% nominal confidence. Physical casting parameters remained centered inside Six Sigma corridor. Cleared for release to downstream machining.",
  },
  {
    id: "preset-porosity",
    title: "Porosity Void Cylinder",
    category: "Porosity Defect",
    isDefect: true,
    defectType: "porosity",
    confidence: 94.8,
    description: "Model 1 detects surface void. Routes into Model 2, which classifies porosity cluster and overlays Grad-CAM thermal gradient.",
    color: "#DC2626",
    imageSvg: createCastingSvg("porosity"),
    heatmapSvg: generateHeatmapSvg("porosity", true, 416, 288),
    culpritSensor: "injection_pressure",
    culpritZ: 3.2,
    gateDecision: "ADJUST",
    telemetry: {
      mold_temp: 635.0,
      injection_pressure: 174.0, // High drift
      cooling_rate: 24.0,
      vibration: 2.3,
      machine_speed: 1200,
      humidity: 42.0,
    },
    setpointFix: {
      parameter: "Injection Pack Pressure",
      current: 174.0,
      target: 142.0,
      unit: "bar",
      instruction: "Decrease hydraulic pack pressure setpoint to prevent molten gas entrainment and air voids.",
    },
    reportText:
      "Porosity void detected in quadrant 2. Multi-sensor telemetry correlates defect to hydraulic pack pressure breach (+3.2σ above nominal). Recalibrate pressure setpoint from 174 bar to 142 bar.",
  },
  {
    id: "preset-crack",
    title: "Fatigue Surface Crack",
    category: "Surface Crack",
    isDefect: true,
    defectType: "crack",
    confidence: 96.5,
    description: "Model 1 flags surface anomaly. Model 2 localizes linear stress fracture. Telemetry links issue to spindle vibration breach.",
    color: "#991B1B",
    imageSvg: createCastingSvg("crack"),
    heatmapSvg: generateHeatmapSvg("crack", true, 416, 295),
    culpritSensor: "vibration",
    culpritZ: 2.8,
    gateDecision: "CRITICAL STOP",
    telemetry: {
      mold_temp: 672.0,
      injection_pressure: 146.0,
      cooling_rate: 13.0,
      vibration: 2.8, // High vibration
      machine_speed: 1200,
      humidity: 44.0,
    },
    setpointFix: {
      parameter: "Machine Spindle Vibration",
      current: 2.8,
      target: 1.2,
      unit: "mm/s",
      instruction: "Halt line 04. Inspect lower arbor bearings and replace damaged clamp bushing before resuming.",
    },
    reportText:
      "Linear fatigue crack detected along structural rib. Vibration telemetry registered anomalous spindle resonance (+2.8σ deviation). Line halted pending mechanical inspection.",
  },
];

export default function SimulationPage() {
  // Current Simulation State
  const [stage, setStage] = useState<SimStage>("idle");
  const [activePreset, setActivePreset] = useState<PresetScenario>(PRESETS[1]); // Default to Porosity for rich demo
  const [currentImageSrc, setCurrentImageSrc] = useState<string>(PRESETS[1].imageSvg);
  const [currentHeatmapSrc, setCurrentHeatmapSrc] = useState<string>(PRESETS[1].heatmapSvg);
  const [isDefect, setIsDefect] = useState<boolean>(true);
  const [defectType, setDefectType] = useState<string>("porosity");
  const [confidence, setConfidence] = useState<number>(94.8);

  // Playback & Timing
  const [speed, setSpeed] = useState<number>(1.0); // 1.0x, 1.5x, 0.6x
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const isPausedRef = useRef<boolean>(false);
  isPausedRef.current = isPaused;

  // Active view toggle on the carrier image
  const [carrierView, setCarrierView] = useState<"original" | "heatmap" | "segmented" | "split">("segmented");
  const [splitPos, setSplitPos] = useState<number>(50);

  // Log console
  const [logs, setLogs] = useState<SimLog[]>([]);
  const consoleBottomRef = useRef<HTMLDivElement>(null);

  // File upload input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to add timestamped log
  const addLog = useCallback(
    (source: SimLog["source"], type: SimLog["type"], text: string) => {
      const now = new Date();
      const timeStr = `${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}.${String(
        Math.floor(now.getMilliseconds() / 10)
      ).padStart(2, "0")}`;

      setLogs((prev) => [
        ...prev.slice(-30), // keep last 30 logs
        { id: Math.random().toString(36).substring(2, 9), time: timeStr, source, type, text },
      ]);
    },
    []
  );

  // Scroll console to bottom on new log
  useEffect(() => {
    consoleBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Main Stepping Engine
  // Minimum base time per model as requested: ~1800ms base / speed multiplier
  const baseStepDuration = Math.round(1800 / speed);

  // Start Simulation from beginning
  const startSimulation = useCallback(
    (preset?: PresetScenario, customImageSrc?: string, customIsDefect?: boolean, customDefectType?: string) => {
      const active = preset || activePreset;
      const effectiveDefect = customIsDefect !== undefined ? customIsDefect : active.isDefect;
      const effectiveDefectType = customDefectType || active.defectType;
      const effectiveImage = customImageSrc || active.imageSvg;
      const effectiveHeatmap = customImageSrc
        ? generateHeatmapSvg(effectiveDefectType, effectiveDefect)
        : active.heatmapSvg;

      setIsDefect(effectiveDefect);
      setDefectType(effectiveDefectType);
      setCurrentImageSrc(effectiveImage);
      setCurrentHeatmapSrc(effectiveHeatmap);
      setCarrierView(effectiveDefect ? "segmented" : "original");

      setLogs([]);
      addLog("INTAKE", "info", "Carrier dock loaded: component image received into vision pipeline buffer.");
      setStage("intake");
    },
    [activePreset, addLog]
  );

  // Handle Preset selection
  const handleSelectPreset = (p: PresetScenario) => {
    setActivePreset(p);
    startSimulation(p);
  };

  // Handle Custom File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const b64 = reader.result as string;
      const isDefectiveName = file.name.toLowerCase().includes("defect") || file.name.toLowerCase().includes("crack") || file.name.toLowerCase().includes("poros");
      const determinedDefectType = file.name.toLowerCase().includes("crack")
        ? "crack"
        : file.name.toLowerCase().includes("poros")
        ? "porosity"
        : isDefectiveName
        ? "void"
        : "nominal";

      addLog("INTAKE", "info", `Uploaded custom image: '${file.name}' (${(file.size / 1024).toFixed(1)} KB).`);
      startSimulation(undefined, b64, isDefectiveName, determinedDefectType);
    };
    reader.readAsDataURL(file);
  };

  // State Transition Controller (respects minimum 1-2s per stage)
  useEffect(() => {
    if (stage === "idle" || isPaused) return;

    let timer: NodeJS.Timeout;

    if (stage === "intake") {
      timer = setTimeout(() => {
        addLog("MODEL_1", "info", "Routing to Model 1: Initializing ResNet-18 binary feature screening...");
        setStage("model1");
      }, Math.round(1400 / speed));
    } else if (stage === "model1") {
      timer = setTimeout(() => {
        if (isDefect) {
          addLog("MODEL_1", "warn", `Model 1 verdict: SURFACE ANOMALY DETECTED (Confidence: ${confidence}%).`);
          addLog("BRANCH", "warn", "FAST GATE BRANCH: Anomaly flagged -> Routing directly to Model 2 for deep localization & classification.");
          setStage("branching");
        } else {
          addLog("MODEL_1", "success", "Model 1 verdict: VERIFIED NOMINAL (Confidence: 99.2%).");
          addLog("BRANCH", "success", "FAST GATE BRANCH: Nominal pass corridor authorized -> Bypassing Model 2 directly to Telemetry verification!");
          setStage("branching");
        }
      }, baseStepDuration);
    } else if (stage === "branching") {
      timer = setTimeout(() => {
        if (isDefect) {
          addLog("MODEL_2", "info", "Model 2 Chamber: ResNet-18 Multi-Label & Grad-CAM JET heatmap layer computing...");
          setStage("model2");
        } else {
          addLog("TELEMETRY", "info", "Bypassed Model 2 -> Ingesting PLC multi-channel physical process telemetry stream...");
          setStage("telemetry");
        }
      }, Math.round(1200 / speed));
    } else if (stage === "model2") {
      timer = setTimeout(() => {
        addLog("MODEL_2", "success", `Model 2 classified: ${defectType.toUpperCase()} localized at centroid (X: 416, Y: 288). Grad-CAM JET overlay applied.`);
        addLog("TELEMETRY", "info", "Synchronizing PLC multi-channel sensor stream (Mold Temp, Pressure, Vibration, Cooling)...");
        setStage("telemetry");
      }, baseStepDuration);
    } else if (stage === "telemetry") {
      timer = setTimeout(() => {
        if (isDefect && activePreset.culpritSensor) {
          addLog(
            "TELEMETRY",
            "warn",
            `Telemetry Corroboration: Out-of-tolerance drift detected on ${activePreset.culpritSensor.replace(/_/g, " ")} (+${activePreset.culpritZ}σ).`
          );
        } else {
          addLog("TELEMETRY", "success", "Telemetry Corroboration: All 6 physical parameters stable within Six Sigma nominal corridor.");
        }
        addLog("REPORT", "info", "Dispatching to Gemini Multi-Modal Synthesis: Generating root cause diagnosis and setpoint instructions...");
        setStage("report");
      }, baseStepDuration);
    } else if (stage === "report") {
      timer = setTimeout(() => {
        addLog("REPORT", "success", `Incident dossier compiled. Gate Decision: ${activePreset.gateDecision}. Returning finalized payload to dashboard.`);
        setStage("completed");
      }, baseStepDuration);
    }

    return () => clearTimeout(timer);
  }, [stage, isPaused, speed, isDefect, defectType, confidence, activePreset, addLog, baseStepDuration]);

  // Restart / Reset
  const handleReset = () => {
    setStage("idle");
    setLogs([]);
    addLog("SYSTEM", "info", "Simulation reset. Ready for next component intake.");
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F5] text-[#1C1917]">
      {/* Top Application Header */}
      <LinenHeader />

      {/* Main Simulation Stage Container */}
      <div className="flex-1 max-w-[1720px] w-full mx-auto p-3 sm:p-5 lg:p-6 flex flex-col gap-4 sm:gap-5">
        {/* =========================================================================
            1. SIMULATION CONTROL BAR & PLAYBACK CONTROLS
        ========================================================================= */}
        <div className="bg-[#FFFFFF] border border-[#E5DFD3] rounded-2xl p-3.5 sm:p-4 shadow-xs flex flex-wrap items-center justify-between gap-3.5">
          {/* Left: Title + Mode Badge */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1C1917] text-[#FAF8F5] flex items-center justify-center shrink-0 shadow-xs">
              <Cpu className="w-5 h-5 text-[#FAF8F5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-[#1C1917] tracking-tight">
                  Animated Pipeline Simulation
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#F0FDF4] border border-[#86EFAC] text-[#166534]">
                  LIVE ENGINE
                </span>
              </div>
              <p className="text-xs text-[#78716A]">
                Visualizing component flow from Binary Gate screening through Deep Localization, Telemetry, and Gemini Synthesis.
              </p>
            </div>
          </div>

          {/* Right: Quick Action Controls */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {/* Speed Selector */}
            <div className="flex items-center gap-1 bg-[#FAF8F5] p-1 rounded-xl border border-[#E5DFD3] text-xs">
              <span className="text-[10px] font-mono text-[#78716A] px-1.5 uppercase font-semibold">Pacing:</span>
              {[
                { label: "1x", val: 1.0 },
                { label: "1.5x", val: 1.5 },
                { label: "0.6x", val: 0.6 },
              ].map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => setSpeed(s.val)}
                  className={`px-2 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    speed === s.val
                      ? "bg-[#1C1917] text-[#FAF8F5] shadow-2xs"
                      : "text-[#57534E] hover:text-[#1C1917] hover:bg-[#F3EFE6]"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Play / Pause Toggle */}
            {stage !== "idle" && stage !== "completed" && (
              <button
                type="button"
                onClick={() => setIsPaused((prev) => !prev)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#DDD5C7] bg-[#FAF8F5] hover:bg-[#F3EFE6] text-xs font-semibold cursor-pointer text-[#1C1917] transition-colors"
              >
                {isPaused ? <Play className="w-3.5 h-3.5 text-[#16A34A]" /> : <Pause className="w-3.5 h-3.5 text-[#D97706]" />}
                <span>{isPaused ? "Resume" : "Pause"}</span>
              </button>
            )}

            {/* Restart Button */}
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#DDD5C7] bg-[#FAF8F5] hover:bg-[#F3EFE6] text-xs font-semibold text-[#57534E] hover:text-[#1C1917] cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#78716A]" />
              <span>Reset</span>
            </button>

            {/* Upload Custom Component Image */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#1C1917] hover:bg-[#2C2724] text-[#FAF8F5] text-xs font-semibold cursor-pointer transition-colors shadow-xs"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Image</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        </div>

        {/* =========================================================================
            2. INTERACTIVE PIPELINE FLOW CONVEYOR SCHEMATIC (TOP GRAPHIC)
            Shows the exact branching logic:
            [0. Intake] -> [1. Model 1 Binary Gate]
                             ├── If OK ─────────────► (BYPASS) ────────────┐
                             └── If Defect ─► [2. Model 2 Deep] ─► [3. Telemetry] ─► [4. Synthesis] ─► [5. Dashboard]
        ========================================================================= */}
        <div className="bg-[#FFFFFF] border border-[#E5DFD3] rounded-2xl p-4 sm:p-5 shadow-xs overflow-hidden">
          <div className="flex items-center justify-between pb-3 border-b border-[#F2ECE1] text-xs mb-4">
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#1C1917] uppercase tracking-wider text-[11px]">
                Autonomous Routing Schematic
              </span>
              <span className="text-[10px] font-mono text-[#78716A]">
                Two-Tier Vision Gate + Telemetry Synthesis
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-mono text-[#78716A]">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#16A34A]" /> Nominal Bypass
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#DC2626]" /> Defect Routing
              </span>
            </div>
          </div>

          {/* Graphical Pipeline Stages Row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
            {/* Step 1: Intake */}
            <div
              className={`p-3 rounded-xl border text-xs transition-all relative overflow-hidden ${
                stage === "intake"
                  ? "bg-[#FFFDF5] border-[#D97706] ring-2 ring-[#D97706]/30 shadow-xs"
                  : stage !== "idle"
                  ? "bg-[#FAF8F5] border-[#86EFAC] text-[#166534]"
                  : "bg-[#FCFBF8] border-[#E5DFD3] text-[#78716A]"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[10px] font-bold">01 INGEST</span>
                <Camera className="w-3.5 h-3.5" />
              </div>
              <div className="font-bold text-[#1C1917]">Optical Intake</div>
              <div className="text-[10px] text-[#78716A] mt-0.5">Matrix Calibration</div>
              {stage === "intake" && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#D97706] animate-pulse" />
              )}
            </div>

            {/* Step 2: Model 1 Binary Gate */}
            <div
              className={`p-3 rounded-xl border text-xs transition-all relative overflow-hidden ${
                stage === "model1"
                  ? "bg-[#FFFBEB] border-[#D97706] ring-2 ring-[#D97706]/30 shadow-xs"
                  : stage === "branching" || stage === "model2" || stage === "telemetry" || stage === "report" || stage === "completed"
                  ? isDefect
                    ? "bg-[#FEF2F2] border-[#FCA5A5] text-[#991B1B]"
                    : "bg-[#F0FDF4] border-[#86EFAC] text-[#166534]"
                  : "bg-[#FCFBF8] border-[#E5DFD3] text-[#78716A]"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[10px] font-bold">02 GATE</span>
                <Cpu className="w-3.5 h-3.5" />
              </div>
              <div className="font-bold text-[#1C1917]">Model 1: Binary</div>
              <div className="text-[10px] text-[#78716A] mt-0.5">ResNet-18 Screening</div>
              {stage === "model1" && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#D97706] animate-pulse" />
              )}
            </div>

            {/* Step 3: Model 2 Deep Classifier (or Bypassed if OK) */}
            <div
              className={`p-3 rounded-xl border text-xs transition-all relative overflow-hidden ${
                stage === "model2"
                  ? "bg-[#FFF5F5] border-[#DC2626] ring-2 ring-[#DC2626]/30 shadow-xs"
                  : stage === "branching"
                  ? "bg-[#FFFBEB] border-[#FDE68A]"
                  : stage === "telemetry" || stage === "report" || stage === "completed"
                  ? isDefect
                    ? "bg-[#FEF2F2] border-[#FCA5A5] text-[#991B1B]"
                    : "bg-[#F0FDF4]/50 border-[#E5DFD3] text-[#78716A] opacity-60"
                  : "bg-[#FCFBF8] border-[#E5DFD3] text-[#78716A]"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[10px] font-bold">03 DIAGNOSTIC</span>
                <Tags className="w-3.5 h-3.5" />
              </div>
              <div className="font-bold text-[#1C1917]">
                {!isDefect && (stage === "telemetry" || stage === "report" || stage === "completed")
                  ? "Model 2: Bypassed"
                  : "Model 2: Deep"}
              </div>
              <div className="text-[10px] text-[#78716A] mt-0.5">
                {!isDefect && (stage === "telemetry" || stage === "report" || stage === "completed")
                  ? "✓ Skipped (Part OK)"
                  : "Grad-CAM + Heatmap"}
              </div>
              {stage === "model2" && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#DC2626] animate-pulse" />
              )}
            </div>

            {/* Step 4: Process Telemetry Corroboration */}
            <div
              className={`p-3 rounded-xl border text-xs transition-all relative overflow-hidden ${
                stage === "telemetry"
                  ? "bg-[#FFFDF5] border-[#D97706] ring-2 ring-[#D97706]/30 shadow-xs"
                  : stage === "report" || stage === "completed"
                  ? "bg-[#FAF8F5] border-[#86EFAC] text-[#166534]"
                  : "bg-[#FCFBF8] border-[#E5DFD3] text-[#78716A]"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[10px] font-bold">04 SENSORS</span>
                <Activity className="w-3.5 h-3.5" />
              </div>
              <div className="font-bold text-[#1C1917]">Process Telemetry</div>
              <div className="text-[10px] text-[#78716A] mt-0.5">PLC Corroboration</div>
              {stage === "telemetry" && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#D97706] animate-pulse" />
              )}
            </div>

            {/* Step 5: Gemini Executive Synthesis */}
            <div
              className={`p-3 rounded-xl border text-xs transition-all relative overflow-hidden ${
                stage === "report"
                  ? "bg-[#FFFDF5] border-[#D97706] ring-2 ring-[#D97706]/30 shadow-xs"
                  : stage === "completed"
                  ? "bg-[#FAF8F5] border-[#86EFAC] text-[#166534]"
                  : "bg-[#FCFBF8] border-[#E5DFD3] text-[#78716A]"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[10px] font-bold">05 SYNTHESIS</span>
                <Sparkles className="w-3.5 h-3.5 text-[#D97706]" />
              </div>
              <div className="font-bold text-[#1C1917]">Executive Report</div>
              <div className="text-[10px] text-[#78716A] mt-0.5">Gemini 1.5 Flash</div>
              {stage === "report" && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#D97706] animate-pulse" />
              )}
            </div>

            {/* Step 6: Dispatch & Dashboard Result */}
            <div
              className={`p-3 rounded-xl border text-xs transition-all relative overflow-hidden ${
                stage === "completed"
                  ? isDefect
                    ? "bg-[#FEF2F2] border-[#FCA5A5] text-[#991B1B] shadow-xs"
                    : "bg-[#F0FDF4] border-[#86EFAC] text-[#166534] shadow-xs"
                  : "bg-[#FCFBF8] border-[#E5DFD3] text-[#78716A]"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[10px] font-bold">06 DOSSIER</span>
                <FileText className="w-3.5 h-3.5" />
              </div>
              <div className="font-bold text-[#1C1917]">Studio Dashboard</div>
              <div className="text-[10px] text-[#78716A] mt-0.5">Final Gate Verdict</div>
            </div>
          </div>
        </div>

        {/* =========================================================================
            3. PRESET QUICK-PICK CARDS (Available anytime for instant testing)
        ========================================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {PRESETS.map((p) => {
            const isSelected = activePreset.id === p.id;
            return (
              <div
                key={p.id}
                onClick={() => handleSelectPreset(p)}
                className={`p-3.5 rounded-2xl border cursor-pointer transition-all hover:shadow-xs flex items-center justify-between gap-3 ${
                  isSelected
                    ? "bg-[#FFFFFF] border-[#1C1917] ring-1 ring-[#1C1917]"
                    : "bg-[#FFFFFF] border-[#E5DFD3] hover:border-[#DDD5C7]"
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: p.color }}
                    />
                    <span className="text-xs font-bold text-[#1C1917] truncate">{p.title}</span>
                    <span
                      className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-md ${
                        p.isDefect ? "bg-[#FEF2F2] text-[#991B1B]" : "bg-[#F0FDF4] text-[#166534]"
                      }`}
                    >
                      {p.category}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#78716A] mt-1 line-clamp-1">{p.description}</p>
                </div>

                <button
                  type="button"
                  className="px-2.5 py-1 rounded-lg bg-[#FAF8F5] border border-[#DDD5C7] text-[11px] font-semibold text-[#1C1917] shrink-0 hover:bg-[#F3EFE6]"
                >
                  Simulate →
                </button>
              </div>
            );
          })}
        </div>

        {/* =========================================================================
            4. MAIN SPLIT WORKSPACE:
            LEFT: The Animated Traveling Carrier Capsule & Image Overlays
            RIGHT: Real-Time Neural & Telemetry Inspector
        ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-start">
          {/* =======================================================================
              LEFT (7 Cols): TRAVELING PART CARRIER CAPSULE
          ======================================================================= */}
          <div className="lg:col-span-7 bg-[#FFFFFF] border border-[#E5DFD3] rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col gap-4">
            {/* Header / Active Stage Indicator on the Carrier */}
            <div className="flex items-center justify-between gap-2 border-b border-[#F2ECE1] pb-3 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#16A34A] animate-ping" />
                <span className="font-bold text-[#1C1917]">Optical Process Chamber</span>
                <span className="font-mono text-[10px] text-[#78716A] px-2 py-0.5 rounded-full bg-[#FAF8F5] border border-[#E5DFD3]">
                  {stage === "idle"
                    ? "STANDBY"
                    : stage === "intake"
                    ? "ALIGNING SENSORS"
                    : stage === "model1"
                    ? "SCANNING MODEL 1"
                    : stage === "branching"
                    ? "BRANCH DECISION"
                    : stage === "model2"
                    ? "DEEP CLASSIFIER"
                    : stage === "telemetry"
                    ? "TELEMETRY SYNC"
                    : stage === "report"
                    ? "REPORT COMPILING"
                    : "INSPECTION COMPLETE"}
                </span>
              </div>

              {/* View Overlay Mode Switcher */}
              <div className="flex items-center gap-1 bg-[#FAF8F5] p-1 rounded-xl border border-[#E5DFD3] text-xs">
                <button
                  type="button"
                  onClick={() => setCarrierView("original")}
                  className={`px-2 py-1 rounded-lg font-medium text-[11px] cursor-pointer transition-colors ${
                    carrierView === "original" ? "bg-[#1C1917] text-[#FAF8F5] font-semibold" : "text-[#57534E]"
                  }`}
                >
                  Raw Photo
                </button>
                <button
                  type="button"
                  onClick={() => setCarrierView("heatmap")}
                  className={`px-2 py-1 rounded-lg font-medium text-[11px] cursor-pointer transition-colors ${
                    carrierView === "heatmap" ? "bg-[#1C1917] text-[#FAF8F5] font-semibold" : "text-[#57534E]"
                  }`}
                >
                  Grad-CAM
                </button>
                <button
                  type="button"
                  onClick={() => setCarrierView("segmented")}
                  className={`px-2 py-1 rounded-lg font-medium text-[11px] cursor-pointer transition-colors ${
                    carrierView === "segmented" ? "bg-[#1C1917] text-[#FAF8F5] font-semibold" : "text-[#57534E]"
                  }`}
                >
                  Overlay
                </button>
                <button
                  type="button"
                  onClick={() => setCarrierView("split")}
                  className={`px-2 py-1 rounded-lg font-medium text-[11px] cursor-pointer transition-colors ${
                    carrierView === "split" ? "bg-[#1C1917] text-[#FAF8F5] font-semibold" : "text-[#57534E]"
                  }`}
                >
                  Split Slider
                </button>
              </div>
            </div>

            {/* The Physical Part Carrier Frame */}
            <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-[#111827] border border-[#374151] flex items-center justify-center select-none shadow-inner">
              {/* Carrier Corner Alignment Reticles */}
              <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-[#60A5FA] z-20" />
              <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-[#60A5FA] z-20" />
              <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-[#60A5FA] z-20" />
              <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-[#60A5FA] z-20" />

              {/* Background Part Image */}
              {carrierView === "original" ? (
                <img
                  src={currentImageSrc}
                  alt="Component"
                  className="w-full h-full object-contain"
                />
              ) : carrierView === "heatmap" ? (
                <img
                  src={currentHeatmapSrc}
                  alt="Grad-CAM JET Heatmap"
                  className="w-full h-full object-contain mix-blend-screen"
                />
              ) : carrierView === "segmented" ? (
                <div className="relative w-full h-full flex items-center justify-center">
                  <img
                    src={currentImageSrc}
                    alt="Component"
                    className="w-full h-full object-contain"
                  />
                  {/* Heatmap overlay with opacity depending on defect */}
                  {isDefect && (stage === "model2" || stage === "telemetry" || stage === "report" || stage === "completed") && (
                    <img
                      src={currentHeatmapSrc}
                      alt="Thermal Gradient Overlay"
                      className="absolute inset-0 w-full h-full object-contain mix-blend-screen opacity-70 transition-opacity duration-700 pointer-events-none"
                    />
                  )}
                </div>
              ) : (
                /* Split Slider Mode */
                <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                  <img
                    src={currentImageSrc}
                    alt="Original"
                    className="absolute inset-0 w-full h-full object-contain"
                  />
                  <div
                    className="absolute inset-0 overflow-hidden"
                    style={{ clipPath: `inset(0 ${100 - splitPos}% 0 0)` }}
                  >
                    <img
                      src={currentHeatmapSrc}
                      alt="Heatmap"
                      className="absolute inset-0 w-full h-full object-contain mix-blend-screen"
                    />
                  </div>
                  {/* Slider separator bar */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-[#FFFFFF] shadow-[0_0_10px_rgba(255,255,255,0.8)] z-30 pointer-events-none"
                    style={{ left: `${splitPos}%` }}
                  >
                    <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-[#1C1917] border-2 border-white flex items-center justify-center text-[9px] text-white font-bold">
                      ↔
                    </div>
                  </div>
                </div>
              )}

              {/* Scanning Laser Beam (Active during Model 1 and Model 2 processing) */}
              {(stage === "intake" || stage === "model1" || stage === "model2") && !isPaused && (
                <div className="pointer-events-none absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#00E5FF] to-transparent shadow-[0_0_15px_#00E5FF] z-20 animate-laser-sweep" />
              )}

              {/* Grid Matrix Alignment Overlay during Stage 1 */}
              {(stage === "intake" || stage === "model1") && (
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(0,229,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(0,229,255,0.06)_1px,transparent_1px)] bg-[size:32px_32px] z-10" />
              )}

              {/* Defect Bounding Box & Coordinate Crosshairs (Appears in Model 2 / Finished) */}
              {isDefect && (stage === "model2" || stage === "telemetry" || stage === "report" || stage === "completed") && (
                <div
                  className="absolute z-20 border-2 border-[#EF4444] rounded-lg bg-[#EF4444]/15 shadow-[0_0_12px_rgba(239,68,68,0.5)] flex flex-col justify-between p-1.5 transition-all duration-500 pointer-events-none"
                  style={{
                    left: "46%",
                    top: "42%",
                    width: "22%",
                    height: "22%",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="bg-[#EF4444] text-white text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shadow-2xs">
                      {defectType.toUpperCase()}
                    </span>
                    <span className="text-[9px] font-mono text-white font-bold">
                      {confidence}%
                    </span>
                  </div>
                  <div className="text-[8px] font-mono text-white/80 self-end">
                    (X: 416, Y: 288)
                  </div>
                </div>
              )}

              {/* Nominal Stamp Banner if OK */}
              {!isDefect && (stage === "branching" || stage === "telemetry" || stage === "report" || stage === "completed") && (
                <div className="absolute top-4 right-4 z-20 bg-[#F0FDF4]/95 border border-[#86EFAC] text-[#166534] px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md">
                  <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
                  <span>NOMINAL SURFACE PASS</span>
                </div>
              )}

              {/* Defect Stamp Banner if Defect */}
              {isDefect && (stage === "branching" || stage === "model2" || stage === "telemetry" || stage === "report" || stage === "completed") && (
                <div className="absolute top-4 right-4 z-20 bg-[#FEF2F2]/95 border border-[#FCA5A5] text-[#991B1B] px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md">
                  <AlertTriangle className="w-4 h-4 text-[#DC2626]" />
                  <span>DEFECT IDENTIFIED: {defectType.toUpperCase()}</span>
                </div>
              )}

              {/* Bottom Carrier Telemetry Overlay Bar */}
              <div className="absolute bottom-3 left-4 right-4 z-20 flex items-center justify-between text-[10px] font-mono text-white/70 bg-[#0F172A]/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10">
                <span>STATION: 04 • AL6061</span>
                <span>RES: 800×600 PX</span>
                <span className="text-[#38BDF8]">SPEED: {speed}X</span>
                <span>STATUS: {stage.toUpperCase()}</span>
              </div>
            </div>

            {/* Split Slider Scrub Bar (only visible when in Split view) */}
            {carrierView === "split" && (
              <div className="flex items-center gap-3 px-2">
                <span className="text-xs font-mono text-[#78716A]">Photo</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={splitPos}
                  onChange={(e) => setSplitPos(Number(e.target.value))}
                  className="flex-1 accent-[#1C1917] cursor-pointer"
                />
                <span className="text-xs font-mono text-[#78716A]">Grad-CAM Heatmap</span>
              </div>
            )}
          </div>

          {/* =======================================================================
              RIGHT (5 Cols): LIVE NEURAL DIAGNOSTICS & TELEMETRY INSPECTOR
          ======================================================================= */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            {/* Dynamic Stage Info Card */}
            <div className="bg-[#FFFFFF] border border-[#E5DFD3] rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[#F2ECE1] pb-3">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-[#1C1917]" />
                  <h3 className="text-xs font-bold text-[#1C1917] uppercase tracking-wider">
                    {stage === "idle"
                      ? "Ready for Ingestion"
                      : stage === "intake"
                      ? "Stage 1: Optical Intake"
                      : stage === "model1"
                      ? "Stage 2: Model 1 Gate"
                      : stage === "branching"
                      ? "Fast Gate Decision"
                      : stage === "model2"
                      ? "Stage 3: Model 2 Deep Classifier"
                      : stage === "telemetry"
                      ? "Stage 4: Telemetry Corroboration"
                      : stage === "report"
                      ? "Stage 5: Gemini Synthesis"
                      : "Inspection Complete"}
                  </h3>
                </div>

                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                    stage === "completed"
                      ? isDefect
                        ? "bg-[#FEF2F2] text-[#991B1B]"
                        : "bg-[#F0FDF4] text-[#166534]"
                      : "bg-[#FAF8F5] text-[#78716A] border border-[#E5DFD3]"
                  }`}
                >
                  {stage.toUpperCase()}
                </span>
              </div>

              {/* Dynamic Body Content according to active simulation stage */}
              {stage === "idle" && (
                <div className="text-center py-6 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#FAF8F5] border border-[#E5DFD3] mx-auto flex items-center justify-center text-[#78716A]">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#1C1917]">No Active Component in Carrier</h4>
                    <p className="text-[11px] text-[#78716A] max-w-xs mx-auto mt-1">
                      Upload an image or click any of the 3 presets above to trigger the autonomous flow.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSelectPreset(PRESETS[1])}
                    className="px-4 py-2 rounded-xl bg-[#1C1917] text-[#FAF8F5] text-xs font-semibold cursor-pointer shadow-xs hover:bg-[#2C2724]"
                  >
                    Run Porosity Simulation →
                  </button>
                </div>
              )}

              {/* Stage: Model 1 Binary Screening */}
              {(stage === "intake" || stage === "model1" || stage === "branching") && (
                <div className="space-y-3.5 text-xs">
                  <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#E5DFD3] space-y-2">
                    <div className="flex justify-between text-[11px]">
                      <span className="font-semibold text-[#1C1917]">Model 1 Architecture</span>
                      <span className="font-mono text-[#78716A]">ResNet-18 Binary</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="font-semibold text-[#1C1917]">Primary Task</span>
                      <span className="font-mono text-[#78716A]">Nominal vs Defect Gate</span>
                    </div>
                  </div>

                  {/* Softmax Probability Bars */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-[11px]">
                      <span className="font-medium text-[#1C1917]">Nominal Corridor Probability</span>
                      <span className="font-mono font-bold text-[#166534]">
                        {isDefect ? "5.2%" : "99.2%"}
                      </span>
                    </div>
                    <div className="w-full bg-[#E5DFD3] h-2 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#22C55E] transition-all duration-500"
                        style={{ width: isDefect ? "5.2%" : "99.2%" }}
                      />
                    </div>

                    <div className="flex justify-between text-[11px] pt-1">
                      <span className="font-medium text-[#1C1917]">Anomaly Defect Probability</span>
                      <span className="font-mono font-bold text-[#DC2626]">
                        {isDefect ? "94.8%" : "0.8%"}
                      </span>
                    </div>
                    <div className="w-full bg-[#E5DFD3] h-2 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#EF4444] transition-all duration-500"
                        style={{ width: isDefect ? "94.8%" : "0.8%" }}
                      />
                    </div>
                  </div>

                  {/* Branch Decision Callout */}
                  {stage === "branching" && (
                    <div
                      className={`p-3 rounded-xl border text-xs space-y-1 ${
                        isDefect
                          ? "bg-[#FEF2F2] border-[#FCA5A5] text-[#991B1B]"
                          : "bg-[#F0FDF4] border-[#86EFAC] text-[#166534]"
                      }`}
                    >
                      <div className="font-bold flex items-center gap-1.5">
                        {isDefect ? <AlertTriangle className="w-4 h-4 text-[#DC2626]" /> : <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />}
                        <span>{isDefect ? "Routing to Model 2 Deep Classifier" : "Bypassing Model 2 Deep Classifier"}</span>
                      </div>
                      <p className="text-[11px] opacity-90">
                        {isDefect
                          ? "Surface voids detected. Transferring component to deep classification and Grad-CAM localization model."
                          : "Component passed binary check. Forwarding directly to telemetry verification and release report."}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Stage: Model 2 Deep Localization */}
              {stage === "model2" && (
                <div className="space-y-3.5 text-xs">
                  <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FCA5A5] space-y-2">
                    <div className="flex justify-between text-[11px]">
                      <span className="font-semibold text-[#991B1B]">Model 2 Engine</span>
                      <span className="font-mono text-[#991B1B]">ResNet-18 Multi-Label + Grad-CAM</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="font-semibold text-[#991B1B]">Classified Defect</span>
                      <span className="font-mono font-bold uppercase text-[#DC2626]">{defectType}</span>
                    </div>
                  </div>

                  {/* Defect Class Distribution */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-[11px]">
                      <span className="font-medium text-[#1C1917]">Porosity Void</span>
                      <span className="font-mono font-bold text-[#DC2626]">
                        {defectType === "porosity" ? "94.8%" : "4.1%"}
                      </span>
                    </div>
                    <div className="w-full bg-[#E5DFD3] h-1.5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#EF4444]"
                        style={{ width: defectType === "porosity" ? "94.8%" : "4.1%" }}
                      />
                    </div>

                    <div className="flex justify-between text-[11px]">
                      <span className="font-medium text-[#1C1917]">Surface Fatigue Crack</span>
                      <span className="font-mono font-bold text-[#DC2626]">
                        {defectType === "crack" ? "96.5%" : "2.4%"}
                      </span>
                    </div>
                    <div className="w-full bg-[#E5DFD3] h-1.5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#EF4444]"
                        style={{ width: defectType === "crack" ? "96.5%" : "2.4%" }}
                      />
                    </div>
                  </div>

                  {/* Grad-CAM Thermal Localization Coordinates */}
                  <div className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[#E5DFD3] grid grid-cols-2 gap-2 text-[11px] font-mono">
                    <div>Centroid: X=416, Y=288</div>
                    <div>Hotspot Area: 14.2%</div>
                    <div>Peak Thermal Z: +4.85σ</div>
                    <div>Confidence: {confidence}%</div>
                  </div>
                </div>
              )}

              {/* Stage: Process Telemetry Corroboration */}
              {stage === "telemetry" && (
                <div className="space-y-3.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#1C1917]">Physical PLC Telemetry Corroboration</span>
                    <span className="font-mono text-[10px] text-[#78716A]">MongoDB Atlas Stream</span>
                  </div>

                  {/* 6 Sensor Dials Grid */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="p-2.5 rounded-xl border border-[#E5DFD3] bg-[#FAF8F5] text-[11px] space-y-0.5">
                      <div className="text-[#78716A]">Mold Temperature</div>
                      <div className="font-mono font-bold text-[#1C1917]">
                        {activePreset.telemetry.mold_temp}°C
                      </div>
                      <span className="text-[10px] text-[#166534]">Nominal corridor (680–690°C)</span>
                    </div>

                    <div
                      className={`p-2.5 rounded-xl border text-[11px] space-y-0.5 ${
                        activePreset.culpritSensor === "injection_pressure"
                          ? "bg-[#FEF2F2] border-[#FCA5A5] ring-1 ring-[#DC2626]/20"
                          : "bg-[#FAF8F5] border-[#E5DFD3]"
                      }`}
                    >
                      <div className="text-[#78716A]">Injection Pressure</div>
                      <div
                        className={`font-mono font-bold ${
                          activePreset.culpritSensor === "injection_pressure" ? "text-[#DC2626]" : "text-[#1C1917]"
                        }`}
                      >
                        {activePreset.telemetry.injection_pressure} bar
                      </div>
                      <span
                        className={`text-[10px] ${
                          activePreset.culpritSensor === "injection_pressure" ? "text-[#DC2626] font-bold" : "text-[#166534]"
                        }`}
                      >
                        {activePreset.culpritSensor === "injection_pressure" ? "+3.2σ Out of Tolerance!" : "Nominal (140–145 bar)"}
                      </span>
                    </div>

                    <div
                      className={`p-2.5 rounded-xl border text-[11px] space-y-0.5 ${
                        activePreset.culpritSensor === "vibration"
                          ? "bg-[#FEF2F2] border-[#FCA5A5] ring-1 ring-[#DC2626]/20"
                          : "bg-[#FAF8F5] border-[#E5DFD3]"
                      }`}
                    >
                      <div className="text-[#78716A]">Machine Vibration</div>
                      <div
                        className={`font-mono font-bold ${
                          activePreset.culpritSensor === "vibration" ? "text-[#DC2626]" : "text-[#1C1917]"
                        }`}
                      >
                        {activePreset.telemetry.vibration} mm/s
                      </div>
                      <span
                        className={`text-[10px] ${
                          activePreset.culpritSensor === "vibration" ? "text-[#DC2626] font-bold" : "text-[#166534]"
                        }`}
                      >
                        {activePreset.culpritSensor === "vibration" ? "+2.8σ Spindle Deviation!" : "Nominal (1.0–1.3 mm/s)"}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl border border-[#E5DFD3] bg-[#FAF8F5] text-[11px] space-y-0.5">
                      <div className="text-[#78716A]">Cooling Rate</div>
                      <div className="font-mono font-bold text-[#1C1917]">
                        {activePreset.telemetry.cooling_rate} L/min
                      </div>
                      <span className="text-[10px] text-[#166534]">Nominal corridor</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Stage: Gemini Executive Report Synthesis */}
              {(stage === "report" || stage === "completed") && (
                <div className="space-y-3.5 text-xs">
                  {/* Gatekeeper Decision Banner */}
                  <div
                    className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                      activePreset.gateDecision === "GO"
                        ? "bg-[#F0FDF4] border-[#86EFAC] text-[#166534]"
                        : activePreset.gateDecision === "ADJUST"
                        ? "bg-[#FFFBEB] border-[#FDE68A] text-[#92400E]"
                        : "bg-[#FEF2F2] border-[#FCA5A5] text-[#991B1B]"
                    }`}
                  >
                    <div>
                      <div className="text-[10px] uppercase font-bold tracking-wider">Gatekeeper Verdict</div>
                      <div className="text-sm font-bold mt-0.5">
                        DECISION: {activePreset.gateDecision}
                      </div>
                    </div>
                    <div className="text-[11px] font-mono font-semibold px-2.5 py-1 rounded-lg bg-white/60">
                      {isDefect ? "Quarantine Batch" : "Authorize Release"}
                    </div>
                  </div>

                  {/* Gemini Streaming Report Card */}
                  <div className="p-3.5 rounded-xl bg-[#FCFBF8] border border-[#E5DFD3] space-y-2">
                    <div className="flex items-center gap-1.5 font-bold text-[#1C1917] text-[11px]">
                      <Sparkles className="w-3.5 h-3.5 text-[#D97706]" />
                      <span>Gemini 1.5 Flash Incident Synthesis</span>
                    </div>
                    <p className="text-[#57534E] leading-relaxed text-[11px]">
                      {activePreset.reportText}
                    </p>
                  </div>

                  {/* Recommended Setpoint Fix if Defect */}
                  {activePreset.setpointFix && (
                    <div className="p-3 rounded-xl bg-[#FFFDF5] border border-[#FDE68A] space-y-1.5 text-xs">
                      <div className="font-bold text-[#92400E] flex items-center gap-1.5 text-[11px]">
                        <Gauge className="w-3.5 h-3.5 text-[#D97706]" />
                        <span>Predicted Setpoint Modification</span>
                      </div>
                      <p className="text-[11px] text-[#78716A]">
                        {activePreset.setpointFix.instruction}
                      </p>
                      <div className="font-mono text-[11px] font-bold text-[#1C1917] pt-1 border-t border-[#FDE68A]">
                        Current: {activePreset.setpointFix.current} {activePreset.setpointFix.unit} → Target:{" "}
                        <strong className="text-[#16A34A]">{activePreset.setpointFix.target} {activePreset.setpointFix.unit}</strong>
                      </div>
                    </div>
                  )}

                  {/* Action Link: Open in Full Studio Dashboard */}
                  {stage === "completed" && (
                    <div className="pt-2 flex items-center gap-2">
                      <Link
                        href="/dashboard"
                        className="flex-1 py-2 px-3 rounded-xl bg-[#1C1917] hover:bg-[#2C2724] text-[#FAF8F5] font-semibold text-center text-xs transition-colors shadow-xs flex items-center justify-center gap-1.5"
                      >
                        <span>Open in Inspection Studio</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => startSimulation()}
                        className="py-2 px-3 rounded-xl border border-[#DDD5C7] bg-[#FAF8F5] hover:bg-[#F3EFE6] text-xs font-semibold text-[#1C1917] transition-colors"
                      >
                        Replay
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* =========================================================================
            5. LIVE ENGINEERING CONSOLE STREAM (BOTTOM REAL-TIME LOG)
        ========================================================================= */}
        <div className="bg-[#111827] border border-[#374151] rounded-2xl p-4 shadow-sm text-xs font-mono overflow-hidden">
          <div className="flex items-center justify-between pb-2.5 border-b border-[#1F2937] text-white/60 mb-2.5">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-[#38BDF8]" />
              <span className="font-bold text-white text-[11px] uppercase tracking-wider">
                Engineering Telemetry & Model Dispatch Console
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
              <span>LIVE LOG STREAM</span>
            </div>
          </div>

          <div className="h-28 overflow-y-auto space-y-1.5 pr-2 scrollbar-thin text-[11px]">
            {logs.length === 0 ? (
              <div className="text-white/40 italic">Waiting for simulation events...</div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="flex items-start gap-2.5 leading-relaxed">
                  <span className="text-white/40 shrink-0">[{log.time}]</span>
                  <span
                    className={`font-bold shrink-0 ${
                      log.source === "MODEL_1"
                        ? "text-[#60A5FA]"
                        : log.source === "MODEL_2"
                        ? "text-[#F87171]"
                        : log.source === "BRANCH"
                        ? "text-[#FBBF24]"
                        : log.source === "TELEMETRY"
                        ? "text-[#34D399]"
                        : log.source === "REPORT"
                        ? "text-[#A78BFA]"
                        : "text-[#9CA3AF]"
                    }`}
                  >
                    {log.source}:
                  </span>
                  <span
                    className={`${
                      log.type === "warn"
                        ? "text-[#FCA5A5]"
                        : log.type === "success"
                        ? "text-[#86EFAC]"
                        : "text-white/90"
                    }`}
                  >
                    {log.text}
                  </span>
                </div>
              ))
            )}
            <div ref={consoleBottomRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
