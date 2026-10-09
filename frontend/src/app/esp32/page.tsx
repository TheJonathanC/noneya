import React from "react";
import { Esp32Scanner } from "@/components/Esp32Scanner";

export const metadata = {
  title: "ESP32-CAM GStreamer Inspection | Qastra",
  description: "One-shot live camera inspection using zero-latency GStreamer pipeline and PyTorch binary classifier.",
};

export default function Esp32Page() {
  return (
    <div className="min-h-screen bg-[#08090d] text-zinc-100 py-10 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-mono flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse"></span>
            ESP32-CAM One-Shot Industrial Inspection
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Zero-latency frame capture via GStreamer (<code className="text-indigo-400">cv2.CAP_GSTREAMER</code>) with PyTorch ResNet-18 binary defect evaluation.
          </p>
        </div>

        {/* Embedded Scanner Component */}
        <Esp32Scanner />
      </div>
    </div>
  );
}
