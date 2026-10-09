"use client";

import React, { useState, useRef } from "react";
import {
  Camera,
  Activity,
  AlertOctagon,
  CheckCircle2,
  RefreshCw,
  Cpu,
  Wifi,
  WifiOff,
  Code2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

export interface GStreamerInspectionResult {
  status: "CRITICAL STOP" | "GO";
  defect_type: "Defective Casting" | "OK" | string;
  confidence: number;
  root_cause: "Pending Full Analysis" | "Nominal" | string;
  summary: string;
  capture_source?: string;
  [key: string]: unknown;
}

export function Esp32Scanner() {
  const [streamUrl, setStreamUrl] = useState("http://172.10.3.17:81/stream");
  const [backendUrl] = useState("/api/inspect-gstreamer");
  const [isLoading, setIsLoading] = useState(false);
  const [streamError, setStreamError] = useState(false);
  const [result, setResult] = useState<GStreamerInspectionResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showJson, setShowJson] = useState(false);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [captureCount, setCaptureCount] = useState(0);
  const imgRef = useRef<HTMLImageElement>(null);

  const handleTriggerInspection = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    const t0 = performance.now();

    try {
      // Direct POST to backend endpoint with active ESP32 stream URL
      const response = await fetch(backendUrl, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ stream_url: streamUrl }),
      });

      const elapsed = Math.round(performance.now() - t0);
      setLatencyMs(elapsed);

      if (!response.ok) {
        let errDetail = `Server returned HTTP ${response.status}`;
        try {
          const errJson = await response.json();
          if (errJson?.detail) errDetail = errJson.detail;
          else if (errJson?.error) errDetail = errJson.error;
        } catch {
          // Non-JSON response
        }
        throw new Error(errDetail);
      }

      const data = (await response.json()) as GStreamerInspectionResult;
      setResult(data);
      setCaptureCount((prev) => prev + 1);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to execute GStreamer inspection";
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReloadStream = () => {
    setStreamError(false);
    if (imgRef.current) {
      // Force reconnect the MJPEG stream
      const current = streamUrl.split("?")[0];
      imgRef.current.src = `${current}?t=${Date.now()}`;
    }
  };

  const isCritical = result?.status === "CRITICAL STOP";
  const isGo = result?.status === "GO";

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 text-zinc-100 font-sans">
      {/* Camera Stream Viewport */}
      <div className="bg-[#10121a] rounded-2xl border border-zinc-800 overflow-hidden shadow-2xl">
        {/* Stream Top Toolbar */}
        <div className="px-5 py-3.5 bg-zinc-900/90 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-200">
              ESP32-CAM Feed:
            </span>
            <input
              type="text"
              value={streamUrl}
              onChange={(e) => setStreamUrl(e.target.value)}
              className="text-[11px] font-mono text-cyan-300 bg-zinc-950 px-2.5 py-1 rounded border border-zinc-700 w-64 focus:outline-none focus:border-indigo-500"
            />
            <div className="flex items-center gap-1 text-[10px] font-mono">
              <button
                type="button"
                onClick={() => setStreamUrl("http://172.10.3.17:81/stream")}
                className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-750 text-cyan-400 border border-zinc-700 transition cursor-pointer"
              >
                :81/stream
              </button>
              <button
                type="button"
                onClick={() => setStreamUrl("http://172.10.3.17/capture")}
                className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-750 text-emerald-400 border border-zinc-700 transition cursor-pointer"
              >
                /capture
              </button>
              <button
                type="button"
                onClick={() => setStreamUrl("http://172.10.3.17")}
                className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-750 text-indigo-400 border border-zinc-700 transition cursor-pointer"
              >
                172.10.3.17
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReloadStream}
              title="Refresh Stream Connection"
              className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-750 text-zinc-300 text-xs flex items-center gap-1.5 border border-zinc-700 transition cursor-pointer"
            >
              <RefreshCw className="w-3 h-3 text-zinc-400" />
              <span>Reconnect</span>
            </button>
            <span className="text-[11px] font-mono text-zinc-500">
              Captures: #{captureCount}
            </span>
          </div>
        </div>

        {/* Video Canvas Container */}
        <div className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden">
          {streamError ? (
            <div className="flex flex-col items-center justify-center gap-3 p-8 text-center text-zinc-400">
              <WifiOff className="w-10 h-10 text-amber-500" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-zinc-200">
                  ESP32 Stream Unavailable
                </p>
                <p className="text-xs text-zinc-500 max-w-sm">
                  Unable to connect to <code className="text-amber-400 font-mono">{streamUrl}</code>. Ensure the ESP32-CAM is powered and reachable on your Wi-Fi network.
                </p>
              </div>
              <button
                type="button"
                onClick={handleReloadStream}
                className="mt-2 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 border border-zinc-700 transition"
              >
                Retry Connection
              </button>
            </div>
          ) : (
            <>
              {/* Native MJPEG Stream <img> tag as requested */}
              <img
                ref={imgRef}
                src={streamUrl}
                alt="ESP32-CAM Live Inspection Feed"
                onError={() => setStreamError(true)}
                className="w-full h-full object-contain select-none"
              />

              {/* Industrial HUD Overlays */}
              <div className="absolute top-3 left-3 pointer-events-none flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-red-600/90 text-white font-mono text-[10px] font-extrabold tracking-widest uppercase flex items-center gap-1.5 shadow-md">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                  LIVE FEED
                </span>
                <span className="px-2 py-0.5 rounded bg-black/60 backdrop-blur text-zinc-300 font-mono text-[10px] border border-white/10">
                  720p · 25 FPS
                </span>
              </div>

              {/* Center Crosshair Aiming Reticle */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-48 h-48 border border-white/20 rounded-xl relative">
                  <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-amber-400"></div>
                  <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-amber-400"></div>
                  <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-amber-400"></div>
                  <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-amber-400"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="w-2 h-2 rounded-full bg-amber-400/60"></span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Trigger Bar */}
        <div className="p-4 bg-zinc-900 border-t border-zinc-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-zinc-200">
                Zero-Latency GStreamer Pipeline
              </p>
              <p className="text-[11px] text-zinc-500 font-mono truncate max-w-md">
                souphttpsrc &rarr; multipartdemux &rarr; appsink drop=true max-buffers=1
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleTriggerInspection}
            disabled={isLoading}
            className={`px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer ${
              isLoading
                ? "bg-zinc-800 text-zinc-400 border border-zinc-700 cursor-not-allowed"
                : "bg-gradient-to-r from-indigo-500 via-indigo-600 to-cyan-500 hover:from-indigo-400 hover:to-cyan-400 text-white shadow-indigo-500/25"
            }`}
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                <span>Pulling Zero-Latency Frame...</span>
              </>
            ) : (
              <>
                <Camera className="w-4 h-4" />
                <span>Trigger GStreamer Inspection</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error Callout */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/40 text-red-200 text-xs flex items-start gap-3 shadow-lg">
          <AlertOctagon className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-red-300">Inspection Request Failed</p>
            <p className="text-red-300/80 leading-relaxed">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Industrial Results Panel */}
      <div className="bg-[#10121a] rounded-2xl border border-zinc-800 p-6 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-2.5">
            <Activity className="w-4 h-4 text-indigo-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-200">
              One-Shot Inspection Output
            </h2>
          </div>
          {latencyMs !== null && (
            <span className="text-[11px] font-mono text-zinc-400 bg-zinc-900 px-2.5 py-1 rounded-md border border-zinc-800">
              Latency: <strong className="text-indigo-400">{latencyMs} ms</strong>
            </span>
          )}
        </div>

        {result ? (
          <div className="space-y-6">
            {/* Massive Status Verdict Banner */}
            <div
              className={`p-5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all duration-300 ${
                isCritical
                  ? "bg-red-950/40 border-red-500/60 text-red-100 shadow-lg shadow-red-950/40"
                  : isGo
                  ? "bg-emerald-950/40 border-emerald-500/60 text-emerald-100 shadow-lg shadow-emerald-950/40"
                  : "bg-zinc-900 border-zinc-700 text-zinc-100"
              }`}
            >
              <div className="flex items-center gap-3.5">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${
                    isCritical
                      ? "bg-red-500/20 border-red-500 text-red-400 animate-pulse"
                      : isGo
                      ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                      : "bg-zinc-800 border-zinc-700 text-zinc-400"
                  }`}
                >
                  {isCritical ? (
                    <AlertOctagon className="w-7 h-7" />
                  ) : (
                    <CheckCircle2 className="w-7 h-7" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-black tracking-tight font-mono">
                      {result.status}
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                        isCritical
                          ? "bg-red-500/20 text-red-300 border-red-500/40"
                          : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                      }`}
                    >
                      {isCritical ? "LINE HALTED" : "LINE CLEAR"}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Binary ResNet-18 Classifier Gate Evaluation
                  </p>
                </div>
              </div>

              <div className="text-right sm:self-center font-mono">
                <div className="text-[10px] uppercase font-semibold text-zinc-400">
                  Model Confidence
                </div>
                <div
                  className={`text-2xl font-extrabold ${
                    isCritical ? "text-red-400" : "text-emerald-400"
                  }`}
                >
                  {result.confidence}%
                </div>
              </div>
            </div>

            {/* Industrial Data Readout Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  Defect Category
                </span>
                <p
                  className={`text-sm font-bold font-mono ${
                    isCritical ? "text-red-400" : "text-emerald-400"
                  }`}
                >
                  {result.defect_type}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  Attributed Root Cause
                </span>
                <p className="text-sm font-semibold text-zinc-200">
                  {result.root_cause}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  Zero-Latency Ingestion
                </span>
                <p className="text-sm font-mono text-cyan-400">
                  {result.capture_source || "GStreamer appsink"}
                </p>
              </div>
            </div>

            {/* Finding Summary Callout */}
            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                <span>Executive Finding Summary</span>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed italic">
                &ldquo;{result.summary}&rdquo;
              </p>
            </div>

            {/* Raw JSON Inspector Accordion */}
            <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/40">
              <button
                type="button"
                onClick={() => setShowJson(!showJson)}
                className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-mono font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 transition cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Code2 className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Payload Response JSON</span>
                </span>
                {showJson ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showJson && (
                <div className="p-4 bg-black/60 border-t border-zinc-800 font-mono text-xs text-emerald-400 overflow-x-auto">
                  <pre>{JSON.stringify(result, null, 2)}</pre>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-12 text-center border-2 border-dashed border-zinc-800/80 rounded-xl text-zinc-500 text-xs space-y-2">
            <Camera className="w-8 h-8 text-zinc-600 mx-auto" />
            <p className="font-semibold text-zinc-400">
              Awaiting GStreamer One-Shot Trigger
            </p>
            <p className="text-zinc-600 max-w-sm mx-auto">
              Click the button above to capture a zero-latency frame from the live ESP32-CAM stream and execute the ResNet-18 binary model.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Esp32Scanner;
