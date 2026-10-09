"use client";

import React, { useRef, useState, DragEvent, ChangeEvent } from "react";
import Image from "next/image";
import {
  Upload,
  X,
  Play,
  RefreshCw,
  FileImage,
  AlertCircle,
  ChevronLeft,
} from "lucide-react";
import { DotsLoader } from "@/components/common/DotsLoader";

export interface StagedItem {
  id: string;
  file: File;
  previewUrl: string;
  presetType?: "nominal" | "defective" | "custom";
  status?: "queued" | "processing" | "completed" | "error";
  verdict?: "ok" | "defective" | "error";
}

interface LinenIntakeProps {
  mode: "single" | "batch";
  onModeChange: (mode: "single" | "batch") => void;
  stagedItems: StagedItem[];
  onAddFiles: (files: File[]) => void;
  onRemoveItem: (id: string) => void;
  onClearQueue: () => void;
  isDispatching: boolean;
  onDispatch: () => void;
  activeStep: 1 | 2 | 3;
  currentProcessingIndex?: number;
  selectedItemIndex?: number;
  onSelectItem?: (index: number) => void;
  onToggleCollapse?: () => void;
}

export function LinenIntake({
  mode,
  onModeChange,
  stagedItems,
  onAddFiles,
  onRemoveItem,
  onClearQueue,
  isDispatching,
  onDispatch,
  currentProcessingIndex = -1,
  selectedItemIndex = 0,
  onSelectItem,
  onToggleCollapse,
}: LinenIntakeProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [intakeError, setIntakeError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateAndAddFiles = (files: File[]) => {
    if (files.length === 0) return;

    const invalidFormat = files.find(
      (f) =>
        !f.type.startsWith("image/") &&
        !/\.(jpe?g|png|webp|svg|bmp|tiff)$/i.test(f.name)
    );
    if (invalidFormat) {
      setIntakeError(
        `Unsupported format: "${invalidFormat.name}". Please upload JPG, PNG, or WEBP images.`
      );
      return;
    }

    const oversized = files.find((f) => f.size > 25 * 1024 * 1024);
    if (oversized) {
      const mb = (oversized.size / (1024 * 1024)).toFixed(1);
      setIntakeError(
        `File too large: "${oversized.name}" is ${mb} MB. Maximum upload size is 25 MB.`
      );
      return;
    }

    setIntakeError(null);
    onAddFiles(mode === "single" ? [files[0]] : files);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const fileList = Array.from(e.dataTransfer.files);
      validateAndAddFiles(fileList);
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const fileList = Array.from(e.target.files);
      validateAndAddFiles(fileList);
      e.target.value = "";
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#FAF8F5] border-r border-[#EAE4D7]">
      {/* Top Section: Mode Switcher */}
      <div className="p-4 sm:p-5 border-b border-[#EAE4D7] space-y-3 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {onToggleCollapse && (
              <button
                type="button"
                onClick={onToggleCollapse}
                title="Minimize intake sidebar"
                aria-label="Minimize intake sidebar"
                className="hidden lg:flex p-1.5 rounded-lg border border-[#DDD5C7] bg-[#FFFFFF] hover:bg-[#F3EFE6] text-[#57534E] hover:text-[#1C1917] transition-colors cursor-pointer shadow-2xs shrink-0"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            )}
            <span className="font-semibold text-xs tracking-tight text-[#1C1917]">
              Component Batch Intake
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#EAE4D7] text-[11px] font-semibold text-[#1C1917]">
            <span>Batch Engine</span>
          </div>
        </div>

        {/* Dropzone */}
        <div
          role="button"
          tabIndex={0}
          aria-label={
            mode === "single"
              ? "Upload component photo or browse"
              : "Upload batch photos or browse"
          }
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-[border-color,background-color,transform] duration-150 active:scale-[0.99] flex flex-col items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C1917] ${
            isDragging
              ? "border-[#1C1917] bg-[#F3EFE6] scale-[1.01]"
              : "border-[#DDD5C7] hover:border-[#1C1917] bg-[#FFFFFF] hover:bg-[#FAF8F5]"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple={mode === "batch"}
            accept="image/*"
            aria-label="Component image file input"
            onChange={handleFileInputChange}
            className="hidden"
          />

          <div className="w-9 h-9 rounded-full bg-[#FAF8F5] border border-[#E5DFD3] text-[#57534E] flex items-center justify-center">
            <Upload aria-hidden="true" className="w-4 h-4" />
          </div>

          <div className="space-y-0.5">
            <div className="text-xs font-semibold text-[#1C1917]">
              {mode === "single"
                ? "Drop image here or click to browse"
                : "Drop multiple images or browse"}
            </div>
            <p className="text-[11px] text-[#78716A]">
              PNG, JPG, WEBP • Max 25 MB
            </p>
          </div>
        </div>

        {/* Error Notice */}
        {intakeError && (
          <div className="p-2.5 rounded-xl bg-[#FEF2F2] border border-[#FCA5A5]/60 text-[#991B1B] text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle aria-hidden="true" className="w-4 h-4 shrink-0" />
              <span className="truncate">{intakeError}</span>
            </div>
            <button
              type="button"
              onClick={() => setIntakeError(null)}
              aria-label="Dismiss error notice"
              className="p-1 rounded text-[#991B1B] hover:bg-[#FEE2E2] transition-colors cursor-pointer shrink-0"
            >
              <X aria-hidden="true" className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Staged Items List */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
        {/* Real-time Sequential Batch Flow Banner */}
        {isDispatching && mode === "batch" && currentProcessingIndex >= 0 && (
          <div className="p-3 mb-2 rounded-xl bg-[#FAF8F5] border border-[#DDD5C7] text-xs space-y-2 shadow-2xs">
            <div className="flex items-center justify-between text-[11px] font-medium text-[#1C1917]">
              <span className="flex items-center gap-1.5">
                <DotsLoader size="sm" shape="loader" className="w-3.5 h-3.5" />
                <span>Processing Part {currentProcessingIndex + 1} of {stagedItems.length}</span>
              </span>
              <span className="font-mono text-[#78716A] tabular-nums font-semibold">
                {Math.round(((currentProcessingIndex + 1) / stagedItems.length) * 100)}%
              </span>
            </div>
            <div className="w-full bg-[#E5DFD3] h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-[#1C1917] h-full rounded-full transition-all duration-300 ease-out"
                style={{
                  width: `${((currentProcessingIndex + 1) / stagedItems.length) * 100}%`,
                }}
              />
            </div>
          </div>
        )}

        {stagedItems.length > 0 && !isDispatching && (
          <div className="flex items-center justify-between pb-1">
            <span className="text-[11px] font-medium text-[#78716A]">
              Selected Image{stagedItems.length > 1 ? "s" : ""} ({stagedItems.length})
            </span>
            <button
              type="button"
              onClick={onClearQueue}
              className="text-[11px] text-[#78716A] hover:text-[#991B1B] transition-colors cursor-pointer"
            >
              Clear
            </button>
          </div>
        )}

        {stagedItems.map((item, idx) => {
          const isCurrent = isDispatching && currentProcessingIndex === idx;
          const isDone = item.status === "completed";
          const isQueued = isDispatching && idx > currentProcessingIndex;
          const isSelected = selectedItemIndex === idx;

          return (
            <div
              key={item.id}
              onClick={() => {
                if (isDone && onSelectItem) {
                  onSelectItem(idx);
                }
              }}
              className={`rounded-xl border p-2.5 flex items-center gap-3 shadow-2xs text-xs transition-all ${
                isCurrent
                  ? "border-[#1C1917] bg-[#FFFDF9] ring-2 ring-[#1C1917]/20 shadow-xs"
                  : isDone
                  ? isSelected
                    ? "border-[#1C1917] bg-[#FFFFFF] ring-1 ring-[#1C1917] cursor-pointer"
                    : "border-[#E5DFD3] bg-[#FFFFFF] hover:bg-[#FAF8F5] cursor-pointer"
                  : "border-[#E5DFD3] bg-[#FFFFFF]"
              }`}
            >
              {/* Thumbnail */}
              <div className="relative w-11 h-9 rounded-lg border border-[#E5DFD3] bg-[#0E1017] overflow-hidden shrink-0 flex items-center justify-center">
                <Image
                  src={item.previewUrl}
                  alt={item.file.name}
                  fill
                  sizes="44px"
                  className="object-cover"
                  unoptimized
                />
                {isCurrent && (
                  <div className="absolute inset-0 bg-[#1C1917]/40 backdrop-blur-[0.5px] flex items-center justify-center p-1">
                    <DotsLoader size="sm" shape="loader" className="w-5 h-5 text-white" />
                  </div>
                )}
              </div>

              {/* File info */}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-[#1C1917] truncate text-xs">
                  {item.file.name}
                </div>
                <div className="text-[10px] text-[#78716A] tabular-nums mt-0.5">
                  {(item.file.size / 1024).toFixed(1)} KB
                </div>
              </div>

              {/* Status / Actions */}
              {isCurrent && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] flex items-center gap-1.5 shrink-0">
                  <DotsLoader size="sm" shape="loader" className="w-3 h-3" />
                  <span>Analyzing</span>
                </span>
              )}

              {isDone && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border shrink-0 ${
                    item.verdict === "defective"
                      ? "bg-[#FEF2F2] text-[#991B1B] border-[#FCA5A5]/70"
                      : "bg-[#F0FDF4] text-[#166534] border-[#86EFAC]/70"
                  }`}
                >
                  {item.verdict === "defective" ? "Defective" : "OK"}
                </span>
              )}

              {isQueued && (
                <span className="text-[10px] text-[#A8A29E] font-mono shrink-0">
                  Queued
                </span>
              )}

              {!isDispatching && !isDone && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveItem(item.id);
                  }}
                  aria-label={`Remove ${item.file.name}`}
                  className="p-1 rounded text-[#A8A29E] hover:text-[#991B1B] hover:bg-[#FEF2F2] transition-colors cursor-pointer shrink-0"
                >
                  <X aria-hidden="true" className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        })}

        {stagedItems.length === 0 && (
          <div className="py-10 text-center text-[#78716A] text-xs flex flex-col items-center justify-center gap-2 border border-dashed border-[#E5DFD3] rounded-2xl bg-[#FFFFFF]">
            <FileImage aria-hidden="true" className="w-7 h-7 text-[#D6CEBF]" />
            <p className="text-[11px] text-[#78716A]">
              No images queued yet. Drop an image or browse above.
            </p>
          </div>
        )}
      </div>

      {/* Bottom Dispatch Footer */}
      <div className="p-4 sm:p-5 border-t border-[#EAE4D7] bg-[#FAF8F5] shrink-0">
        <button
          type="button"
          onClick={onDispatch}
          disabled={stagedItems.length === 0 || isDispatching}
          aria-label={
            isDispatching
              ? "Inspecting component"
              : `Inspect ${stagedItems.length} component${stagedItems.length === 1 ? "" : "s"}`
          }
          className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-[background-color,opacity,transform] duration-150 cursor-pointer shadow-xs ${
            stagedItems.length === 0 || isDispatching
              ? "bg-[#EAE4D7] text-[#A8A29E] cursor-not-allowed"
              : "bg-[#1C1917] hover:bg-[#2C2724] text-[#FAF8F5] active:scale-[0.98]"
          }`}
        >
          {isDispatching ? (
            <>
              <DotsLoader size="sm" shape="loader" className="w-4 h-4 brightness-200 invert" />
              <span>Inspecting…</span>
            </>
          ) : (
            <>
              <Play aria-hidden="true" className="w-3.5 h-3.5 fill-current" />
              <span>Inspect Component</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
