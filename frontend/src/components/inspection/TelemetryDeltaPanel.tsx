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
    if (n.includes("temp")) return <Thermometer aria-hidden="true" className="w-3.5 h-3.5 text-[#C2410C]" />;
    if (n.includes("press")) return <Gauge aria-hidden="true" className="w-3.5 h-3.5 text-[#D97706]" />;
    if (n.includes("cool") || n.includes("flow")) return <Waves aria-hidden="true" className="w-3.5 h-3.5 text-[#0D9488]" />;
    return <Zap aria-hidden="true" className="w-3.5 h-3.5 text-[#7C3AED]" />;
  };

  return (
    <Card className="flex flex-col h-full bg-[#FFFFFF] border-[#E5DFD3]">
      <CardHeader className="py-3 px-4 bg-[#F7F4EC] border-b border-[#E6E0D3]">
        <div className="flex items-center justify-between w-full">
          <CardTitle className="text-xs text-[#1C1917] flex items-center gap-2">
            <Activity aria-hidden="true" className="w-4 h-4 text-[#9A3412]" />
            <span>Process Telemetry & Tolerances</span>
          </CardTitle>
          <span className="text-[10px] font-mono text-[#78716A]">
            NOMINAL BAND COMPARISON
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-3.5 flex-1">
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
              className="p-3 rounded-xl border border-[#E8E2D6] bg-[#FAF8F5] font-mono text-xs space-y-2 shadow-xs"
            >
              {/* Sensor Header */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1.5 rounded-lg bg-[#EFEAE0] text-[#78350F] shrink-0">
                    {getSensorIcon(sensor.name)}
                  </div>
                  <div className="truncate">
                    <span className="font-semibold text-[#1C1917] block truncate">
                      {sensor.name}
                    </span>
                    <span className="text-[10px] text-[#78716A] tabular-nums">
                      BAND: {sensor.nominalMin} – {sensor.nominalMax} {sensor.unit}
                    </span>
                  </div>
                </div>

                {/* Right: Live Value & Delta Tag */}
                <div className="text-right shrink-0 flex items-center gap-2">
                  <div>
                    <span className="text-xs font-bold text-[#1C1917] tabular-nums">
                      {sensor.recordedValue}
                      <span className="text-[10px] text-[#78716A] ml-0.5">{sensor.unit}</span>
                    </span>
                  </div>

                  <Badge
                    variant={isCritical ? "defective" : isWarning ? "warning" : "nominal"}
                    size="sm"
                    className="tabular-nums"
                  >
                    {deltaSign}
                    {sensor.delta.toFixed(1)} {sensor.unit}
                  </Badge>
                </div>
              </div>

              {/* Tolerance Visual Delta Bar */}
              <div className="space-y-1">
                <div aria-hidden="true" className="relative h-2 w-full rounded-full bg-[#E5DFD3] overflow-hidden">
                  {/* Calibrated Nominal Green Band Zone */}
                  <div
                    className="absolute top-0 bottom-0 bg-[#86EFAC] border-x border-[#4ADE80]"
                    style={{
                      left: `${nominalMinPct}%`,
                      width: `${nominalMaxPct - nominalMinPct}%`,
                    }}
                  />

                  {/* Recorded Value Needle Indicator */}
                  <div
                    className={`absolute top-0 bottom-0 w-2 -ml-1 rounded-full shadow-xs ${
                      isCritical
                        ? "bg-[#DC2626]"
                        : isWarning
                        ? "bg-[#D97706]"
                        : "bg-[#16A34A]"
                    }`}
                    style={{ left: `${recordedPct}%` }}
                  />
                </div>

                <div className="flex justify-between text-[9px] text-[#78716A] tabular-nums">
                  <span>LO TGT: {sensor.nominalMin}</span>
                  <span className="text-[#1C1917] font-bold">NOM: {sensor.nominalTarget}</span>
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
