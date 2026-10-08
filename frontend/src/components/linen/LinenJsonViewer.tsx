"use client";

import React, { useState, useMemo } from "react";
import { Check, Copy, Download, Code2, ChevronDown, ChevronUp } from "lucide-react";

interface LinenJsonViewerProps {
  data: Record<string, unknown> | null;
  title?: string;
  maxHeight?: string;
}

export function LinenJsonViewer({
  data,
  title = "JSON Output",
  maxHeight = "460px",
}: LinenJsonViewerProps) {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  const jsonString = useMemo(() => {
    if (!data) return "";
    return JSON.stringify(data, null, 2);
  }, [data]);

  const highlightedHtml = useMemo(() => {
    if (!jsonString) return "";

    const lines = jsonString.split("\n");
    return lines
      .map((line, idx) => {
        // Safe escape
        const escaped = line
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");

        // Syntax highlight
        const highlighted = escaped.replace(
          /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
          (match) => {
            if (/^"/.test(match)) {
              if (/:$/.test(match)) {
                // Key
                return `<span class="text-[#1C1917] font-semibold">${match}</span>`;
              }
              // String
              return `<span class="text-[#047857]">${match}</span>`;
            }
            if (/true|false/.test(match)) {
              // Boolean
              return `<span class="text-[#D97706] font-semibold">${match}</span>`;
            }
            if (/null/.test(match)) {
              // Null
              return `<span class="text-[#9CA3AF] italic">${match}</span>`;
            }
            // Number
            return `<span class="text-[#6366F1] font-medium">${match}</span>`;
          }
        );

        return `<div class="table-row"><span class="table-cell pr-4 text-right select-none text-[#A8A29E] text-[11px] font-mono leading-relaxed">${idx + 1}</span><span class="table-cell leading-relaxed font-mono whitespace-pre">${highlighted}</span></div>`;
      })
      .join("");
  }, [jsonString]);

  if (!data) {
    return (
      <div className="rounded-2xl border border-[#E5DFD3] bg-[#FAF8F5] p-6 text-center text-xs font-mono text-[#78716A]">
        No JSON output available yet.
      </div>
    );
  }

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
    a.download = `inspection-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-2xl border border-[#E5DFD3] bg-[#FFFFFF] overflow-hidden shadow-xs text-xs">
      {/* Top Header Bar */}
      <div className="px-4 py-3 bg-[#FAF8F5] border-b border-[#EAE4D7] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-[#EFE9DD] text-[#78350F]">
            <Code2 aria-hidden="true" className="w-4 h-4" />
          </div>
          <div>
            <span className="font-semibold text-[#1C1917] tracking-tight text-xs block">
              {title}
            </span>
            <span className="text-[11px] text-[#78716A] font-mono">
              {lineCount} lines • {(byteSize / 1024).toFixed(1)} KB
            </span>
          </div>
        </div>

        {/* Clean Action Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCopy}
            aria-label="Copy JSON to clipboard"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#DDD5C7] text-[#57534E] hover:text-[#1C1917] hover:bg-[#F3EFE6] transition-[background-color,color,transform] duration-150 active:scale-[0.97] cursor-pointer text-xs font-medium"
            title="Copy JSON"
          >
            {copied ? (
              <>
                <Check aria-hidden="true" className="w-3.5 h-3.5 text-[#16A34A]" />
                <span className="text-[#166534]">Copied</span>
              </>
            ) : (
              <>
                <Copy aria-hidden="true" className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownload}
            aria-label="Download JSON file"
            className="p-1.5 rounded-lg border border-[#DDD5C7] text-[#57534E] hover:text-[#1C1917] hover:bg-[#F3EFE6] transition-[background-color,color,transform] duration-150 active:scale-[0.97] cursor-pointer"
            title="Download JSON"
          >
            <Download aria-hidden="true" className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-label={isExpanded ? "Collapse JSON viewer" : "Expand JSON viewer"}
            aria-expanded={isExpanded}
            className="p-1.5 rounded-lg border border-[#DDD5C7] text-[#57534E] hover:text-[#1C1917] hover:bg-[#F3EFE6] transition-[background-color,color,transform] duration-150 active:scale-[0.97] cursor-pointer"
          >
            {isExpanded ? (
              <ChevronUp aria-hidden="true" className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown aria-hidden="true" className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Code Display Area */}
      {isExpanded && (
        <div
          style={{ maxHeight }}
          className="overflow-y-auto p-4 bg-[#FCFBF8] text-[#1C1917] select-text text-[11px]"
        >
          <div
            className="table w-full font-mono"
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />
        </div>
      )}
    </div>
  );
}
