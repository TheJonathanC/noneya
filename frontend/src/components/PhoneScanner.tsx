"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Camera,
  Smartphone,
  Activity,
  AlertOctagon,
  CheckCircle2,
  RefreshCw,
  Cpu,
  Wifi,
  Copy,
  Check,
  Code2,
  ChevronDown,
  ChevronUp,
  FileImage,
  Upload,
  Cable,
  HelpCircle,
  Timer,
} from "lucide-react";

export interface PhoneInspectionResult {
  status: "CRITICAL STOP" | "GO";
  defect_type: "Defective Casting" | "OK" | string;
  confidence: number;
  root_cause: "Pending Full Analysis" | "Nominal" | string;
  summary: string;
  capture_source?: string;
  dimensions?: { width: number; height: number };
  latency_ms?: number;
  timestamp?: string;
  [key: string]: unknown;
}

export function PhoneScanner() {
  // Tabs: Default to USB feed since user requested USB phone video feed
  const [activeTab, setActiveTab] = useState<"usb" | "wireless" | "ip_stream">("usb");
  const [usbSourceType, setUsbSourceType] = useState<"direct_stream" | "webrtc">("direct_stream");
  const [streamKey, setStreamKey] = useState(0);
  const [streamHasError, setStreamHasError] = useState(false);
  const [backendCameraStatus, setBackendCameraStatus] = useState<{
    is_running?: boolean;
    is_connected?: boolean;
    device_index?: number;
    resolution?: { width: number; height: number };
  } | null>(null);

  const backendUrl = "/api/inspect-phone";
  
  const [ipStreamUrl, setIpStreamUrl] = useState("http://172.10.3.17:81/stream");

  // Device Enumeration for WebRTC fallback
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [isUsbVideoActive, setIsUsbVideoActive] = useState(false);
  const [usbVideoError, setUsbVideoError] = useState<string | null>(null);
  const [videoResolution, setVideoResolution] = useState<{ width: number; height: number } | null>(null);

  // Auto-inspect continuous mode
  const [autoInspect, setAutoInspect] = useState(false);
  const autoInspectTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Dynamic host detection for mobile pairing
  const [mobileUrl] = useState(() => {
    if (typeof window !== "undefined") {
      const hostname = window.location.hostname;
      const port = window.location.port ? `:${window.location.port}` : "";
      if (hostname !== "localhost" && hostname !== "127.0.0.1") {
        return `${window.location.protocol}//${hostname}${port}/phone`;
      }
    }
    return "http://172.10.3.17:3000/phone";
  });

  const [copiedUrl, setCopiedUrl] = useState(false);
  const [showUsbGuide, setShowUsbGuide] = useState(true);

  // Inspection states
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<PhoneInspectionResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showJson, setShowJson] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [captureCount, setCaptureCount] = useState(0);

  // Media refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // File input refs for wireless mode
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Enumerate Connected Video Devices (e.g., USB phone cameras, DroidCam, UVC)
  const refreshDevices = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((d) => d.kind === "videoinput");
      setVideoDevices(videoInputs);

      // Auto-select USB or external phone camera if available
      if (videoInputs.length > 0) {
        const usbCandidate = videoInputs.find(
          (d) =>
            d.label.toLowerCase().includes("usb") ||
            d.label.toLowerCase().includes("droidcam") ||
            d.label.toLowerCase().includes("iriun") ||
            d.label.toLowerCase().includes("android") ||
            d.label.toLowerCase().includes("camo")
        );
        setSelectedDeviceId((prev) => (prev ? prev : usbCandidate ? usbCandidate.deviceId : videoInputs[0].deviceId));
      }
    } catch (err) {
      console.error("Device enumeration error:", err);
    }
  }, []);

  // Stop video stream
  const stopVideoStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsUsbVideoActive(false);
  }, []);

  // Start USB camera stream
  const startUsbCamera = useCallback(
    async (deviceId?: string) => {
      setUsbVideoError(null);
      stopVideoStream();

      try {
        if (!navigator?.mediaDevices?.getUserMedia) {
          throw new Error("Camera API is unavailable. Access via http://localhost:3000/phone or HTTPS.");
        }

        const constraints: MediaStreamConstraints = {
          video: deviceId
            ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
            : { width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();

          // Read real resolution once loaded
          videoRef.current.onloadedmetadata = () => {
            if (videoRef.current) {
              setVideoResolution({
                width: videoRef.current.videoWidth,
                height: videoRef.current.videoHeight,
              });
            }
          };
        }

        setIsUsbVideoActive(true);
        // Refresh device labels now that permission has been granted
        await refreshDevices();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to open USB camera stream.";
        setUsbVideoError(msg);
        setIsUsbVideoActive(false);
      }
    },
    [stopVideoStream, refreshDevices]
  );

  // Auto-detect connected USB camera devices safely
  useEffect(() => {
    const timer = setTimeout(() => {
      refreshDevices();
    }, 50);
    const handleDeviceChange = () => {
      refreshDevices();
    };
    if (typeof navigator !== "undefined" && navigator.mediaDevices) {
      navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);
    }
    return () => {
      clearTimeout(timer);
      if (typeof navigator !== "undefined" && navigator.mediaDevices) {
        navigator.mediaDevices.removeEventListener("devicechange", handleDeviceChange);
      }
      stopVideoStream();
    };
  }, [refreshDevices, stopVideoStream]);

  const handleCopyMobileUrl = () => {
    navigator.clipboard.writeText(mobileUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  // Generic inspection submitter
  const submitInspection = useCallback(
    async (bodyPayload: FormData | string, isFormData: boolean) => {
      setIsLoading(true);
      setErrorMsg(null);

      try {
        const headers: Record<string, string> = {
          Accept: "application/json",
        };
        if (!isFormData) {
          headers["Content-Type"] = "application/json";
        }

        const response = await fetch(backendUrl, {
          method: "POST",
          headers,
          body: bodyPayload,
        });

        if (!response.ok) {
          let errDetail = `Server responded with HTTP ${response.status}`;
          try {
            const errJson = await response.json();
            if (errJson?.detail) errDetail = errJson.detail;
            else if (errJson?.error) errDetail = errJson.error;
          } catch {
            // ignore
          }
          throw new Error(errDetail);
        }

        const data = (await response.json()) as PhoneInspectionResult;
        setResult(data);
        if (data.preview_image_base64 && typeof data.preview_image_base64 === "string") {
          setPreviewImage(data.preview_image_base64);
        }
        setCaptureCount((prev) => prev + 1);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Inspection request failed.";
        setErrorMsg(msg);
      } finally {
        setIsLoading(false);
      }
    },
    [backendUrl]
  );

  // 1. Capture Current Frame from USB Video Element
  const handleCaptureUsbFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    setPreviewImage(dataUrl);

    const payload = JSON.stringify({ image_base64: dataUrl });
    submitInspection(payload, false);
  }, [submitInspection]);

  // 2. Direct DroidCam Stream Actions
  const handleReloadStream = useCallback(() => {
    setStreamHasError(false);
    setStreamKey((prev) => prev + 1);
  }, []);

  const handleInspectLiveStreamFrame = useCallback(() => {
    submitInspection(JSON.stringify({ source: "usb", device_index: 0 }), false);
  }, [submitInspection]);

  // Periodic status poller for backend camera state
  useEffect(() => {
    let isMounted = true;
    const fetchCameraStatus = async () => {
      try {
        const res = await fetch("/api/camera-status", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setBackendCameraStatus(data);
            if (data.is_connected && streamHasError) {
              setStreamHasError(false);
            }
          }
        }
      } catch {
        // silent
      }
    };
    fetchCameraStatus();
    const interval = setInterval(fetchCameraStatus, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [streamHasError]);

  // Continuous auto-inspection timer (works for both direct DroidCam stream and WebRTC)
  useEffect(() => {
    if (autoInspect && activeTab === "usb") {
      autoInspectTimerRef.current = setInterval(() => {
        if (usbSourceType === "direct_stream") {
          handleInspectLiveStreamFrame();
        } else if (isUsbVideoActive) {
          handleCaptureUsbFrame();
        }
      }, 3000);
    } else {
      if (autoInspectTimerRef.current) {
        clearInterval(autoInspectTimerRef.current);
        autoInspectTimerRef.current = null;
      }
    }
    return () => {
      if (autoInspectTimerRef.current) {
        clearInterval(autoInspectTimerRef.current);
        autoInspectTimerRef.current = null;
      }
    };
  }, [autoInspect, activeTab, usbSourceType, isUsbVideoActive, handleInspectLiveStreamFrame, handleCaptureUsbFrame]);

  // 3. Wireless File Upload
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setPreviewImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);

    const formData = new FormData();
    formData.append("file", file);
    submitInspection(formData, true);
    e.target.value = "";
  };

  // 4. Sample test
  const handleTestSampleCasting = () => {
    submitInspection(JSON.stringify({}), false);
  };

  const isCritical = result?.status === "CRITICAL STOP";
  const isGo = result?.status === "GO";

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
    mobileUrl
  )}&color=6366f1&bgcolor=0e1017`;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 text-zinc-100 font-sans">
      {/* Hidden canvas for video snapshots */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Hidden Native File Input with capture="environment" */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Hidden File Input for gallery upload */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Top Banner: USB Phone Inspection Status */}
      <div className="bg-[#12141f] rounded-2xl border border-zinc-800/80 p-5 shadow-xl">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-600 via-indigo-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 shrink-0">
              <Cable className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold tracking-tight text-white">
                  Tethered USB Phone Camera Station
                </h2>
                <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Low-Latency USB Feed
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1 max-w-xl leading-relaxed">
                Connect your smartphone via USB cable for high-frame-rate, zero-lag live video defect classification. Supports Android 14 USB Webcam, DroidCam USB, and UVC.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full lg:w-auto">
            <button
              type="button"
              onClick={() => setShowUsbGuide(!showUsbGuide)}
              className="px-3 py-2 rounded-xl bg-zinc-850 hover:bg-zinc-800 border border-zinc-750 text-xs font-medium text-zinc-300 hover:text-white transition flex items-center gap-1.5 cursor-pointer"
            >
              <HelpCircle className="w-4 h-4 text-indigo-400" />
              <span>{showUsbGuide ? "Hide USB Setup" : "USB Setup Guide"}</span>
            </button>

            <button
              type="button"
              onClick={handleTestSampleCasting}
              className="px-3.5 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <FileImage className="w-3.5 h-3.5 text-cyan-400" />
              <span>Test Sample Part</span>
            </button>
          </div>
        </div>

        {/* USB Setup Helper Drawer */}
        {showUsbGuide && (
          <div className="mt-4 pt-4 border-t border-zinc-800/80 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-[#0a0b12] border border-zinc-850 space-y-1">
              <span className="font-bold text-white flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] font-mono">1</span>
                Android 14+ Native USB
              </span>
              <p className="text-zinc-400 text-[11px] leading-relaxed">
                Plug phone into PC via USB &rarr; Tap USB notification &rarr; Select <strong>&quot;Webcam&quot;</strong>. Select it in the camera dropdown below!
              </p>
            </div>

            <div className="p-3 rounded-xl bg-[#0a0b12] border border-zinc-850 space-y-1">
              <span className="font-bold text-white flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[10px] font-mono">2</span>
                DroidCam / Iriun USB
              </span>
              <p className="text-zinc-400 text-[11px] leading-relaxed">
                Install DroidCam or Iriun on phone & PC. Plug in USB cable &rarr; Start app. Windows auto-creates a high-res video device!
              </p>
            </div>

            <div className="p-3 rounded-xl bg-[#0a0b12] border border-zinc-850 space-y-1">
              <span className="font-bold text-white flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-[10px] font-mono">3</span>
                iPhone Continuity / Camo
              </span>
              <p className="text-zinc-400 text-[11px] leading-relaxed">
                Plug iPhone into PC via Lightning/USB-C &rarr; launch Camo or DroidCam &rarr; stream full 1080p optical video.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Main Viewport Container */}
      <div className="bg-[#10121a] rounded-2xl border border-zinc-800 overflow-hidden shadow-2xl">
        {/* Mode Selector Tabs */}
        <div className="px-5 py-3 bg-zinc-900/90 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 p-1 bg-zinc-950 rounded-xl border border-zinc-850">
            <button
              type="button"
              onClick={() => {
                setActiveTab("usb");
                if (!isUsbVideoActive && usbSubMode === "uvc") {
                  startUsbCamera(selectedDeviceId);
                }
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === "usb"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Cable className="w-3.5 h-3.5 text-emerald-400" />
              <span>USB Video Feed</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                RECOMMENDED
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("wireless");
                stopVideoStream();
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === "wireless"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Wi-Fi / QR Mobile Shutter</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("ip_stream");
                stopVideoStream();
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === "ip_stream"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Wifi className="w-3.5 h-3.5" />
              <span>Network IP Stream</span>
            </button>
          </div>

          {/* USB Camera Device Selector (Shown when in USB tab) */}
          {activeTab === "usb" && (
            <div className="flex items-center gap-2">
              {usbSourceType === "direct_stream" ? (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Direct DroidCam Stream
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setUsbSourceType("webrtc");
                      startUsbCamera(selectedDeviceId);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-750 text-zinc-300 hover:text-white text-xs transition border border-zinc-700 cursor-pointer"
                  >
                    Use WebRTC
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <select
                    value={selectedDeviceId}
                    onChange={(e) => {
                      setSelectedDeviceId(e.target.value);
                      startUsbCamera(e.target.value);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-700 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500 max-w-xs font-mono"
                  >
                    {videoDevices.length === 0 ? (
                      <option value="">Detecting USB cameras...</option>
                    ) : (
                      videoDevices.map((dev, idx) => (
                        <option key={dev.deviceId || idx} value={dev.deviceId}>
                          {dev.label || `Camera ${idx + 1}`}
                        </option>
                      ))
                    )}
                  </select>

                  <button
                    type="button"
                    onClick={refreshDevices}
                    className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-750 text-zinc-300 hover:text-white border border-zinc-700 transition"
                    title="Refresh camera devices"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      stopVideoStream();
                      setUsbSourceType("direct_stream");
                    }}
                    className="px-2.5 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 text-xs transition cursor-pointer font-medium"
                  >
                    Back to DroidCam Feed
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-zinc-500">
              Scans: #{captureCount}
            </span>
          </div>
        </div>

        {/* Viewport Screen */}
        <div className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden">
          {/* TAB 1: USB Phone Feed */}
          {activeTab === "usb" && (
            <div className="relative w-full h-full flex items-center justify-center">
              {usbSourceType === "direct_stream" ? (
                <div className="relative w-full h-full flex items-center justify-center bg-black">
                  {streamHasError ? (
                    <div className="p-6 text-center max-w-lg space-y-4 bg-zinc-950/90 rounded-2xl border border-amber-500/30 m-4 shadow-2xl">
                      <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/40">
                        <AlertOctagon className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                          DroidCam Video Stream Not Connected
                        </h3>
                        <p className="text-xs text-amber-300 font-mono">
                          FastAPI is waiting for frames from DirectShow device 0
                        </p>
                      </div>

                      <div className="text-left bg-[#0c0e17] p-3.5 rounded-xl border border-zinc-800 space-y-2 text-xs">
                        <span className="font-bold text-zinc-200 block">
                          Quick DroidCam Checklist:
                        </span>
                        <ol className="list-decimal list-inside space-y-1 text-zinc-400 text-[11px] leading-relaxed">
                          <li>Open the <strong>DroidCam</strong> app on your smartphone.</li>
                          <li>Open the <strong>DroidCam client</strong> on your PC (connected via USB or WiFi).</li>
                          <li>Click <strong>&quot;Start&quot;</strong> in the PC client to begin streaming.</li>
                        </ol>
                      </div>

                      <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleReloadStream}
                          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-lg shadow-indigo-600/30 cursor-pointer flex items-center gap-1.5"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Retry Stream</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleInspectLiveStreamFrame}
                          disabled={isLoading}
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition shadow-lg shadow-emerald-600/30 cursor-pointer flex items-center gap-1.5"
                        >
                          <Cable className="w-3.5 h-3.5" />
                          <span>Test Frame Capture</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Live DroidCam MJPEG Video Stream */}
                      <img
                        key={streamKey}
                        src={`/api/camera-stream?device_index=0&t=${streamKey}`}
                        alt="Live DroidCam Industrial Feed"
                        className="max-h-full max-w-full object-contain"
                        onLoad={() => {
                          setStreamHasError(false);
                        }}
                        onError={() => {
                          setStreamHasError(true);
                        }}
                      />

                      {/* Aiming Reticle Overlay */}
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        <div className="w-56 h-56 border border-white/20 rounded-xl relative">
                          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-emerald-400"></div>
                          <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-emerald-400"></div>
                          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-emerald-400"></div>
                          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-emerald-400"></div>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
                          </div>
                        </div>
                      </div>

                      {/* Live Feed Status HUD */}
                      <div className="absolute top-3 left-3 pointer-events-none flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded bg-emerald-600/90 text-white font-mono text-[10px] font-extrabold tracking-widest uppercase flex items-center gap-1.5 shadow-md">
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                          DROIDCAM FEED ACTIVE
                        </span>
                        {backendCameraStatus?.resolution && backendCameraStatus.resolution.width > 0 && (
                          <span className="px-2 py-0.5 rounded bg-black/60 backdrop-blur text-zinc-300 font-mono text-[10px] border border-white/10">
                            {backendCameraStatus.resolution.width} &times; {backendCameraStatus.resolution.height} &bull; 30 FPS
                          </span>
                        )}
                      </div>

                      {/* Controls Top Right */}
                      <div className="absolute top-3 right-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleReloadStream}
                          className="px-2.5 py-1 rounded-lg bg-black/60 hover:bg-black/80 backdrop-blur border border-white/10 text-xs font-mono text-zinc-300 hover:text-white transition cursor-pointer flex items-center gap-1"
                          title="Reload video stream"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Reload</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                /* WebRTC Fallback Mode */
                <>
                  {usbVideoError ? (
                    <div className="p-6 text-center max-w-lg space-y-4 bg-zinc-950/80 rounded-2xl border border-amber-500/30 m-4 shadow-2xl">
                      <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/40">
                        <AlertOctagon className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                          Browser WebRTC Access Blocked
                        </h3>
                        <p className="text-xs text-amber-300 font-mono">
                          {usbVideoError}
                        </p>
                      </div>

                      <div className="text-left bg-[#0c0e17] p-3.5 rounded-xl border border-zinc-800 space-y-2 text-xs">
                        <span className="font-bold text-zinc-200 block">
                          Tip: Use Native DroidCam Feed Instead
                        </span>
                        <p className="text-zinc-400 text-[11px] leading-relaxed">
                          The direct DroidCam feed reads directly through FastAPI without needing any browser webcam permissions!
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            stopVideoStream();
                            setUsbSourceType("direct_stream");
                          }}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-lg shadow-emerald-600/30 cursor-pointer"
                        >
                          Switch to Direct DroidCam Feed
                        </button>
                        <button
                          type="button"
                          onClick={() => startUsbCamera(selectedDeviceId)}
                          className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-zinc-300 text-xs font-medium border border-zinc-750 transition cursor-pointer"
                        >
                          Retry WebRTC
                        </button>
                      </div>
                    </div>
                  ) : isUsbVideoActive ? (
                    <>
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-contain"
                      />

                      {/* Aiming Reticle Overlay */}
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        <div className="w-56 h-56 border border-white/20 rounded-xl relative">
                          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-emerald-400"></div>
                          <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-emerald-400"></div>
                          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-emerald-400"></div>
                          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-emerald-400"></div>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
                          </div>
                        </div>
                      </div>

                      {/* Live Feed Status HUD */}
                      <div className="absolute top-3 left-3 pointer-events-none flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-emerald-600/90 text-white font-mono text-[10px] font-extrabold tracking-widest uppercase flex items-center gap-1.5 shadow-md">
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                          WEBRTC FEED ACTIVE
                        </span>
                        {videoResolution && (
                          <span className="px-2 py-0.5 rounded bg-black/60 backdrop-blur text-zinc-300 font-mono text-[10px] border border-white/10">
                            {videoResolution.width} &times; {videoResolution.height} &bull; 30 FPS
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="max-w-md text-center space-y-4 p-6">
                      <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
                        <Cable className="w-8 h-8" />
                      </div>
                      <div className="space-y-1.5">
                        <h3 className="text-base font-bold text-white">
                          Browser WebRTC Camera
                        </h3>
                        <p className="text-xs text-zinc-400 leading-relaxed">
                          Requesting browser webcam access for connected USB cameras.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => startUsbCamera(selectedDeviceId)}
                          className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 via-indigo-600 to-indigo-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 hover:scale-105 transition cursor-pointer"
                        >
                          Start WebRTC Camera
                        </button>
                        <button
                          type="button"
                          onClick={() => setUsbSourceType("direct_stream")}
                          className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-zinc-300 text-xs font-semibold border border-zinc-700 transition cursor-pointer"
                        >
                          Use Direct DroidCam Feed
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* TAB 2: Wireless Mobile Shutter Mode */}
          {activeTab === "wireless" && (
            <div className="relative w-full h-full flex flex-col items-center justify-center p-6 text-center">
              {previewImage ? (
                <div className="relative w-full h-full flex items-center justify-center">
                  <img
                    src={previewImage}
                    alt="Captured Phone Frame"
                    className="max-h-full max-w-full object-contain rounded-lg"
                  />
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
                </div>
              ) : (
                <div className="max-w-md space-y-4">
                  <div className="w-24 h-24 rounded-xl overflow-hidden bg-[#0e1017] border border-indigo-500/30 p-1 mx-auto flex items-center justify-center shadow-lg">
                    <img
                      src={qrImageUrl}
                      alt="Scan to open on phone"
                      className="w-full h-full object-contain rounded"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-base font-bold text-white">
                      Wireless Mobile Camera Mode
                    </h3>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Scan the QR code with your phone camera or visit:
                    </p>
                    <div className="flex items-center justify-center gap-2 pt-1">
                      <span className="text-xs font-mono font-bold text-indigo-300 bg-zinc-900 px-3 py-1 rounded-lg border border-zinc-800">
                        {mobileUrl}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyMobileUrl}
                        className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition cursor-pointer"
                        title="Copy mobile link"
                      >
                        {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="absolute top-3 left-3 pointer-events-none flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-indigo-600/90 text-white font-mono text-[10px] font-extrabold tracking-widest uppercase flex items-center gap-1.5 shadow-md">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                  WIRELESS MOBILE SHUTTER
                </span>
              </div>
            </div>
          )}

          {/* TAB 3: IP Stream Mode */}
          {activeTab === "ip_stream" && (
            <div className="relative w-full h-full flex flex-col items-center justify-center p-6 text-center">
              <div className="max-w-lg w-full space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center mx-auto shadow-inner">
                  <Wifi className="w-7 h-7" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-base font-bold text-white">
                    ESP32-CAM & Network IP Stream URL
                  </h3>
                  <input
                    type="text"
                    value={ipStreamUrl}
                    onChange={(e) => setIpStreamUrl(e.target.value)}
                    placeholder="http://172.10.3.17:81/stream or /capture"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
                  <span className="text-[10px] uppercase font-mono text-zinc-500 w-full mb-1">
                    ESP32-CAM Presets:
                  </span>
                  <button
                    type="button"
                    onClick={() => setIpStreamUrl("http://172.10.3.17:81/stream")}
                    className="px-2.5 py-1 rounded-lg bg-zinc-850 hover:bg-zinc-800 border border-zinc-750 text-[11px] font-mono text-cyan-300 transition cursor-pointer"
                  >
                    :81/stream
                  </button>
                  <button
                    type="button"
                    onClick={() => setIpStreamUrl("http://172.10.3.17/capture")}
                    className="px-2.5 py-1 rounded-lg bg-zinc-850 hover:bg-zinc-800 border border-zinc-750 text-[11px] font-mono text-emerald-300 transition cursor-pointer"
                  >
                    /capture
                  </button>
                  <button
                    type="button"
                    onClick={() => setIpStreamUrl("http://172.10.3.17")}
                    className="px-2.5 py-1 rounded-lg bg-zinc-850 hover:bg-zinc-800 border border-zinc-750 text-[11px] font-mono text-indigo-300 transition cursor-pointer"
                  >
                    Base IP (172.10.3.17)
                  </button>
                  <button
                    type="button"
                    onClick={() => setIpStreamUrl("http://172.10.3.17:8080/shot.jpg")}
                    className="px-2.5 py-1 rounded-lg bg-zinc-850 hover:bg-zinc-800 border border-zinc-750 text-[11px] font-mono text-amber-300 transition cursor-pointer"
                  >
                    :8080/shot.jpg
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Trigger Bar */}
        <div className="p-4 bg-zinc-900 border-t border-zinc-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-zinc-200">
                PyTorch ResNet-18 Inference Pipeline
              </p>
              <p className="text-[11px] text-zinc-500 font-mono">
                Direct Frame Pull &rarr; PyTorch Tensor &rarr; 2-Class Gate Decision
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* USB Feed Controls */}
            {activeTab === "usb" && (
              <>
                {usbSourceType === "direct_stream" ? (
                  <>
                    {/* Auto-inspection toggle button */}
                    <button
                      type="button"
                      onClick={() => setAutoInspect(!autoInspect)}
                      className={`px-3 py-2.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                        autoInspect
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                          : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-zinc-200"
                      }`}
                      title="Continuously inspect live feed every 3 seconds"
                    >
                      <Timer className={`w-3.5 h-3.5 ${autoInspect ? "animate-spin text-amber-400" : ""}`} />
                      <span>{autoInspect ? "Auto-Scanning (3s)" : "Auto-Scan"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleInspectLiveStreamFrame}
                      disabled={isLoading}
                      className={`px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer ${
                        isLoading
                          ? "bg-zinc-800 text-zinc-400 border border-zinc-700 cursor-not-allowed"
                          : "bg-gradient-to-r from-emerald-500 via-indigo-600 to-indigo-500 hover:from-emerald-400 hover:to-indigo-400 text-white shadow-emerald-500/25"
                      }`}
                    >
                      {isLoading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                          <span>Analyzing Live Frame...</span>
                        </>
                      ) : (
                        <>
                          <Camera className="w-4 h-4" />
                          <span>Analyze Live DroidCam Frame</span>
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <>
                    {/* WebRTC Fallback Controls */}
                    <button
                      type="button"
                      onClick={() => setAutoInspect(!autoInspect)}
                      disabled={!isUsbVideoActive}
                      className={`px-3 py-2.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                        autoInspect
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                          : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-zinc-200"
                      }`}
                      title="Continuously inspect live feed every 3 seconds"
                    >
                      <Timer className={`w-3.5 h-3.5 ${autoInspect ? "animate-spin text-amber-400" : ""}`} />
                      <span>{autoInspect ? "Auto-Scanning (3s)" : "Auto-Scan"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCaptureUsbFrame}
                      disabled={isLoading || !isUsbVideoActive}
                      className={`px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer ${
                        isLoading || !isUsbVideoActive
                          ? "bg-zinc-800 text-zinc-400 border border-zinc-700 cursor-not-allowed"
                          : "bg-gradient-to-r from-emerald-500 via-indigo-600 to-indigo-500 hover:from-emerald-400 hover:to-indigo-400 text-white shadow-emerald-500/25"
                      }`}
                    >
                      {isLoading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                          <span>Analyzing WebRTC Frame...</span>
                        </>
                      ) : (
                        <>
                          <Camera className="w-4 h-4" />
                          <span>Analyze WebRTC Frame</span>
                        </>
                      )}
                    </button>
                  </>
                )}
              </>
            )}

            {/* Wireless Feed Controls */}
            {activeTab === "wireless" && (
              <>
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={isLoading}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-gradient-to-r from-indigo-500 to-cyan-500 text-white shadow-lg transition cursor-pointer flex items-center gap-2"
                >
                  <Camera className="w-4 h-4" />
                  <span>Snap Photo with Phone</span>
                </button>
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  disabled={isLoading}
                  className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-zinc-200 border border-zinc-700 text-xs font-medium flex items-center gap-2 transition cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Upload Image</span>
                </button>
              </>
            )}

            {/* IP Stream Controls */}
            {activeTab === "ip_stream" && (
              <button
                type="button"
                onClick={() => submitInspection(JSON.stringify({ stream_url: ipStreamUrl }), false)}
                disabled={isLoading}
                className="px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-gradient-to-r from-indigo-500 to-cyan-500 text-white shadow-lg transition cursor-pointer flex items-center gap-2"
              >
                <Wifi className="w-4 h-4" />
                <span>Pull & Inspect Stream</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error Callout */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/40 text-red-200 text-xs flex items-start gap-3 shadow-lg">
          <AlertOctagon className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-red-300">Inspection Analysis Error</p>
            <p className="text-red-300/80 leading-relaxed">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Industrial Results Panel */}
      <div className="bg-[#10121a] rounded-2xl border border-zinc-800 p-6 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-2.5">
            <Activity className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-200">
              One-Shot Inspection Verdict
            </h2>
          </div>
          {result?.latency_ms !== undefined && (
            <span className="text-[11px] font-mono text-zinc-400 bg-zinc-900 px-2.5 py-1 rounded-md border border-zinc-800">
              Inference: <strong className="text-emerald-400">{result.latency_ms} ms</strong>
            </span>
          )}
        </div>

        {result ? (
          <div className="space-y-6">
            {/* Status Verdict Banner */}
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
                    Binary ResNet-18 Inspection Gate Evaluation
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
                  Ingestion Channel
                </span>
                <p className="text-sm font-mono text-cyan-400">
                  {result.capture_source || "USB Live Frame"}
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
            <Cable className="w-8 h-8 text-zinc-600 mx-auto" />
            <p className="font-semibold text-zinc-400">
              Awaiting USB Phone Camera Capture
            </p>
            <p className="text-zinc-600 max-w-sm mx-auto">
              Click &quot;Analyze Live USB Frame&quot; above to capture a zero-latency frame from your tethered smartphone camera and execute PyTorch ResNet-18 binary classification.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default PhoneScanner;
