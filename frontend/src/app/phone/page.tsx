import React from "react";
import { PhoneScanner } from "@/components/PhoneScanner";
import { LinenHeader } from "@/components/linen/LinenHeader";

export const metadata = {
  title: "Live Camera Inspection | Qastra",
  description: "One-shot industrial defect inspection using mobile phone camera, USB video feed, and PyTorch binary classifier.",
};

export default function PhoneCameraPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F5] text-[#1C1917]">
      <LinenHeader />
      <div className="flex-1 max-w-5xl w-full mx-auto py-8 px-4 sm:px-6 space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1C1917] font-mono flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Camera Inspection Gate
          </h1>
          <p className="text-xs text-[#78716A] mt-1">
            Real-time quality gate classification with PyTorch binary classifier directly from USB UVC video, smartphone camera, or network stream.
          </p>
        </div>

        {/* Embedded Phone Scanner Component */}
        <PhoneScanner />
      </div>
    </div>
  );
}
