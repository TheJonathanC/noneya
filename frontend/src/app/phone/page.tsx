import React from "react";
import { PhoneScanner } from "@/components/PhoneScanner";

export const metadata = {
  title: "Handheld Phone Camera Inspection | Qastra",
  description: "One-shot industrial defect inspection using mobile phone camera and PyTorch binary classifier.",
};

export default function PhoneCameraPage() {
  return (
    <div className="min-h-screen bg-[#08090d] text-zinc-100 py-10 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-mono flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse"></span>
            Handheld Mobile Phone Camera Inspection
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Real-time quality gate classification with PyTorch ResNet-18 directly from your smartphone camera or mobile browser.
          </p>
        </div>

        {/* Embedded Phone Scanner Component */}
        <PhoneScanner />
      </div>
    </div>
  );
}
