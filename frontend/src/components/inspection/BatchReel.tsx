"use client";

import React, { useRef, useState, DragEvent, ChangeEvent } from "react";
import Image from "next/image";
import {
  Upload,
  FileImage,
  ChevronRight,
  Keyboard,
  Layers,
  RefreshCw,
  Trash2,
  X,
  RotateCcw,
} from "lucide-react";
import { InspectionItem } from "@/lib/inspection-adapter";
import { Badge } from "@/components/ui/badge";

interface BatchReelProps {
  items: InspectionItem[];
  selectedItem: InspectionItem | null;
  onSelectItem: (item: InspectionItem) => void;
  onUploadFiles: (files: File[]) => void;
  onRemoveItem: (id: string) => void;
  onClearQueue: () => void;
  onResetQueue: () => void;
  isLoading: boolean;
}

export function BatchReel({
  items,
  selectedItem,
  onSelectItem,
  onUploadFiles,
  onRemoveItem,
  onClearQueue,
  onResetQueue,
  isLoading,
}: BatchReelProps) {
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
        onUploadFiles(fileList);
      }
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const fileList = Array.from(e.target.files).filter((f) =>
        f.type.startsWith("image/")
      );
      if (fileList.length > 0) {
        onUploadFiles(fileList);
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0E1017] border-r border-[#1F2430]">
      {/* Intake Dropzone */}
      <div className="p-4 border-b border-[#1F2430] bg-[#12141C]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-xs font-mono font-semibold uppercase text-slate-300">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>Component Intake Zone</span>
          </div>
          <span className="text-[10px] font-mono text-slate-500">OPTICAL INTAKE</span>
        </div>

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border border-dashed rounded-lg p-3 text-center cursor-pointer transition-all duration-150 flex flex-col items-center justify-center gap-1.5 ${
            isDragging
              ? "border-cyan-400 bg-cyan-950/30 scale-[1.01]"
              : "border-[#262D3D] hover:border-cyan-500/50 bg-[#161922] hover:bg-[#1A1E29]"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileInputChange}
            className="hidden"
          />
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-mono font-medium text-slate-200">
              Upload component capture or <span className="text-cyan-400 underline">browse</span>
            </span>
          </div>
          <p className="text-[10px] font-mono text-slate-500">
            Accepts optical sensor feeds (PNG, JPG, TIFF)
          </p>
        </div>
      </div>

      {/* Queue Header & Clear Controls */}
      <div className="px-4 py-2.5 bg-[#0C0E14] border-b border-[#1A1E29] flex items-center justify-between text-xs font-mono text-slate-400">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-200 uppercase tracking-wider text-[11px]">
            Part Inspection Queue ({items.length})
          </span>
          {isLoading && <RefreshCw className="w-3 h-3 text-cyan-400 animate-spin" />}
        </div>

        <div className="flex items-center gap-2">
          {items.length > 0 ? (
            <button
              onClick={onClearQueue}
              type="button"
              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-rose-400 transition-colors px-2 py-0.5 rounded border border-[#242A3B] bg-[#141722] hover:border-rose-900/60 cursor-pointer"
              title="Clear all components from the inspection queue"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear Queue</span>
            </button>
          ) : (
            <button
              onClick={onResetQueue}
              type="button"
              className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors px-2 py-0.5 rounded border border-cyan-800/40 bg-cyan-950/20 cursor-pointer"
              title="Restore default sample lot"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Restore Lot</span>
            </button>
          )}
        </div>
      </div>

      {/* Keyboard Hint Ribbon */}
      <div className="px-4 py-1.5 bg-[#0A0C10] border-b border-[#181C26] flex items-center justify-between text-[10px] font-mono text-slate-500">
        <div className="flex items-center gap-1.5">
          <Keyboard className="w-3 h-3 text-slate-500" />
          <span>[↑] [↓] / [←] [→] to scrub</span>
        </div>
        <span>Hover part to remove [×]</span>
      </div>

      {/* Queue Items Scrollable List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {items.map((item, index) => {
          const isSelected = selectedItem?.id === item.id;
          const isDefective = item.status === "DEFECTIVE";

          return (
            <div
              key={item.id}
              onClick={() => onSelectItem(item)}
              className={`group relative rounded-lg border p-2.5 transition-all duration-150 cursor-pointer select-none font-mono ${
                isSelected
                  ? "bg-[#181C26] border-cyan-500/70 shadow-lg shadow-cyan-950/20"
                  : "bg-[#12141C] border-[#1F2430] hover:border-[#2D3547] hover:bg-[#161924]"
              }`}
            >
              {/* Selected Left Indicator Strip */}
              {isSelected && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-cyan-400 rounded-l-lg" />
              )}

              <div className="flex items-center gap-2.5">
                {/* Index Number */}
                <div className="text-[10px] font-bold text-slate-500 w-4 text-right shrink-0">
                  {String(index + 1).padStart(2, "0")}
                </div>

                {/* Thumbnail Preview */}
                <div className="relative w-13 h-10 rounded border border-[#232838] bg-[#0A0C10] overflow-hidden shrink-0 flex items-center justify-center">
                  <Image
                    src={item.rawImageUrl}
                    alt={item.partId}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                  {isDefective && (
                    <div className="absolute inset-0 bg-rose-500/15 pointer-events-none" />
                  )}
                </div>

                {/* Part Meta & Status */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-xs font-bold text-slate-100 truncate">
                      {item.partId}
                    </span>
                    <Badge
                      variant={isDefective ? "defective" : "nominal"}
                      size="sm"
                      dot
                    >
                      {item.status}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="truncate">
                      {isDefective ? (
                        <span className="text-rose-400 font-semibold">{item.defectType}</span>
                      ) : (
                        <span className="text-emerald-400">Nominal Spec</span>
                      )}
                    </span>
                    <span className="text-slate-500 font-medium">
                      {item.confidenceScore.toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Actions: Remove Button & Selection Arrow */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveItem(item.id);
                    }}
                    type="button"
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded transition-all cursor-pointer"
                    title={`Remove ${item.partId} from queue`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>

                  <ChevronRight
                    className={`w-4 h-4 transition-transform ${
                      isSelected ? "text-cyan-400 translate-x-0.5" : "text-slate-600 group-hover:text-slate-400"
                    }`}
                  />
                </div>
              </div>
            </div>
          );
        })}

        {items.length === 0 && (
          <div className="p-8 text-center text-slate-500 font-mono text-xs flex flex-col items-center justify-center gap-3 border border-dashed border-[#1F2430] rounded-xl bg-[#0B0D12]">
            <FileImage className="w-8 h-8 text-slate-600" />
            <div className="space-y-1">
              <span className="text-slate-300 font-semibold block">Inspection Queue Empty</span>
              <span className="text-[11px] text-slate-500 block">
                Drop captures above or restore the calibrated sample lot.
              </span>
            </div>
            <button
              onClick={onResetQueue}
              type="button"
              className="mt-1 px-3 py-1.5 rounded-lg border border-cyan-500/40 bg-cyan-950/30 text-cyan-300 hover:bg-cyan-950/50 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restore Sample Lot (5 Parts)</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
