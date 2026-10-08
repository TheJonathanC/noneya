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
} from "lucide-react";

export interface StagedItem {
  id: string;
  file: File;
  previewUrl: string;
  presetType?: "nominal" | "defective" | "custom";
}

interface IntakePanelProps {
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

export function IntakePanel({
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
}: IntakePanelProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const fileList = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith("image/")
      );
      if (fileList.length > 0) {
        onAddFiles(mode === "single" ? [fileList[0]] : fileList);
      }
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const fileList = Array.from(e.target.files).filter((f) =>
        f.type.startsWith("image/")
      );
      if (fileList.length > 0) {
        onAddFiles(mode === "single" ? [fileList[0]] : fileList);
      }
      e.target.value = "";
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0E1017] border-r border-[#1E2330]">
      {/* Top Section: Mode Switcher & Station Context */}
      <div className="p-4 border-b border-[#1E2330] bg-[#12151E]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5 text-xs font-mono font-semibold uppercase text-slate-200">
            <Layers aria-hidden="true" className="w-3.5 h-3.5 text-cyan-400" />
            <span>Intake & Model Hand-Off</span>
          </div>
          <span className="text-[10px] font-mono text-cyan-400 font-semibold px-2 py-0.5 rounded bg-cyan-950/40 border border-cyan-800/40">
            FLOW STEP 1 OF 3
          </span>
        </div>

        {/* Mode Toggle: Single vs Batch */}
        <div
          role="tablist"
          aria-label="Upload inspection intake mode"
          className="grid grid-cols-2 p-1 rounded-lg bg-[#0A0C11] border border-[#232938] font-mono text-xs"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "single"}
            onClick={() => onModeChange("single")}
            className={`py-1.5 px-3 rounded-md font-medium text-xs transition-[background-color,color,border-color,transform] duration-150 active:scale-[0.97] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
              mode === "single"
                ? "bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-[#141724]"
            }`}
          >
            Single Photo (1 Part)
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={mode === "batch"}
            onClick={() => onModeChange("batch")}
            className={`py-1.5 px-3 rounded-md font-medium text-xs transition-[background-color,color,border-color,transform] duration-150 active:scale-[0.97] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
              mode === "batch"
                ? "bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-[#141724]"
            }`}
          >
            Batch Pilot (Multi-Part)
          </button>
        </div>
      </div>

      {/* Upload Dropzone */}
      <div className="p-4 border-b border-[#1E2330] bg-[#10121A] space-y-3">
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
          className={`border border-dashed rounded-xl p-4 text-center cursor-pointer transition-[border-color,background-color,transform] duration-150 active:scale-[0.99] flex flex-col items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
            isDragging
              ? "border-cyan-400 bg-cyan-950/40 scale-[1.01]"
              : "border-[#272E3F] hover:border-cyan-500/50 bg-[#141722] hover:bg-[#171B28]"
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

          <div className="p-2.5 rounded-full bg-cyan-950/40 border border-cyan-800/40 text-cyan-400">
            <Upload aria-hidden="true" className="w-5 h-5" />
          </div>

          <div className="space-y-0.5">
            <div className="text-xs font-mono font-semibold text-slate-100">
              {mode === "single"
                ? "Drop component image here or browse"
                : "Drop batch images (1–10) or browse"}
            </div>
            <p className="text-[10px] font-mono text-slate-500">
              Accepts high-res captures (PNG, JPG, WEBP, TIFF)
            </p>
          </div>
        </div>

        {/* Quick Sample Presets (1-Click Test) */}
        <div>
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 uppercase mb-1.5">
            <span className="flex items-center gap-1">
              <Sparkles aria-hidden="true" className="w-3 h-3 text-cyan-400" />
              Quick-load test presets:
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {mode === "single" ? (
              <>
                <button
                  type="button"
                  onClick={() => onLoadPreset("nominal")}
                  className="flex-1 py-1 px-2 rounded border border-emerald-800/40 bg-emerald-950/20 hover:bg-emerald-950/40 text-emerald-300 font-mono text-[11px] font-medium flex items-center justify-center gap-1.5 transition-[background-color,border-color,transform] duration-150 active:scale-[0.97] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                >
                  <ShieldCheck aria-hidden="true" className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Nominal Part</span>
                </button>

                <button
                  type="button"
                  onClick={() => onLoadPreset("defective")}
                  className="flex-1 py-1 px-2 rounded border border-rose-800/40 bg-rose-950/20 hover:bg-rose-950/40 text-rose-300 font-mono text-[11px] font-medium flex items-center justify-center gap-1.5 transition-[background-color,border-color,transform] duration-150 active:scale-[0.97] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                >
                  <ShieldAlert aria-hidden="true" className="w-3.5 h-3.5 text-rose-400" />
                  <span>Defective Part</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => onLoadPreset("pilot_5")}
                className="w-full py-1.5 px-3 rounded border border-cyan-800/40 bg-cyan-950/30 hover:bg-cyan-950/50 text-cyan-300 font-mono text-xs font-semibold flex items-center justify-center gap-2 transition-[background-color,border-color,transform] duration-150 active:scale-[0.97] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                <Layers aria-hidden="true" className="w-3.5 h-3.5 text-cyan-400" />
                <span>Load Calibrated 5-Part Pilot Batch</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Staged Queue Section Header */}
      <div className="px-4 py-2 bg-[#0C0E14] border-b border-[#1A1E29] flex items-center justify-between text-xs font-mono text-slate-400">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-200 uppercase tracking-wider text-[11px]">
            Staged for Model Hand-Off ({stagedItems.length})
          </span>
          {isDispatching && <RefreshCw aria-hidden="true" className="w-3 h-3 text-cyan-400 animate-spin" />}
        </div>

        {stagedItems.length > 0 && (
          <button
            type="button"
            onClick={onClearQueue}
            aria-label="Clear all staged images"
            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-rose-400 transition-[color,background-color,transform] duration-150 active:scale-[0.97] px-2 py-0.5 rounded border border-[#242A3B] bg-[#141722] hover:border-rose-900/60 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
          >
            <Trash2 aria-hidden="true" className="w-3 h-3" />
            <span>Clear</span>
          </button>
        )}
      </div>

      {/* Staged Queue Items Scroll List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {stagedItems.map((item, index) => (
          <div
            key={item.id}
            className="group relative rounded-lg border border-[#1E2330] bg-[#12141C] hover:bg-[#151822] p-2.5 transition-[background-color,border-color] duration-150 font-mono text-xs flex items-center gap-3"
          >
            {/* Index number */}
            <div className="text-[10px] font-bold text-slate-500 w-4 text-right shrink-0 tabular-nums">
              {String(index + 1).padStart(2, "0")}
            </div>

            {/* Thumbnail Preview */}
            <div className="relative w-12 h-10 rounded border border-[#272E3F] bg-[#0A0C10] overflow-hidden shrink-0 flex items-center justify-center">
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
              <div className="font-semibold text-slate-100 truncate text-xs">
                {item.file.name}
              </div>
              <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5 tabular-nums">
                <span>{(item.file.size / 1024).toFixed(1)} KB</span>
                <span>•</span>
                <span className="text-cyan-400 font-medium">Ready for Model</span>
              </div>
            </div>

            {/* Remove item button */}
            <button
              type="button"
              onClick={() => onRemoveItem(item.id)}
              aria-label={`Remove ${item.file.name} from queue`}
              className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition-[color,background-color,transform] duration-150 active:scale-[0.95] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
            >
              <X aria-hidden="true" className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}

        {stagedItems.length === 0 && (
          <div className="p-8 text-center text-slate-500 font-mono text-xs flex flex-col items-center justify-center gap-3 border border-dashed border-[#1E2330] rounded-xl bg-[#0B0D12]">
            <FileImage aria-hidden="true" className="w-8 h-8 text-slate-600" />
            <div className="space-y-1">
              <span className="text-slate-300 font-semibold block text-balance">
                Intake Queue Is Empty
              </span>
              <p className="text-[11px] text-slate-500 block text-balance">
                Drop {mode === "single" ? "a component photo" : "sample batch photos"} above, or
                click one of the test presets to stage immediately.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Dispatch Action Footer */}
      <div className="p-4 border-t border-[#1E2330] bg-[#12151E] space-y-3">
        {/* Pipeline Sequence Progress */}
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
          <span className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                activeStep >= 1 ? "bg-cyan-400" : "bg-slate-600"
              }`}
            />
            <span>1. Stage</span>
          </span>
          <ArrowRight aria-hidden="true" className="w-3 h-3 text-slate-600" />
          <span className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                activeStep >= 2 ? "bg-cyan-400 animate-pulse" : "bg-slate-600"
              }`}
            />
            <span>2. Call Model</span>
          </span>
          <ArrowRight aria-hidden="true" className="w-3 h-3 text-slate-600" />
          <span className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                activeStep >= 3 ? "bg-emerald-400" : "bg-slate-600"
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
          className={`w-full py-2.5 px-4 rounded-xl font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-[background-color,border-color,color,box-shadow,transform] duration-150 cursor-pointer shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#12151E] ${
            stagedItems.length === 0 || isDispatching
              ? "bg-[#1A1F2D] text-slate-500 border border-[#262E3E] cursor-not-allowed"
              : "bg-cyan-500 hover:bg-cyan-400 text-[#090C12] shadow-cyan-500/20 active:scale-[0.97]"
          }`}
        >
          {isDispatching ? (
            <>
              <RefreshCw aria-hidden="true" className="w-4 h-4 animate-spin text-cyan-400" />
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
