"use client";

import React, { useState } from "react";
import {
  AlertOctagon,
  CheckCircle2,
  FileCheck2,
  Printer,
  ShieldAlert,
  Wrench,
  ClipboardList,
} from "lucide-react";
import { InspectionItem } from "@/lib/inspection-adapter";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface RootCauseDossierProps {
  item: InspectionItem;
}

export function RootCauseDossier({ item }: RootCauseDossierProps) {
  const [acknowledged, setAcknowledged] = useState(false);
  const isDefective = item.status === "DEFECTIVE";

  const getSeverityBadgeVariant = (severity: string) => {
    switch (severity.toLowerCase()) {
      case "critical":
        return "defective";
      case "moderate":
      case "minor":
        return "warning";
      default:
        return "nominal";
    }
  };

  return (
    <Card className="flex flex-col h-full bg-[#12141C] border-[#1F2430]">
      {/* Header: Plant Audit Slip Header */}
      <CardHeader className="py-2.5 px-4 bg-[#161922] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-cyan-400" />
          <CardTitle className="text-xs text-slate-200">
            Plant Diagnostic Audit Ticket
          </CardTitle>
        </div>
        <div className="flex items-center gap-2 font-mono">
          <span className="text-[10px] text-slate-500 uppercase">SEVERITY:</span>
          <Badge variant={getSeverityBadgeVariant(item.severity)} size="sm">
            {item.severity}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4 flex-1 flex flex-col justify-between font-mono">
        {/* Ticket Details Body */}
        <div className="space-y-3.5">
          {/* Metadata Ledger */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 rounded-lg bg-[#0E1017] border border-[#1E2330] text-[11px]">
            <div>
              <span className="text-slate-500 block text-[9px] uppercase">Inspection Ticket</span>
              <span className="font-bold text-slate-200">{item.id}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[9px] uppercase">Operator Assigned</span>
              <span className="text-slate-300 truncate block">{item.metadata.operatorId}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[9px] uppercase">Cycle Latency</span>
              <span className="text-slate-300">{item.metadata.cycleDurationMs} ms</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[9px] uppercase">Timestamp</span>
              <span className="text-slate-300">{item.timestamp}</span>
            </div>
          </div>

          {/* Root Cause Summary */}
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              <span>Diagnostic Root Cause Synthesis</span>
            </div>
            <div
              className={`p-3 rounded-lg border text-xs leading-relaxed ${
                isDefective
                  ? "bg-rose-950/20 border-rose-900/40 text-rose-200"
                  : "bg-emerald-950/20 border-emerald-900/40 text-emerald-200"
              }`}
            >
              {item.rootCauseSummary}
            </div>
          </div>

          {/* Prominent Action Callout Box */}
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5 text-cyan-400" />
              <span>Mandatory Line Action Protocol</span>
            </div>
            <div
              className={`p-3.5 rounded-lg border text-xs font-semibold flex items-start gap-2.5 ${
                isDefective
                  ? "bg-amber-950/30 border-amber-500/50 text-amber-100 shadow-lg shadow-amber-950/20"
                  : "bg-cyan-950/30 border-cyan-500/40 text-cyan-100"
              }`}
            >
              {isDefective ? (
                <AlertOctagon className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <div className="text-[11px] uppercase tracking-wider text-amber-400 font-bold">
                  {isDefective ? "Immediate Operator Intervention Required" : "Release Protocol"}
                </div>
                <div className="text-xs leading-snug">{item.recommendedAction}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls & Audit Sign-Off */}
        <div className="pt-3 border-t border-[#1F2430] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              type="button"
              className="px-2.5 py-1.5 rounded border border-[#2A3142] bg-[#161924] hover:bg-[#1E2333] text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer text-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Slip</span>
            </button>
          </div>

          <button
            onClick={() => setAcknowledged(!acknowledged)}
            type="button"
            className={`px-3.5 py-1.5 rounded-lg font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
              acknowledged
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                : isDefective
                ? "bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-950/50"
                : "bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-950/50"
            }`}
          >
            <FileCheck2 className="w-3.5 h-3.5" />
            <span>
              {acknowledged ? "Protocol Acknowledged" : isDefective ? "Quarantine & Sign-Off" : "Acknowledge & Release"}
            </span>
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
