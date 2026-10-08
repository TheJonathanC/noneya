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
  isDispatching,
  onDispatch,
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
        <div className="flex items-center justify-between">
          <span className="font-semibold text-xs tracking-tight text-[#1C1917]">
            Upload Component
          </span>

          <div
            role="tablist"
            aria-label="Upload inspection mode"
            className="flex p-0.5 rounded-lg bg-[#EAE4D7] text-xs font-medium"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === "single"}
              onClick={() => {
                onModeChange("single");
                setIntakeError(null);
              }}
              className={`py-1 px-2.5 rounded-md text-[11px] transition-all cursor-pointer ${
                mode === "single"
                  ? "bg-[#FFFFFF] text-[#1C1917] font-semibold shadow-2xs"
                  : "text-[#78716A] hover:text-[#1C1917]"
              }`}
            >
              Single
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={mode === "batch"}
              onClick={() => {
                onModeChange("batch");
                setIntakeError(null);
              }}
              className={`py-1 px-2.5 rounded-md text-[11px] transition-all cursor-pointer ${
                mode === "batch"
                  ? "bg-[#FFFFFF] text-[#1C1917] font-semibold shadow-2xs"
                  : "text-[#78716A] hover:text-[#1C1917]"
              }`}
            >
              Batch
            </button>
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
        {stagedItems.length > 0 && (
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

        {stagedItems.map((item) => (
          <div
            key={item.id}
            className="rounded-xl border border-[#E5DFD3] bg-[#FFFFFF] p-2.5 flex items-center gap-3 shadow-2xs text-xs"
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

            {/* Remove */}
            <button
              type="button"
              onClick={() => onRemoveItem(item.id)}
              aria-label={`Remove ${item.file.name}`}
              className="p-1 rounded text-[#A8A29E] hover:text-[#991B1B] hover:bg-[#FEF2F2] transition-colors cursor-pointer"
            >
              <X aria-hidden="true" className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}

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
              <RefreshCw aria-hidden="true" className="w-3.5 h-3.5 animate-spin text-[#FAF8F5]" />
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
