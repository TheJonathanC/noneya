"use client";

import React, { useState } from "react";
import { Check, Copy, Download, Code2, ChevronDown, ChevronUp } from "lucide-react";

interface JsonViewerProps {
  data: Record<string, unknown> | null;
  title?: string;
  maxHeight?: string;
}

export function JsonViewer({
  data,
  title = "Backend Model JSON Response",
  maxHeight = "500px",
}: JsonViewerProps) {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  if (!data) {
    return (
      <div className="rounded-xl border border-[#1E2330] bg-[#0C0E14] p-6 text-center text-xs font-mono text-slate-500">
        No JSON response returned yet. Dispatch an inspection on the intake panel to view backend model output.
      </div>
    );
  }

  const jsonString = JSON.stringify(data, null, 2);
  const byteSize = new Blob([jsonString]).size;
  const lineCount = jsonString.split("\n").length;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleDownload = () => {
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `model-inspection-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Quick summary chips for key fields
  const prediction = typeof data.prediction === "string" ? data.prediction : null;
  const confidence =
    typeof data.confidence_score === "number"
      ? `${(data.confidence_score * (data.confidence_score <= 1 ? 100 : 1)).toFixed(1)}%`
      : null;
  const latency = typeof data.latency_ms === "number" ? `${data.latency_ms} ms` : null;

  return (
    <div className="rounded-xl border border-[#1E2330] bg-[#0A0C11] overflow-hidden shadow-2xl font-mono text-xs">
      {/* Top Header Bar */}
      <div className="px-4 py-2.5 bg-[#12151E] border-b border-[#1E2330] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Code2 aria-hidden="true" className="w-4 h-4 text-cyan-400" />
          <span className="font-semibold text-slate-200 tracking-wider text-[11px] uppercase">
            {title}
          </span>
          <span className="text-[10px] text-slate-500">
            ({lineCount} lines • {byteSize} bytes)
          </span>
        </div>

        {/* Quick Summary Chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {prediction && (
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                prediction === "DEFECTIVE"
                  ? "bg-rose-950/70 text-rose-300 border border-rose-800/40"
                  : "bg-emerald-950/70 text-emerald-300 border border-emerald-800/40"
              }`}
            >
              PREDICTION: {prediction}
            </span>
          )}

          {confidence && (
            <span className="px-2 py-0.5 rounded text-[10px] bg-slate-900 border border-slate-700/60 text-cyan-300 tabular-nums">
              CONF: {confidence}
            </span>
          )}

          {latency && (
            <span className="px-2 py-0.5 rounded text-[10px] bg-slate-900 border border-slate-700/60 text-slate-400 tabular-nums">
              {latency}
            </span>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-1 ml-1">
            <button
              type="button"
              onClick={handleCopy}
              aria-label="Copy JSON to clipboard"
              className="p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-[#1A1F2D] border border-transparent hover:border-[#2D3547] transition-[color,background-color,border-color,transform] duration-150 active:scale-[0.97] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              title="Copy JSON payload"
            >
              {copied ? (
                <span className="flex items-center gap-1 text-emerald-400 text-[10px] px-1">
                  <Check aria-hidden="true" className="w-3 h-3" />
                  Copied
                </span>
              ) : (
                <Copy aria-hidden="true" className="w-3.5 h-3.5" />
              )}
            </button>

            <button
              type="button"
              onClick={handleDownload}
              aria-label="Download JSON file"
              className="p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-[#1A1F2D] border border-transparent hover:border-[#2D3547] transition-[color,background-color,border-color,transform] duration-150 active:scale-[0.97] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              title="Download JSON file"
            >
              <Download aria-hidden="true" className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              aria-label={isExpanded ? "Collapse JSON viewer" : "Expand JSON viewer"}
              aria-expanded={isExpanded}
              className="p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-[#1A1F2D] transition-[color,background-color,transform] duration-150 active:scale-[0.97] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              {isExpanded ? (
                <ChevronUp aria-hidden="true" className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown aria-hidden="true" className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Code Display Area */}
      {isExpanded && (
        <div
          style={{ maxHeight }}
          className="overflow-y-auto p-4 bg-[#090B0E] text-slate-300 select-text leading-relaxed text-[11px]"
        >
          <pre className="font-mono whitespace-pre-wrap break-all">
            <code>{jsonString}</code>
          </pre>
        </div>
      )}
    </div>
  );
}
