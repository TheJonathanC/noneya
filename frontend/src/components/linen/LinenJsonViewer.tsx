"use client";

import React, { useState } from "react";
import { Check, Copy, Download, Code2, ChevronDown, ChevronUp } from "lucide-react";

interface LinenJsonViewerProps {
  data: Record<string, unknown> | null;
  title?: string;
  maxHeight?: string;
}

export function LinenJsonViewer({
  data,
  title = "Backend Model JSON Payload",
  maxHeight = "520px",
}: LinenJsonViewerProps) {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  if (!data) {
    return (
      <div className="rounded-xl border border-[#E5DFD3] bg-[#FAF8F5] p-6 text-center text-xs font-mono text-[#78716A]">
        No JSON payload returned yet. Run an inspection on the left intake station to evaluate components.
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
    a.download = `aura-inspection-${Date.now()}.json`;
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
    <div className="rounded-xl border border-[#E5DFD3] bg-[#FFFFFF] overflow-hidden shadow-xs font-mono text-xs">
      {/* Top Header Bar */}
      <div className="px-4 py-3 bg-[#F7F4EC] border-b border-[#E6E0D3] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1 rounded bg-[#EAE4D7] text-[#78350F]">
            <Code2 aria-hidden="true" className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="font-semibold text-[#1C1917] tracking-wider text-[11px] uppercase block">
              {title}
            </span>
            <span className="text-[10px] text-[#78716A]">
              {lineCount} lines • {byteSize} bytes • raw server format
            </span>
          </div>
        </div>

        {/* Quick Summary Chips & Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {prediction && (
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${
                prediction === "DEFECTIVE"
                  ? "bg-[#FDF2E9] text-[#9A3412] border border-[#FCD6C2]"
                  : "bg-[#EDF7EE] text-[#166534] border border-[#C6E6C8]"
              }`}
            >
              PREDICTION: {prediction}
            </span>
          )}

          {confidence && (
            <span className="px-2 py-0.5 rounded text-[10px] bg-[#FAF8F5] border border-[#E2DBD0] text-[#78716A] tabular-nums font-medium">
              CONF: <strong className="text-[#1C1917]">{confidence}</strong>
            </span>
          )}

          {latency && (
            <span className="px-2 py-0.5 rounded text-[10px] bg-[#FAF8F5] border border-[#E2DBD0] text-[#78716A] tabular-nums">
              {latency}
            </span>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-1 ml-1 border-l border-[#E2DBD0] pl-2">
            <button
              type="button"
              onClick={handleCopy}
              aria-label="Copy JSON payload to clipboard"
              className="p-1.5 rounded-md text-[#78716A] hover:text-[#1C1917] hover:bg-[#EFEAE0] transition-[background-color,color,transform] duration-150 active:scale-[0.97] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A3412]"
              title="Copy JSON payload"
            >
              {copied ? (
                <span className="flex items-center gap-1 text-[#166534] text-[10px] font-semibold px-1">
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
              className="p-1.5 rounded-md text-[#78716A] hover:text-[#1C1917] hover:bg-[#EFEAE0] transition-[background-color,color,transform] duration-150 active:scale-[0.97] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A3412]"
              title="Download JSON file"
            >
              <Download aria-hidden="true" className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              aria-label={isExpanded ? "Collapse JSON viewer" : "Expand JSON viewer"}
              aria-expanded={isExpanded}
              className="p-1.5 rounded-md text-[#78716A] hover:text-[#1C1917] hover:bg-[#EFEAE0] transition-[background-color,color,transform] duration-150 active:scale-[0.97] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A3412]"
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

      {/* Code Display Area on Warm Parchment */}
      {isExpanded && (
        <div
          style={{ maxHeight }}
          className="overflow-y-auto p-4 bg-[#FBF9F5] text-[#292524] select-text leading-relaxed text-[11px]"
        >
          <pre className="font-mono whitespace-pre-wrap break-all">
            <code>{jsonString}</code>
          </pre>
        </div>
      )}
    </div>
  );
}
