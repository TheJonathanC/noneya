"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  Play,
  RotateCcw,
  Sparkles,
  Wrench,
  XCircle,
} from "lucide-react";

interface ScadaTelemetry {
  mold_temp: number;
  injection_pressure: number;
  cooling_rate: number;
  vibration: number;
  machine_speed: number;
  humidity: number;
}

interface Model3Diagnosis {
  predicted_cause_defect: string;
  confidence_score: number;
  primary_culprit_sensor: string;
  z_score_deviation: number;
  diagnostic_explanation: string;
  remedial_action: string;
  model3_correct: boolean;
}

interface IndividualPartOutput {
  part_number: number;
  filename: string;
  input_defect_type: string;
  status: "OK" | "DEFECTIVE";
  scada_telemetry: ScadaTelemetry;
  model3_diagnosis: Model3Diagnosis;
  gemini_part_output: string;
  gemini_used: boolean;
  gemini_model?: string;
}

interface EngineeringFix {
  sensor: string;
  label: string;
  unit: string;
  current: number;
  target: number;
  change: number;
  z: number;
  instruction: string;
}

interface EndBatchOutput {
  batch_id: string;
  verdict: "OK" | "WARNING" | "CRITICAL STOP";
  gate_decision: "GO" | "ADJUST" | "CRITICAL STOP";
  gate_action: string;
  stats: {
    total: number;
    ok: number;
    defective: number;
    defect_rate: number;
    defect_mix: Record<string, number>;
    max_drift_sigma: number;
  };
  fixes: EngineeringFix[];
  prediction: {
    text: string;
    next_batch_risk: number;
    closest_signature?: string;
  };
  batch_engine_review: string;
  gemini_batch_review: string;
  gemini_used: boolean;
  gemini_model?: string;
  reasons: string[];
}

interface BatchResponse {
  batch_id: string;
  pipeline: string;
  gemini_configured: boolean;
  parts_count: number;
  individual_part_outputs: IndividualPartOutput[];
  end_batch_output: EndBatchOutput;
}

const PRESETS = [
  {
    label: "Mixed: Porosity + Crack",
    seq: "ok,porosity,ok,crack,ok",
    badge: "Realistic Batch",
    desc: "1 Porosity + 1 Crack, triggers CRITICAL STOP due to structural crack.",
  },
  {
    label: "Clean Batch (All Pass)",
    seq: "ok,ok,ok,ok,ok",
    badge: "Nominal",
    desc: "5 parts passing all visual and SCADA tolerances. Authorizes GO.",
  },
  {
    label: "Thermal Runaway",
    seq: "porosity,porosity,ok,porosity,ok",
    badge: "High Drift",
    desc: "Severe mold temperature elevation above 740°C causing recurrent porosity.",
  },
  {
    label: "Mechanical Chatter",
    seq: "scratch,scratch,ok,scratch,ok",
    badge: "Vibration Drift",
    desc: "Spindle or track runout causing surface scratches and vibration spike.",
  },
  {
    label: "Moisture Trap Saturation",
    seq: "corrosion,ok,corrosion,ok,corrosion",
    badge: "Humidity Saturation",
    desc: "Rinse tunnel dryer failure with >80% RH driving corrosion.",
  },
];

const NOMINALS: Record<string, { label: string; unit: string; base: number }> = {
  mold_temp: { label: "Mold Temp", unit: "°C", base: 685 },
  injection_pressure: { label: "Inj. Pressure", unit: "bar", base: 142 },
  cooling_rate: { label: "Cooling Rate", unit: "°C/s", base: 12 },
  vibration: { label: "Vibration", unit: "mm/s", base: 1.2 },
  machine_speed: { label: "Cadence", unit: "u/h", base: 1200 },
  humidity: { label: "Humidity", unit: "%RH", base: 42 },
};

export default function Model3GeminiBatchPage() {
  const [partsInput, setPartsInput] = useState("ok,porosity,ok,crack,ok");
  const [isLoading, setIsLoading] = useState(false);
  const [activeStep, setActiveStep] = useState<string | null>(null);
  const [batchData, setBatchData] = useState<BatchResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);

  const handleRunBatch = async (seqToUse?: string) => {
    const sequence = seqToUse || partsInput;
    setIsLoading(true);
    setErrorMsg(null);
    setActiveStep("Submitting batch through Model 3 & Gemini pipeline...");

    try {
      // First try streaming or proxy route
      const response = await fetch(
        `/api/model3-gemini/batch?parts=${encodeURIComponent(sequence)}&batch_id=PILOT-${Date.now().toString().slice(-6)}`,
        { method: "GET" }
      );

      if (!response.ok) {
        // Fallback to direct localhost:8000
        const directResp = await fetch(
          `http://127.0.0.1:8000/api/model3-gemini/batch?parts=${encodeURIComponent(sequence)}&batch_id=PILOT-${Date.now().toString().slice(-6)}`
        );
        if (!directResp.ok) {
          throw new Error(`Pipeline returned HTTP ${response.status}`);
        }
        const directData = await directResp.json();
        setBatchData(directData);
      } else {
        const data = await response.json();
        setBatchData(data);
      }
      setActiveStep(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to execute batch pipeline";
      setErrorMsg(msg);
      setActiveStep(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1C1917] flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="border-b border-[#EAE4D7] bg-[#FAF8F5]/90 sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="w-7 h-7 rounded-lg bg-[#1C1917] flex items-center justify-center p-1 shadow-xs shrink-0"
              title="Qastra Home"
            >
              <Cpu className="w-4 h-4 text-[#FAF8F5]" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold tracking-tight text-[#1C1917]">Qastra</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#EAE4D7] text-[#57534E]">
                  Model 3 + Gemini Route
                </span>
              </div>
              <p className="text-[11px] text-[#78716A]">
                Part-by-Part Root Cause Diagnosis &rarr; End-Batch Gatekeeper
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FFFFFF] hover:bg-[#F3EFE6] border border-[#DDD5C7] text-[#57534E] font-medium transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Full Dashboard</span>
            </Link>
            <a
              href="http://127.0.0.1:8000/model3-batch-demo"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1C1917] hover:bg-[#2E2A27] text-white font-medium transition shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>FastAPI Visual Viewer</span>
            </a>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-8 flex-1 w-full">
        {/* Intro Banner */}
        <div className="bg-[#FFFFFF] border border-[#EAE4D7] rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#F0EBE1] pb-4">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#F3EFE6] text-[#78716A] text-xs font-medium mb-2">
                <Activity className="w-3.5 h-3.5 text-[#1C1917]" />
                Automated Pilot-Batch SCADA Inspection
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1C1917]">
                Model 3 (XGBoost) + Gemini Batch Diagnostic Route
              </h1>
              <p className="text-xs sm:text-sm text-[#78716A] mt-1 max-w-2xl">
                Demonstrates <strong>Model 3</strong> analyzing SCADA telemetry and isolating the root-cause
                sensor drift for each individual impeller in a batch, paired with <strong>Gemini</strong> supervisory
                grooming, concluding with the <strong>Batch Engine</strong> gate verdict and engineering setpoint changes.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleRunBatch()}
                disabled={isLoading}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#1C1917] hover:bg-[#2E2A27] disabled:opacity-50 text-white text-xs sm:text-sm font-semibold shadow-xs transition active:scale-95 cursor-pointer"
              >
                {isLoading ? (
                  <RotateCcw className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <Play className="w-4 h-4 text-emerald-400 fill-emerald-400" />
                )}
                <span>{isLoading ? "Analyzing Batch..." : "Run Batch Diagnostic"}</span>
              </button>
            </div>
          </div>

          {/* Presets Grid */}
          <div className="space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#78716A]">
              Choose Batch Preset
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
              {PRESETS.map((p) => {
                const isActive = partsInput === p.seq;
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => {
                      setPartsInput(p.seq);
                      handleRunBatch(p.seq);
                    }}
                    className={`text-left p-3 rounded-xl border text-xs transition duration-150 ${
                      isActive
                        ? "bg-[#F3EFE6] border-[#1C1917] text-[#1C1917] shadow-xs"
                        : "bg-[#FAFAF8] hover:bg-[#F3EFE6] border-[#EAE4D7] text-[#57534E]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="font-semibold text-[12px] truncate">{p.label}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#EAE4D7] text-[#78716A] shrink-0 font-medium">
                        {p.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#78716A] line-clamp-2 leading-tight">{p.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sequence Editor */}
          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex-1 space-y-1">
              <label className="text-[11px] font-semibold text-[#78716A] uppercase tracking-wider">
                Defect Sequence (comma-separated):
              </label>
              <input
                type="text"
                value={partsInput}
                onChange={(e) => setPartsInput(e.target.value)}
                placeholder="ok,porosity,ok,crack,ok"
                className="w-full px-3.5 py-2 rounded-xl bg-[#FAFAF8] border border-[#DDD5C7] text-xs font-mono text-[#1C1917] focus:outline-none focus:border-[#1C1917]"
              />
            </div>
            <div className="text-[11px] text-[#78716A] self-end pb-2">
              Valid defects: <code className="font-mono text-[#1C1917]">ok, porosity, crack, deformation, scratch, corrosion</code>
            </div>
          </div>
        </div>

        {/* Loading Spinner Notice */}
        {isLoading && (
          <div className="bg-[#FFFFFF] border border-[#EAE4D7] rounded-xl p-4 flex items-center justify-between gap-3 shadow-xs animate-pulse">
            <div className="flex items-center gap-3">
              <RotateCcw className="w-4 h-4 animate-spin text-[#1C1917]" />
              <span className="text-xs font-medium text-[#57534E]">
                {activeStep || "Invoking Model 3 (XGBoost) and Gemini 3.5 Flash-Lite..."}
              </span>
            </div>
            <span className="text-[11px] font-mono text-[#78716A]">Live Pipeline Active</span>
          </div>
        )}

        {/* Error message */}
        {errorMsg && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center gap-3 text-rose-800 text-xs">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Results Sections */}
        {batchData && (
          <div className="space-y-8">
            {/* Section 1: Individual Part Outputs */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#EAE4D7] pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-[#1C1917] text-white flex items-center justify-center text-xs font-bold">
                      1
                    </span>
                    <h2 className="text-base font-bold text-[#1C1917]">
                      Individual Part Outputs ({batchData.individual_part_outputs.length} Parts)
                    </h2>
                  </div>
                  <p className="text-xs text-[#78716A] mt-0.5">
                    For each part: SCADA sensors &rarr; Model 3 XGBoost attribution &rarr; Gemini supervisory briefing
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium">
                    Gemini Live Grooming: Active
                  </span>
                </div>
              </div>

              {/* Individual Part Cards */}
              <div className="grid grid-cols-1 gap-4">
                {batchData.individual_part_outputs.map((part) => {
                  const isOk = part.status === "OK";
                  const culprit = part.model3_diagnosis.primary_culprit_sensor;
                  const sigma = part.model3_diagnosis.z_score_deviation;

                  return (
                    <div
                      key={part.part_number}
                      className="bg-[#FFFFFF] border border-[#EAE4D7] rounded-2xl p-5 shadow-xs space-y-4 hover:border-[#C4BAA9] transition"
                    >
                      {/* Part Header */}
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F0EBE1] pb-3">
                        <div className="flex items-center gap-3">
                          <span className="w-7 h-7 rounded-lg bg-[#F3EFE6] text-[#1C1917] font-bold text-xs flex items-center justify-center border border-[#E5DEC9]">
                            #{part.part_number}
                          </span>
                          <div>
                            <span className="text-sm font-semibold text-[#1C1917] font-mono">
                              {part.filename}
                            </span>
                            <span className="text-xs text-[#78716A] block">
                              Classified Defect Type: <strong>{part.input_defect_type.toUpperCase()}</strong>
                            </span>
                          </div>
                        </div>

                        <div>
                          {isOk ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold uppercase tracking-wider">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              PASS · OK
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold uppercase tracking-wider">
                              <XCircle className="w-3.5 h-3.5 text-rose-600" />
                              DEFECTIVE · {part.input_defect_type}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* SCADA Telemetry Grid */}
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-[#78716A] mb-2 flex items-center justify-between">
                          <span>SCADA Process Telemetry Readings</span>
                          <span className="text-[10px] text-[#A8A29E] font-normal">
                            Values vs Nominal Baseline
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
                          {Object.entries(part.scada_telemetry).map(([feat, val]) => {
                            const isCulprit = feat === culprit;
                            const meta = NOMINALS[feat] || { label: feat, unit: "", base: 0 };
                            return (
                              <div
                                key={feat}
                                className={`p-2.5 rounded-xl border transition ${
                                  isCulprit
                                    ? "bg-amber-50/80 border-amber-300 text-amber-900 shadow-2xs"
                                    : "bg-[#FAFAF8] border-[#EAE4D7] text-[#57534E]"
                                }`}
                              >
                                <div className="text-[10px] uppercase font-semibold text-[#78716A] truncate">
                                  {meta.label}
                                </div>
                                <div className="text-sm font-bold font-mono text-[#1C1917] mt-0.5">
                                  {val} {meta.unit}
                                </div>
                                <div className="text-[10px] text-[#A8A29E] mt-0.5 flex items-center justify-between">
                                  <span>Nom: {meta.base}</span>
                                  {isCulprit && (
                                    <span className="font-bold text-amber-700">
                                      {sigma > 0 ? "+" : ""}
                                      {sigma}&sigma;
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Dual Output: Model 3 & Gemini */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                        {/* Model 3 Diagnosis */}
                        <div className="p-4 rounded-xl bg-[#F7F5F0] border border-[#EAE4D7] space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-[#1C1917] flex items-center gap-1.5">
                              <Activity className="w-3.5 h-3.5 text-indigo-600" />
                              Model 3 · XGBoost Root Cause
                            </span>
                            <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-[#EAE4D7] text-[#57534E]">
                              Confidence: {(part.model3_diagnosis.confidence_score * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div className="text-xs text-[#1C1917]">
                            Culprit Sensor:{" "}
                            <strong className="text-amber-700 font-bold underline decoration-amber-400">
                              {culprit}
                            </strong>{" "}
                            ({sigma > 0 ? "+" : ""}
                            {sigma}&sigma; drift)
                          </div>
                          <p className="text-[11px] text-[#78716A] leading-relaxed">
                            {part.model3_diagnosis.diagnostic_explanation}
                          </p>
                        </div>

                        {/* Gemini Supervisor Briefing */}
                        <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-50/70 via-[#FAF8F5] to-purple-50/40 border border-indigo-200/80 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                              Gemini LLM Supervisor Briefing
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-100/70 text-indigo-800 font-medium">
                              {part.gemini_model || "gemini-3.5-flash-lite"}
                            </span>
                          </div>
                          <p className="text-xs text-[#1C1917] leading-relaxed italic">
                            &ldquo;{part.gemini_part_output}&rdquo;
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section 2: End of Batch Gatekeeper Synthesis */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#EAE4D7] pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-[#1C1917] text-white flex items-center justify-center text-xs font-bold">
                    2
                  </span>
                  <h2 className="text-base font-bold text-[#1C1917]">
                    End of Batch Synthesis (Batch Engine + Gemini Executive Review)
                  </h2>
                </div>
                <span className="text-xs font-mono font-medium text-[#78716A]">
                  Batch ID: {batchData.end_batch_output.batch_id}
                </span>
              </div>

              {/* End Batch Card */}
              <div className="bg-[#FFFFFF] border border-[#EAE4D7] rounded-2xl p-6 shadow-xs space-y-6">
                {/* Gate Decision Banner */}
                {(() => {
                  const v = batchData.end_batch_output.verdict;
                  const isStop = v === "CRITICAL STOP";
                  const isWarn = v === "WARNING";
                  const bannerBg = isStop
                    ? "bg-rose-50 border-rose-200 text-rose-900"
                    : isWarn
                    ? "bg-amber-50 border-amber-200 text-amber-900"
                    : "bg-emerald-50 border-emerald-200 text-emerald-900";

                  const badgeColor = isStop
                    ? "bg-rose-200 text-rose-900 border-rose-300"
                    : isWarn
                    ? "bg-amber-200 text-amber-900 border-amber-300"
                    : "bg-emerald-200 text-emerald-900 border-emerald-300";

                  return (
                    <div
                      className={`p-5 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${bannerBg}`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <span className="text-xl font-black tracking-tight">{v}</span>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider border ${badgeColor}`}
                          >
                            GATE: {batchData.end_batch_output.gate_decision}
                          </span>
                        </div>
                        <p className="text-xs opacity-90">
                          {batchData.end_batch_output.gate_action}
                        </p>
                      </div>

                      <div className="flex items-center gap-6 text-right shrink-0">
                        <div>
                          <div className="text-[10px] uppercase font-semibold text-[#78716A]">
                            Defect Rate
                          </div>
                          <div className="text-lg font-bold font-mono">
                            {(batchData.end_batch_output.stats.defect_rate * 100).toFixed(0)}%
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase font-semibold text-[#78716A]">
                            Defects Found
                          </div>
                          <div className="text-lg font-bold font-mono">
                            {batchData.end_batch_output.stats.defective} /{" "}
                            {batchData.end_batch_output.stats.total}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase font-semibold text-[#78716A]">
                            Next Batch Risk
                          </div>
                          <div className="text-lg font-bold font-mono">
                            {(batchData.end_batch_output.prediction.next_batch_risk * 100).toFixed(0)}%
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Gemini Executive Review Card */}
                <div className="p-5 rounded-xl bg-gradient-to-br from-indigo-50/70 via-[#FAF8F5] to-purple-50/40 border border-indigo-200 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                        <Sparkles className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-sm font-bold text-[#1C1917]">
                        Gemini LLM Batch Executive Review
                      </span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-medium">
                      {batchData.end_batch_output.gemini_model || "gemini-3.5-flash-lite"}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-[#1C1917] leading-relaxed">
                    {batchData.end_batch_output.gemini_batch_review ||
                      batchData.end_batch_output.batch_engine_review}
                  </p>
                  <div className="text-xs text-[#78716A] pt-1">
                    <strong>Engine Forecast:</strong> {batchData.end_batch_output.prediction.text}
                  </div>
                </div>

                {/* Prescribed Engineering Setpoint Fixes */}
                <div className="space-y-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-[#1C1917] flex items-center gap-2">
                    <Wrench className="w-3.5 h-3.5 text-amber-600" />
                    <span>
                      Prescribed Engineering Setpoint Fixes (
                      {batchData.end_batch_output.fixes.length})
                    </span>
                  </div>
                  {batchData.end_batch_output.fixes.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {batchData.end_batch_output.fixes.map((f, idx) => (
                        <div
                          key={idx}
                          className="p-3.5 rounded-xl bg-[#FAFAF8] border border-amber-200/80 text-xs space-y-1.5"
                        >
                          <div className="font-semibold text-[#1C1917] flex items-center justify-between">
                            <span>
                              {f.label} ({f.sensor})
                            </span>
                            <span className="text-[10px] font-mono text-amber-800 font-bold">
                              {f.z > 0 ? "+" : ""}
                              {f.z}&sigma; drift
                            </span>
                          </div>
                          <div className="text-amber-900 font-medium">{f.instruction}</div>
                          <div className="text-[11px] text-[#78716A] font-mono">
                            Adjust from {f.current} &rarr; {f.target} {f.unit} ({f.change > 0 ? "+" : ""}
                            {f.change} {f.unit})
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                      All machine telemetry readings sit comfortably within the 2-sigma process window. No
                      setpoint changes needed.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Collapsible Raw JSON Viewer */}
            <div className="bg-[#FFFFFF] border border-[#EAE4D7] rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowRawJson(!showRawJson)}
                className="w-full px-5 py-3.5 flex items-center justify-between text-xs font-semibold text-[#57534E] hover:bg-[#F3EFE6] transition"
              >
                <span>Raw Pipeline API Response (JSON)</span>
                {showRawJson ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showRawJson && (
                <div className="p-4 bg-[#141622] text-[#A6ADC4] font-mono text-xs overflow-x-auto max-h-96 border-t border-[#EAE4D7]">
                  <pre>{JSON.stringify(batchData, null, 2)}</pre>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#EAE4D7] py-6 px-4 text-center text-xs text-[#78716A]">
        Qastra Automotive Quality Inspection Pipeline · Track 3 · Powered by Model 3 (XGBoost) + Gemini Flash
      </footer>
    </div>
  );
}
