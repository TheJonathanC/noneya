"use client";

import React, { useRef, useState, DragEvent, ChangeEvent } from "react";
import Image from "next/image";
import {
  Upload,
  Trash2,
  X,
  Play,
  RefreshCw,
  Sparkles,
  Layers,
  FileImage,
  ArrowRight,
  ShieldAlert,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";

export interface StagedItem {
  id: string;
  file: File;
  previewUrl: string;
  presetType?: "nominal" | "defective" | "custom";
}

interface LinenIntakeProps {
  mode: "single" | "batch";
  onModeChange: (mode: "single" | "batch") => void;
  stagedItems: StagedItem[];
  onAddFiles: (files: File[]) => void;
  onRemoveItem: (id: string) => void;
  onClearQueue: () => void;
  onLoadPreset: (preset: "nominal" | "defective" | "pilot_5") => void;
  isDispatching: boolean;
  onDispatch: () => void;
  activeStep: 1 | 2 | 3;
}

export function LinenIntake({
  mode,
  onModeChange,
  stagedItems,
  onAddFiles,
  onRemoveItem,
  onClearQueue,
  onLoadPreset,
  isDispatching,
  onDispatch,
  activeStep,
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
    <div className="flex flex-col h-full bg-[#F5F1E8] border-r border-[#E5DFD3]">
      {/* Top Section: Intake Header & Mode Selector */}
      <div className="p-4 sm:p-5 border-b border-[#E6E0D3] bg-[#FAF8F5] space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-[#EFE9DD] text-[#78350F]">
              <Layers aria-hidden="true" className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="font-semibold text-xs tracking-wider text-[#1C1917] uppercase block">
                Intake & Dispatch
              </span>
              <span className="text-[10px] text-[#78716A]">
                Stage components for backend model hand-off
              </span>
            </div>
          </div>

          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#EFEAE0] text-[#78350F] border border-[#DDD5C7] font-semibold">
            STEP 1 OF 3
          </span>
        </div>

        {/* Mode Switcher: Single vs Batch */}
        <div
          role="tablist"
          aria-label="Upload inspection intake mode"
          className="grid grid-cols-2 p-1 rounded-xl bg-[#EAE4D7] border border-[#DDD5C7] font-mono text-xs"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "single"}
            onClick={() => {
              onModeChange("single");
              setIntakeError(null);
            }}
            className={`py-2 px-3 rounded-lg font-medium text-xs transition-[background-color,color,box-shadow,transform] duration-150 active:scale-[0.97] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A3412] ${
              mode === "single"
                ? "bg-[#FFFFFF] text-[#1C1917] font-bold shadow-xs"
                : "text-[#78716A] hover:text-[#1C1917]"
            }`}
          >
            Single Part
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={mode === "batch"}
            onClick={() => {
              onModeChange("batch");
              setIntakeError(null);
            }}
            className={`py-2 px-3 rounded-lg font-medium text-xs transition-[background-color,color,box-shadow,transform] duration-150 active:scale-[0.97] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A3412] ${
              mode === "batch"
                ? "bg-[#FFFFFF] text-[#1C1917] font-bold shadow-xs"
                : "text-[#78716A] hover:text-[#1C1917]"
            }`}
          >
            Batch Lot (5–10)
          </button>
        </div>
      </div>

      {/* Intake Dropzone */}
      <div className="p-4 sm:p-5 border-b border-[#E6E0D3] bg-[#FAF8F5] space-y-3.5">
        <div
          role="button"
          tabIndex={0}
          aria-label={
            mode === "single"
              ? "Upload single component image or browse"
              : "Upload batch component images or browse"
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
          className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-[border-color,background-color,transform] duration-150 active:scale-[0.99] flex flex-col items-center justify-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A3412] ${
            isDragging
              ? "border-[#C2410C] bg-[#FDF7F3] scale-[1.01]"
              : "border-[#D8CFBF] hover:border-[#9A3412] bg-[#FFFFFF] hover:bg-[#FDFBF7]"
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

          <div className="w-10 h-10 rounded-full bg-[#F7F2E8] border border-[#E4DDD1] text-[#9A3412] flex items-center justify-center shadow-xs">
            <Upload aria-hidden="true" className="w-5 h-5" />
          </div>

          <div className="space-y-0.5">
            <div className="text-xs font-semibold text-[#1C1917]">
              {mode === "single"
                ? "Drop component image here or browse"
                : "Drop batch images (1 to 10 parts) or browse"}
            </div>
            <p className="text-[11px] text-[#78716A]">
              Accepts high-resolution captures (PNG, JPG, WEBP • Max 25 MB)
            </p>
          </div>
        </div>

        {/* Client-side Intake Validation Alert Banner */}
        {intakeError && (
          <div className="p-3 rounded-xl bg-[#FEF6F3] border border-[#FCD6C2] text-[#9A3412] font-mono text-xs flex items-center justify-between gap-2 shadow-xs animate-in fade-in duration-150">
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle aria-hidden="true" className="w-4 h-4 text-[#EA580C] shrink-0" />
              <span className="truncate">{intakeError}</span>
            </div>
            <button
              type="button"
              onClick={() => setIntakeError(null)}
              aria-label="Dismiss error notice"
              className="p-1 rounded text-[#9A3412] hover:bg-[#FDF2E9] transition-colors cursor-pointer shrink-0"
            >
              <X aria-hidden="true" className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* 1-Click Test Presets */}
        <div className="space-y-1.5">
          <div className="text-[10px] font-mono text-[#78716A] uppercase flex items-center gap-1 font-semibold">
            <Sparkles aria-hidden="true" className="w-3 h-3 text-[#9A3412]" />
            <span>Instant sample presets:</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {mode === "single" ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setIntakeError(null);
                    onLoadPreset("nominal");
                  }}
                  className="flex-1 py-1.5 px-2.5 rounded-lg border border-[#C6E6C8] bg-[#EDF7EE] hover:bg-[#E3F2E4] text-[#166534] font-mono text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-[background-color,border-color,transform] duration-150 active:scale-[0.97] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#166534] shadow-xs"
                >
                  <ShieldCheck aria-hidden="true" className="w-3.5 h-3.5 text-[#16A34A]" />
                  <span>Nominal Part</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIntakeError(null);
                    onLoadPreset("defective");
                  }}
                  className="flex-1 py-1.5 px-2.5 rounded-lg border border-[#FCD6C2] bg-[#FDF2E9] hover:bg-[#FCE6D7] text-[#9A3412] font-mono text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-[background-color,border-color,transform] duration-150 active:scale-[0.97] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A3412] shadow-xs"
                >
                  <ShieldAlert aria-hidden="true" className="w-3.5 h-3.5 text-[#EA580C]" />
                  <span>Defective Part</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIntakeError(null);
                  onLoadPreset("pilot_5");
                }}
                className="w-full py-2 px-3 rounded-lg border border-[#E2DBD0] bg-[#FAF8F5] hover:bg-[#F3EFE6] text-[#78350F] font-mono text-xs font-semibold flex items-center justify-center gap-2 transition-[background-color,border-color,transform] duration-150 active:scale-[0.97] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A3412] shadow-xs"
              >
                <Layers aria-hidden="true" className="w-3.5 h-3.5 text-[#9A3412]" />
                <span>Load Calibrated 5-Part Pilot Batch</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Staged Queue Header */}
      <div className="px-4 sm:px-5 py-2.5 bg-[#F0EAE0] border-b border-[#E4DDD1] flex items-center justify-between text-xs font-mono text-[#57534E]">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-[#1C1917] uppercase tracking-wider text-[11px]">
            Staged Queue ({stagedItems.length})
          </span>
          {isDispatching && <RefreshCw aria-hidden="true" className="w-3 h-3 text-[#9A3412] animate-spin" />}
        </div>

        {stagedItems.length > 0 && (
          <button
            type="button"
            onClick={onClearQueue}
            aria-label="Clear all staged images"
            className="flex items-center gap-1 text-[11px] text-[#78716A] hover:text-[#9A3412] transition-[color,transform] duration-150 active:scale-[0.97] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A3412]"
          >
            <Trash2 aria-hidden="true" className="w-3 h-3" />
            <span>Clear</span>
          </button>
        )}
      </div>

      {/* Staged Items Scroll List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
        {stagedItems.map((item, index) => (
          <div
            key={item.id}
            className="group rounded-xl border border-[#E5DFD3] bg-[#FFFFFF] hover:bg-[#FDFBF7] p-3 transition-[background-color,border-color,box-shadow] duration-150 shadow-xs flex items-center gap-3 font-mono text-xs"
          >
            {/* Index number */}
            <div className="text-[10px] font-bold text-[#A8A29E] w-4 text-right shrink-0 tabular-nums">
              {String(index + 1).padStart(2, "0")}
            </div>

            {/* Thumbnail Preview */}
            <div className="relative w-12 h-10 rounded-lg border border-[#E4DDD1] bg-[#0E1017] overflow-hidden shrink-0 flex items-center justify-center">
              <Image
                src={item.previewUrl}
                alt={item.file.name}
                fill
                sizes="48px"
                className="object-cover"
                unoptimized
              />
            </div>

            {/* Filename & Info */}
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-[#1C1917] truncate text-xs">
                {item.file.name}
              </div>
              <div className="text-[10px] text-[#78716A] flex items-center gap-2 mt-0.5 tabular-nums">
                <span>{(item.file.size / 1024).toFixed(1)} KB</span>
                <span>•</span>
                <span className="text-[#9A3412] font-semibold">Ready for Model</span>
              </div>
            </div>

            {/* Remove item button */}
            <button
              type="button"
              onClick={() => onRemoveItem(item.id)}
              aria-label={`Remove ${item.file.name} from queue`}
              className="p-1 rounded-md text-[#A8A29E] hover:text-[#9A3412] hover:bg-[#FDF2E9] transition-[color,background-color,transform] duration-150 active:scale-[0.95] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A3412]"
            >
              <X aria-hidden="true" className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}

        {stagedItems.length === 0 && (
          <div className="p-8 text-center text-[#78716A] font-mono text-xs flex flex-col items-center justify-center gap-3 border border-dashed border-[#DCD5C6] rounded-2xl bg-[#FAF8F5]">
            <FileImage aria-hidden="true" className="w-8 h-8 text-[#A8A29E]" />
            <div className="space-y-1">
              <span className="text-[#1C1917] font-semibold block text-balance">
                Intake Queue Is Empty
              </span>
              <p className="text-[11px] text-[#78716A] block text-balance">
                Drop {mode === "single" ? "a component photo" : "sample batch photos"} above, or
                click one of the test presets to stage immediately.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Dispatch Action Footer */}
      <div className="p-4 sm:p-5 border-t border-[#E6E0D3] bg-[#FAF8F5] space-y-3.5">
        {/* Pipeline Sequence Progress */}
        <div className="flex items-center justify-between text-[11px] font-mono text-[#78716A]">
          <span className="flex items-center gap-1.5 font-medium">
            <span
              className={`w-2 h-2 rounded-full ${
                activeStep >= 1 ? "bg-[#9A3412]" : "bg-[#D6CEBF]"
              }`}
            />
            <span>1. Stage</span>
          </span>
          <ArrowRight aria-hidden="true" className="w-3 h-3 text-[#D6CEBF]" />
          <span className="flex items-center gap-1.5 font-medium">
            <span
              className={`w-2 h-2 rounded-full ${
                activeStep >= 2 ? "bg-[#EA580C] animate-pulse" : "bg-[#D6CEBF]"
              }`}
            />
            <span>2. Call Model</span>
          </span>
          <ArrowRight aria-hidden="true" className="w-3 h-3 text-[#D6CEBF]" />
          <span className="flex items-center gap-1.5 font-medium">
            <span
              className={`w-2 h-2 rounded-full ${
                activeStep >= 3 ? "bg-[#16A34A]" : "bg-[#D6CEBF]"
              }`}
            />
            <span>3. Return JSON</span>
          </span>
        </div>

        {/* Primary Hand-Off CTA Button */}
        <button
          type="button"
          onClick={onDispatch}
          disabled={stagedItems.length === 0 || isDispatching}
          aria-label={
            isDispatching
              ? "Calling inspection models"
              : `Hand off ${stagedItems.length} items to backend models`
          }
          className={`w-full py-3 px-4 rounded-xl font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-[background-color,border-color,color,box-shadow,transform] duration-150 cursor-pointer shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A3412] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FAF8F5] ${
            stagedItems.length === 0 || isDispatching
              ? "bg-[#EAE4D7] text-[#A8A29E] border border-[#DDD5C7] cursor-not-allowed"
              : "bg-[#1C1917] hover:bg-[#2C2724] text-[#FAF8F5] hover:shadow-md active:scale-[0.97]"
          }`}
        >
          {isDispatching ? (
            <>
              <RefreshCw aria-hidden="true" className="w-4 h-4 animate-spin text-[#FAF8F5]" />
              <span>Handing off to backend models…</span>
            </>
          ) : (
            <>
              <Play aria-hidden="true" className="w-4 h-4 fill-current" />
              <span>
                {mode === "single"
                  ? "Dispatch Image to Backend Model"
                  : `Dispatch Batch (${stagedItems.length} Parts) to Backend`}
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
