"use client";

import React from "react";
import {
  Activity,
  Gauge,
  Thermometer,
  Zap,
  Waves,
} from "lucide-react";
import { SensorTelemetry } from "@/lib/inspection-adapter";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface TelemetryDeltaPanelProps {
  telemetry: SensorTelemetry[];
}

export function TelemetryDeltaPanel({ telemetry }: TelemetryDeltaPanelProps) {
  const getSensorIcon = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes("temp")) return <Thermometer className="w-3.5 h-3.5 text-rose-400" />;
    if (n.includes("press")) return <Gauge className="w-3.5 h-3.5 text-amber-400" />;
    if (n.includes("cool") || n.includes("flow")) return <Waves className="w-3.5 h-3.5 text-cyan-400" />;
    return <Zap className="w-3.5 h-3.5 text-indigo-400" />;
  };

  return (
    <Card className="flex flex-col h-full bg-[#12141C] border-[#1F2430]">
      <CardHeader className="py-2.5 px-4 bg-[#161922]">
        <div className="flex items-center justify-between w-full">
          <CardTitle className="text-xs text-slate-200 flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <span>Process Telemetry & Tolerances</span>
          </CardTitle>
          <span className="text-[10px] font-mono text-slate-500">
            NOMINAL BAND COMPARISON
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-3.5 space-y-3.5 flex-1">
        {telemetry.map((sensor) => {
          const deltaSign = sensor.delta >= 0 ? "+" : "";
          const isCritical = sensor.status === "critical";
          const isWarning = sensor.status === "warning";

          // Calculate normalized percentage across min/max range with padding
          const range = sensor.nominalMax - sensor.nominalMin;
          const padding = range * 0.4;
          const totalSpan = range + padding * 2;
          const minSpan = sensor.nominalMin - padding;

          const recordedPct = Math.min(
            Math.max(((sensor.recordedValue - minSpan) / totalSpan) * 100, 2),
            98
          );
          const nominalMinPct = ((sensor.nominalMin - minSpan) / totalSpan) * 100;
          const nominalMaxPct = ((sensor.nominalMax - minSpan) / totalSpan) * 100;

          return (
            <div
              key={sensor.id}
              className="p-2.5 rounded-lg border border-[#1E2330] bg-[#0E1017] font-mono text-xs space-y-2"
            >
              {/* Sensor Header */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1 rounded bg-[#161A26] border border-[#242A3B] shrink-0">
                    {getSensorIcon(sensor.name)}
                  </div>
                  <div className="truncate">
                    <span className="font-semibold text-slate-200 block truncate">
                      {sensor.name}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      BAND: {sensor.nominalMin} – {sensor.nominalMax} {sensor.unit}
                    </span>
                  </div>
                </div>

                {/* Right: Live Value & Delta Tag */}
                <div className="text-right shrink-0 flex items-center gap-2">
                  <div>
                    <span className="text-xs font-bold text-slate-100">
                      {sensor.recordedValue}
                      <span className="text-[10px] text-slate-400 ml-0.5">{sensor.unit}</span>
                    </span>
                  </div>

                  <Badge
                    variant={isCritical ? "defective" : isWarning ? "warning" : "nominal"}
                    size="sm"
                  >
                    {deltaSign}
                    {sensor.delta.toFixed(1)} {sensor.unit}
                  </Badge>
                </div>
              </div>

              {/* Tolerance Visual Delta Bar */}
              <div className="space-y-1">
                <div className="relative h-2 w-full rounded-full bg-[#181C28] overflow-hidden">
                  {/* Calibrated Nominal Green Band Zone */}
                  <div
                    className="absolute top-0 bottom-0 bg-emerald-500/25 border-x border-emerald-500/50"
                    style={{
                      left: `${nominalMinPct}%`,
                      width: `${nominalMaxPct - nominalMinPct}%`,
                    }}
                  />

                  {/* Recorded Value Needle Indicator */}
                  <div
                    className={`absolute top-0 bottom-0 w-2 -ml-1 rounded-full shadow-md ${
                      isCritical
                        ? "bg-rose-500 shadow-rose-500/60"
                        : isWarning
                        ? "bg-amber-400 shadow-amber-400/60"
                        : "bg-cyan-400 shadow-cyan-400/60"
                    }`}
                    style={{ left: `${recordedPct}%` }}
                  />
                </div>

                <div className="flex justify-between text-[9px] text-slate-500">
                  <span>LO TGT: {sensor.nominalMin}</span>
                  <span className="text-slate-400 font-bold">NOM: {sensor.nominalTarget}</span>
                  <span>HI TGT: {sensor.nominalMax}</span>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
