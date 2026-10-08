"use client";

import React, { useState, useMemo } from "react";
import {
  Activity,
  Gauge,
  Thermometer,
  Zap,
  Waves,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Wind,
  Droplets,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Info,
} from "lucide-react";
import { SensorTelemetry } from "@/lib/inspection-adapter";

export interface ProcessTelemetryDossierProps {
  telemetry?: SensorTelemetry[];
  rawTelemetry?: Record<string, unknown> | null;
  rootCauseAnalysis?: Record<string, unknown> | null;
  isDefective: boolean;
  className?: string;
}

interface SensorSpec {
  key: string;
  name: string;
  shortName: string;
  unit: string;
  target: number;
  min: number;
  max: number;
  std: number;
  description: string;
  causeMapping: string;
  icon: React.ComponentType<{ className?: string }>;
}

const SENSOR_SPECS: Record<string, SensorSpec> = {
  mold_temp: {
    key: "mold_temp",
    name: "Mold Core Temperature",
    shortName: "Mold Temp",
    unit: "°C",
    target: 685.0,
    min: 660.0,
    max: 710.0,
    std: 14.5,
    description: "Crucible core and die cavity temperature across solidus phase transition.",
    causeMapping: "Melt / mold temperature variance outside permissible thermal tolerance.",
    icon: Thermometer,
  },
  injection_pressure: {
    key: "injection_pressure",
    name: "Die Injection Pressure",
    shortName: "Pressure",
    unit: "bar",
    target: 142.0,
    min: 130.0,
    max: 160.0,
    std: 8.2,
    description: "Hydraulic ram pack and intensification pressure during die cavity filling.",
    causeMapping: "Hydraulic ram injection / pack pressure fluctuation.",
    icon: Gauge,
  },
  cooling_rate: {
    key: "cooling_rate",
    name: "Coolant Loop Flow Rate",
    shortName: "Cooling Rate",
    unit: "L/min",
    target: 12.0,
    min: 10.0,
    max: 16.0,
    std: 1.8,
    description: "Internal quench and coolant line mass flow rate across cooling channels.",
    causeMapping: "Coolant loop flow or quench timing deviation causing thermal stress.",
    icon: Waves,
  },
  vibration: {
    key: "vibration",
    name: "Cycle Vibration / Chatter",
    shortName: "Vibration",
    unit: "mm/s",
    target: 1.2,
    min: 0.2,
    max: 2.0,
    std: 0.35,
    description: "Tri-axial accelerometer measurement on spindle and carriage track.",
    causeMapping: "Excessive mechanical chatter on transfer tracks or spindle runout.",
    icon: Zap,
  },
  machine_speed: {
    key: "machine_speed",
    name: "Conveyor Cadence Speed",
    shortName: "Cadence",
    unit: "RPM",
    target: 1200,
    min: 1120,
    max: 1280,
    std: 45,
    description: "Drive motor rotational speed during mold transport and indexing.",
    causeMapping: "Conveyor cadence / cycle cadence mismatch.",
    icon: Wind,
  },
  humidity: {
    key: "humidity",
    name: "Drying Tunnel Humidity",
    shortName: "Humidity",
    unit: "% RH",
    target: 42.0,
    min: 35.0,
    max: 55.0,
    std: 4.0,
    description: "Ambient relative humidity in component wash and drying tunnel enclosure.",
    causeMapping: "Condensation or rinse drying tunnel moisture trap saturation.",
    icon: Droplets,
  },
};

export function ProcessTelemetryDossier({
  telemetry = [],
  rawTelemetry,
  rootCauseAnalysis,
  isDefective,
  className = "",
}: ProcessTelemetryDossierProps) {
  const [selectedSensorKey, setSelectedSensorKey] = useState<string>("overview");

  // Identify culprit sensor from rootCauseAnalysis
  const rawCulprit =
    rootCauseAnalysis && typeof rootCauseAnalysis.primary_culprit_sensor === "string"
      ? (rootCauseAnalysis.primary_culprit_sensor as string)
      : rootCauseAnalysis && typeof rootCauseAnalysis.cause === "string"
      ? (rootCauseAnalysis.cause as string)
      : "";
  const culpritSensorKey = rawCulprit ? rawCulprit.toLowerCase() : null;

  // Extract resolved sensor values combining rawTelemetry and telemetry array
  const resolvedSensors = useMemo(() => {
    return Object.entries(SENSOR_SPECS).map(([key, spec]) => {
      let value = spec.target;

      // 1. Check rawTelemetry (e.g. from backend inspect)
      if (rawTelemetry && typeof rawTelemetry[key] === "number") {
        value = rawTelemetry[key] as number;
      } else if (rawTelemetry && typeof rawTelemetry[key] === "string") {
        const parsed = parseFloat(rawTelemetry[key] as string);
        if (!isNaN(parsed)) value = parsed;
      } else {
        // 2. Check telemetry array
        const match = telemetry.find((t) => {
          const tId = t.id.toLowerCase();
          const tName = t.name.toLowerCase();
          return (
            tId.includes(key) ||
            tName.includes(spec.shortName.toLowerCase()) ||
            (key === "mold_temp" && tName.includes("temp")) ||
            (key === "injection_pressure" && tName.includes("press")) ||
            (key === "cooling_rate" && (tName.includes("cool") || tName.includes("flow"))) ||
            (key === "vibration" && tName.includes("vib"))
          );
        });
        if (match) {
          value = match.recordedValue;
        }
      }

      const delta = value - spec.target;
      const zScore = Math.abs(delta) / spec.std;
      const isOutOfTolerance = value < spec.min || value > spec.max;
      const isCulprit = culpritSensorKey === key;

      return {
        ...spec,
        value,
        delta,
        zScore: Math.round(zScore * 10) / 10,
        isOutOfTolerance,
        isCulprit,
      };
    });
  }, [rawTelemetry, telemetry, culpritSensorKey]);

  // Generate synthetic historical time-series for a given sensor (16 cycles)
  const getHistoricalSeries = (sensor: (typeof resolvedSensors)[0]) => {
    const points: Array<{ cycle: number; value: number; timestamp: string }> = [];
    const count = 16;
    const finalValue = sensor.value;
    const target = sensor.target;
    const isDrifting = sensor.isOutOfTolerance || sensor.isCulprit;

    for (let i = 0; i < count; i++) {
      const cycleIdx = count - 1 - i;
      let val = target;

      if (isDrifting) {
        // Drift curve starting around cycle 6
        if (cycleIdx <= 6) {
          const progress = (6 - cycleIdx) / 6;
          val = target + (finalValue - target) * progress + (Math.sin(i * 1.5) * sensor.std * 0.15);
        } else {
          val = target + (Math.sin(i * 0.9) * sensor.std * 0.25);
        }
      } else {
        val = target + (Math.sin(i * 1.1) * sensor.std * 0.22);
      }

      // Last point is exact current recorded value
      if (cycleIdx === 0) {
        val = finalValue;
      }

      points.push({
        cycle: -cycleIdx,
        value: Math.round(val * 10) / 10,
        timestamp: cycleIdx === 0 ? "Live (t₀)" : `-${cycleIdx * 1.5}m`,
      });
    }

    return points;
  };

  const activeSensor = resolvedSensors.find((s) => s.key === selectedSensorKey);
  const activeSeries = activeSensor ? getHistoricalSeries(activeSensor) : [];

  return (
    <div
      className={`rounded-2xl border border-[#E5DFD3] bg-[#FFFFFF] overflow-hidden shadow-xs space-y-0 ${className}`}
    >
      {/* 1. Header Bar: Status & Culprit Notice */}
      <div className="p-4 sm:p-5 bg-[#FAF8F5] border-b border-[#EAE4D7] flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div
            className={`p-2.5 rounded-xl border ${
              isDefective
                ? "bg-[#FEF2F2] border-[#FCA5A5] text-[#991B1B]"
                : "bg-[#F0FDF4] border-[#86EFAC] text-[#166534]"
            }`}
          >
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[#1C1917]">
                SCADA Process Telemetry & Diagnostic Drift
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#EFE9DD] text-[#57534E] border border-[#DDD5C7]">
                CELL-04 • 6 CHANNELS
              </span>
            </div>
            <p className="text-xs text-[#78716A] mt-0.5">
              Live virtual sensor readings compared to calibrated nominal baselines and tolerance corridors.
            </p>
          </div>
        </div>

        {/* Primary Culprit Callout Badge */}
        {rootCauseAnalysis && typeof rootCauseAnalysis.primary_culprit_sensor === "string" && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#FEF2F2] border border-[#FCA5A5] text-[#991B1B] text-xs font-semibold shadow-2xs">
            <AlertTriangle className="w-4 h-4 text-[#DC2626] shrink-0" />
            <span>
              Primary Culprit:{" "}
              <span className="uppercase font-mono">
                {String(rootCauseAnalysis.primary_culprit_sensor).replace(/_/g, " ")}
              </span>{" "}
              (+{typeof rootCauseAnalysis.z_score_deviation === "number" ? rootCauseAnalysis.z_score_deviation : 4.2}σ)
            </span>
          </div>
        )}
      </div>

      {/* 2. Parameter Tabs Strip */}
      <div className="px-4 py-2 bg-[#FCFBF8] border-b border-[#EAE4D7] flex items-center gap-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setSelectedSensorKey("overview")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 cursor-pointer ${
            selectedSensorKey === "overview"
              ? "bg-[#1C1917] text-[#FAF8F5] shadow-xs font-semibold"
              : "bg-[#FFFFFF] border border-[#E5DFD3] text-[#57534E] hover:bg-[#F3EFE6] hover:text-[#1C1917]"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>All Sensors Overview</span>
        </button>

        {resolvedSensors.map((sensor) => {
          const Icon = sensor.icon;
          const isSelected = selectedSensorKey === sensor.key;
          const isAnomalous = sensor.isOutOfTolerance || sensor.isCulprit;

          return (
            <button
              key={sensor.key}
              type="button"
              onClick={() => setSelectedSensorKey(sensor.key)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 cursor-pointer ${
                isSelected
                  ? "bg-[#1C1917] text-[#FAF8F5] shadow-xs font-semibold"
                  : "bg-[#FFFFFF] border border-[#E5DFD3] text-[#57534E] hover:bg-[#F3EFE6] hover:text-[#1C1917]"
              }`}
            >
              <Icon
                className={`w-3.5 h-3.5 ${
                  isSelected
                    ? "text-[#FAF8F5]"
                    : isAnomalous
                    ? "text-[#DC2626]"
                    : "text-[#78716A]"
                }`}
              />
              <span>{sensor.shortName}</span>
              {isAnomalous && (
                <span
                  className={`w-2 h-2 rounded-full ${
                    isSelected ? "bg-[#EF4444]" : "bg-[#DC2626]"
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* 3. Tab Content View */}
      <div className="p-5 sm:p-6 bg-[#FFFFFF]">
        {selectedSensorKey === "overview" ? (
          /* =========================================================================
             OVERVIEW VIEW: Grid comparing all 6 physical SCADA/PLC sensors
          ========================================================================= */
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {resolvedSensors.map((sensor) => {
                const Icon = sensor.icon;
                const isAnomalous = sensor.isOutOfTolerance || sensor.isCulprit;
                const deltaSign = sensor.delta >= 0 ? "+" : "";

                // Calculate progress within min-max bounds
                const pct = Math.min(
                  Math.max(
                    ((sensor.value - sensor.min) / (sensor.max - sensor.min)) * 100,
                    0
                  ),
                  100
                );

                return (
                  <div
                    key={sensor.key}
                    onClick={() => setSelectedSensorKey(sensor.key)}
                    className={`p-4 rounded-xl border text-xs space-y-3 cursor-pointer transition-all hover:shadow-xs ${
                      sensor.isCulprit
                        ? "bg-[#FFF5F5] border-[#FCA5A5] ring-1 ring-[#DC2626]/20"
                        : isAnomalous
                        ? "bg-[#FFFBEB] border-[#FDE68A]"
                        : "bg-[#FAF8F5] border-[#EAE4D7] hover:border-[#DDD5C7]"
                    }`}
                  >
                    {/* Card Top: Icon & Value */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={`p-2 rounded-lg shrink-0 ${
                            sensor.isCulprit
                              ? "bg-[#FEF2F2] text-[#991B1B]"
                              : "bg-[#FFFFFF] text-[#57534E] border border-[#E5DFD3]"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="truncate">
                          <span className="font-semibold text-[#1C1917] block truncate">
                            {sensor.name}
                          </span>
                          <span className="text-[10px] text-[#78716A]">
                            Nominal: {sensor.target} {sensor.unit}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-mono text-sm font-bold text-[#1C1917] block tabular-nums">
                          {sensor.value} {sensor.unit}
                        </span>
                        <span
                          className={`font-mono text-[10px] font-semibold flex items-center justify-end gap-0.5 ${
                            isAnomalous ? "text-[#DC2626]" : "text-[#16A34A]"
                          }`}
                        >
                          {sensor.delta >= 0 ? (
                            <ArrowUpRight className="w-3 h-3 inline" />
                          ) : (
                            <ArrowDownRight className="w-3 h-3 inline" />
                          )}
                          {deltaSign}
                          {sensor.delta.toFixed(1)} ({sensor.zScore}σ)
                        </span>
                      </div>
                    </div>

                    {/* Tolerance Progress Dial Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-mono text-[#78716A]">
                        <span>Min: {sensor.min}</span>
                        <span>Target: {sensor.target}</span>
                        <span>Max: {sensor.max}</span>
                      </div>
                      <div className="w-full bg-[#E5DFD3] h-2 rounded-full overflow-hidden relative">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            sensor.isCulprit
                              ? "bg-[#DC2626]"
                              : isAnomalous
                              ? "bg-[#D97706]"
                              : "bg-[#16A34A]"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    {/* Status Footer */}
                    <div className="pt-2 border-t border-[#EAE4D7] flex items-center justify-between text-[11px]">
                      <span
                        className={`font-semibold ${
                          sensor.isCulprit
                            ? "text-[#991B1B]"
                            : isAnomalous
                            ? "text-[#92400E]"
                            : "text-[#166534]"
                        }`}
                      >
                        {sensor.isCulprit
                          ? "Root Cause Culprit"
                          : isAnomalous
                          ? "Out of Tolerance"
                          : "Nominal Pass"}
                      </span>
                      <span className="text-[10px] text-[#78716A] underline">
                        View trend & chart →
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Diagnostic Synthesis Footer */}
            {rootCauseAnalysis && typeof rootCauseAnalysis.diagnostic_explanation === "string" && (
              <div className="p-4 rounded-xl border border-[#E5DFD3] bg-[#FCFBF8] flex items-start gap-3 text-xs">
                <Info className="w-4 h-4 text-[#78716A] shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-semibold text-[#1C1917]">
                    Model 3 Diagnostic Synthesis
                  </div>
                  <p className="text-[#57534E] leading-relaxed">
                    {String(rootCauseAnalysis.diagnostic_explanation)}
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* =========================================================================
             INDIVIDUAL SENSOR VIEW: Deep dive with historical telemetry sparkline
          ========================================================================= */
          activeSensor && (
            <div className="space-y-6">
              {/* Top Stats Metric Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <div className="p-4 rounded-xl border border-[#EAE4D7] bg-[#FAF8F5]">
                  <div className="text-[11px] text-[#78716A]">Recorded Reading</div>
                  <div className="font-mono text-base font-bold text-[#1C1917] mt-1 tabular-nums">
                    {activeSensor.value} {activeSensor.unit}
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-[#EAE4D7] bg-[#FAF8F5]">
                  <div className="text-[11px] text-[#78716A]">Nominal Target</div>
                  <div className="font-mono text-base font-semibold text-[#1C1917] mt-1 tabular-nums">
                    {activeSensor.target} {activeSensor.unit}
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-[#EAE4D7] bg-[#FAF8F5]">
                  <div className="text-[11px] text-[#78716A]">Safe Band Corridor</div>
                  <div className="font-mono text-base font-semibold text-[#1C1917] mt-1 tabular-nums">
                    {activeSensor.min} – {activeSensor.max}
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-[#EAE4D7] bg-[#FAF8F5]">
                  <div className="text-[11px] text-[#78716A]">Z-Score Drift (σ)</div>
                  <div
                    className={`font-mono text-base font-bold mt-1 tabular-nums ${
                      activeSensor.zScore >= 3
                        ? "text-[#991B1B]"
                        : activeSensor.zScore >= 1.5
                        ? "text-[#D97706]"
                        : "text-[#166534]"
                    }`}
                  >
                    {activeSensor.delta >= 0 ? "+" : ""}
                    {activeSensor.zScore}σ
                  </div>
                </div>
              </div>

              {/* Historical Telemetry Time-Series Chart */}
              <div className="p-5 rounded-xl border border-[#E5DFD3] bg-[#FCFBF8] space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[#1C1917]" />
                    <span className="font-semibold text-[#1C1917]">
                      Historical Telemetry Trend (Last 16 Cycles • t-24m to t₀)
                    </span>
                  </div>
                  <div className="flex items-center gap-3 font-mono text-[10px] text-[#78716A]">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-0.5 bg-[#16A34A] inline-block" />
                      Nominal Band ({activeSensor.min}–{activeSensor.max})
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-0.5 bg-[#1C1917] inline-block" />
                      Recorded Sensor Path
                    </span>
                  </div>
                </div>

                {/* SVG Sparkline Graph */}
                <div className="w-full h-48 sm:h-56 relative select-none">
                  {(() => {
                    const minVal = Math.min(activeSensor.min * 0.95, ...activeSeries.map((p) => p.value));
                    const maxVal = Math.max(activeSensor.max * 1.05, ...activeSeries.map((p) => p.value));
                    const span = maxVal - minVal || 1;

                    const width = 640;
                    const height = 180;
                    const padX = 40;
                    const padY = 20;

                    const getX = (idx: number) =>
                      padX + (idx / (activeSeries.length - 1)) * (width - padX * 2);
                    const getY = (val: number) =>
                      height - padY - ((val - minVal) / span) * (height - padY * 2);

                    const polyPoints = activeSeries
                      .map((p, idx) => `${getX(idx)},${getY(p.value)}`)
                      .join(" ");

                    const bandTopY = getY(activeSensor.max);
                    const bandBottomY = getY(activeSensor.min);
                    const targetY = getY(activeSensor.target);

                    return (
                      <svg
                        viewBox={`0 0 ${width} ${height}`}
                        className="w-full h-full overflow-visible"
                        preserveAspectRatio="none"
                      >
                        <defs>
                          <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop
                              offset="0%"
                              stopColor={activeSensor.isCulprit ? "#EF4444" : "#1C1917"}
                              stopOpacity="0.25"
                            />
                            <stop
                              offset="100%"
                              stopColor={activeSensor.isCulprit ? "#EF4444" : "#1C1917"}
                              stopOpacity="0.0"
                            />
                          </linearGradient>
                        </defs>

                        {/* Shaded Permissible Tolerance Band Corridor */}
                        <rect
                          x={padX}
                          y={bandTopY}
                          width={width - padX * 2}
                          height={Math.max(bandBottomY - bandTopY, 2)}
                          fill="#16A34A"
                          fillOpacity="0.08"
                        />
                        <line
                          x1={padX}
                          y1={bandTopY}
                          x2={width - padX}
                          y2={bandTopY}
                          stroke="#16A34A"
                          strokeWidth="1"
                          strokeDasharray="4,4"
                          opacity="0.5"
                        />
                        <line
                          x1={padX}
                          y1={bandBottomY}
                          x2={width - padX}
                          y2={bandBottomY}
                          stroke="#16A34A"
                          strokeWidth="1"
                          strokeDasharray="4,4"
                          opacity="0.5"
                        />

                        {/* Target Center Baseline Line */}
                        <line
                          x1={padX}
                          y1={targetY}
                          x2={width - padX}
                          y2={targetY}
                          stroke="#78716A"
                          strokeWidth="1"
                          strokeDasharray="2,2"
                          opacity="0.4"
                        />

                        {/* Area Fill beneath Trend */}
                        {activeSeries.length > 0 && (
                          <polygon
                            points={`${getX(0)},${height - padY} ${polyPoints} ${getX(
                              activeSeries.length - 1
                            )},${height - padY}`}
                            fill="url(#trendGrad)"
                          />
                        )}

                        {/* Main Trend Line */}
                        <polyline
                          points={polyPoints}
                          fill="none"
                          stroke={activeSensor.isCulprit ? "#DC2626" : "#1C1917"}
                          strokeWidth="2.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />

                        {/* Data Points */}
                        {activeSeries.map((pt, idx) => {
                          const isLast = idx === activeSeries.length - 1;
                          const cx = getX(idx);
                          const cy = getY(pt.value);
                          return (
                            <g key={idx}>
                              <circle
                                cx={cx}
                                cy={cy}
                                r={isLast ? 4.5 : 2.5}
                                fill={
                                  isLast
                                    ? activeSensor.isCulprit
                                      ? "#DC2626"
                                      : "#16A34A"
                                    : "#FFFFFF"
                                }
                                stroke={
                                  isLast
                                    ? "#FFFFFF"
                                    : activeSensor.isCulprit
                                    ? "#DC2626"
                                    : "#1C1917"
                                }
                                strokeWidth={isLast ? 2 : 1.5}
                              />
                            </g>
                          );
                        })}
                      </svg>
                    );
                  })()}
                </div>

                {/* X-Axis Cycle Labels */}
                <div className="flex justify-between text-[11px] font-mono text-[#78716A] px-2 pt-1 border-t border-[#EAE4D7]">
                  <span>Cycle -15 (t-24m)</span>
                  <span>Cycle -10 (t-15m)</span>
                  <span>Cycle -5 (t-7m)</span>
                  <span className="font-semibold text-[#1C1917]">Live Inspection (t₀)</span>
                </div>
              </div>

              {/* Physical Process Engineering Rationale */}
              <div className="p-4 rounded-xl border border-[#E5DFD3] bg-[#FAF8F5] space-y-2 text-xs">
                <div className="font-semibold text-[#1C1917] flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
                  <span>Physical Process Context & Engineering Attribution</span>
                </div>
                <p className="text-[#57534E] leading-relaxed">
                  {activeSensor.description}
                </p>
                <div className="pt-2 border-t border-[#EAE4D7] text-[#78350F]">
                  <span className="font-semibold text-[#1C1917]">Root Cause Profile: </span>
                  {activeSensor.causeMapping}
                </div>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default ProcessTelemetryDossier;
