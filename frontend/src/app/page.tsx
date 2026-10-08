"use client";

import { useState, useRef, ChangeEvent, DragEvent } from "react";
import Image from "next/image";
import {
  Upload,
  FileImage,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Server,
  Globe,
  Copy,
  Check,
  Info,
  ShieldCheck,
  AlertOctagon,
  Sparkles,
  Sliders,
  ImageIcon,
} from "lucide-react";

interface ClassifyResponse {
  prediction?: string | boolean | number;
  confidence?: number;
  details?: string;
  status?: string | number;
  error?: string;
  targetUrl?: string;
  data?: unknown;
  [key: string]: unknown;
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ClassifyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  // Endpoint settings
  const [targetUrl, setTargetUrl] = useState("http://82.112.231.102/test/classify");
  const [useServerProxy, setUseServerProxy] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [copied, setCopied] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (selectedFile: File) => {
    if (!selectedFile.type.startsWith("image/")) {
      setError("Please select a valid image file (PNG, JPG, WebP, etc.).");
      return;
    }
    setFile(selectedFile);
    setError(null);
    setResult(null);

    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
  };

  const loadSampleImage = async () => {
    try {
      const response = await fetch("/samples/sample-component.png");
      const blob = await response.blob();
      const sampleFile = new File([blob], "sample-component.png", { type: "image/png" });
      handleFileSelect(sampleFile);
    } catch {
      setError("Failed to load sample image.");
    }
  };

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const clearSelection = () => {
    setFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setResult(null);
    setError(null);
    setLatencyMs(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const runClassification = async (mockSimulation?: string) => {
    if (!file && !mockSimulation) {
      setError("Please select or drop an image first.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);
    const startTime = performance.now();

    try {
      if (mockSimulation) {
        // Run mock simulation via the Next.js API route
        const res = await fetch(`/api/classify?mock=${encodeURIComponent(mockSimulation)}`, {
          method: "POST",
        });
        const data = await res.json();
        setLatencyMs(Math.round(performance.now() - startTime));
        setResult(data);
        return;
      }

      if (useServerProxy) {
        // Safe route via Next.js server (required for Vercel HTTPS -> HTTP)
        const formData = new FormData();
        if (file) {
          formData.append("file", file);
        }

        const endpoint = `/api/classify?target=${encodeURIComponent(targetUrl)}`;
        const res = await fetch(endpoint, {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        setLatencyMs(Math.round(performance.now() - startTime));

        if (!res.ok) {
          setError(data.error || `Server returned error status ${res.status}`);
          setResult(data);
        } else {
          setResult(data);
        }
      } else {
        // Direct browser fetch (for local testing; blocked on HTTPS Vercel)
        const formData = new FormData();
        if (file) {
          formData.append("file", file);
        }

        const res = await fetch(targetUrl, {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        setLatencyMs(Math.round(performance.now() - startTime));

        if (!res.ok) {
          setError(`Direct request returned HTTP ${res.status}`);
          setResult(data);
        } else {
          setResult(data);
        }
      }
    } catch (err: unknown) {
      setLatencyMs(Math.round(performance.now() - startTime));
      const message = err instanceof Error ? err.message : String(err);
      if (!useServerProxy && message.toLowerCase().includes("failed to fetch")) {
        setError(
          `Direct browser request failed. Browsers block insecure HTTP requests from HTTPS sites (Mixed Content) and enforce CORS. Enable "Server Proxy" to route safely through Vercel's serverless function.`
        );
      } else {
        setError(`Request failed: ${message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const copyJson = () => {
    if (result) {
      navigator.clipboard.writeText(JSON.stringify(result, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Extract and normalize prediction
  let rawPrediction: string | null = null;
  if (result) {
    if (typeof result.prediction === "string") {
      rawPrediction = result.prediction.trim();
    } else if (typeof result.prediction === "boolean") {
      rawPrediction = result.prediction ? "DEFECTIVE" : "OK";
    } else if (result.prediction !== undefined && result.prediction !== null) {
      rawPrediction = String(result.prediction);
    } else if (typeof (result as Record<string, unknown>).Prediction === "string") {
      rawPrediction = String((result as Record<string, unknown>).Prediction).trim();
    }
  }

  const normalizedPrediction = rawPrediction ? rawPrediction.toUpperCase() : null;
  const isDefective = normalizedPrediction === "DEFECTIVE";
  const isOk = normalizedPrediction === "OK";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-md shadow-indigo-600/30">
              <Sparkles className="w-5 h-5 text-indigo-100" />
            </div>
            <div>
              <h1 className="font-semibold text-base sm:text-lg leading-tight tracking-tight text-white">
                Defect Classifier
              </h1>
              <p className="text-xs text-slate-400">
                Target: <span className="font-mono text-slate-300">{targetUrl}</span>
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-700 hover:border-slate-600 bg-slate-800/80 hover:bg-slate-800 text-xs text-slate-300 transition-colors"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Settings</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Settings Panel */}
        {showSettings && (
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/90 space-y-4 shadow-xl">
            <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-400" />
              Request & Network Configuration
            </h2>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Target Endpoint URL
                </label>
                <input
                  type="text"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                  placeholder="http://82.112.231.102/test/classify"
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-800">
                <div className="space-y-0.5">
                  <div className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-indigo-400" />
                    Next.js Server Proxy (Vercel-Safe)
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Bypasses browser Mixed Content (HTTPS ➔ HTTP) and CORS restrictions by proxying
                    via serverless Route Handler.
                  </p>
                </div>
                <button
                  onClick={() => setUseServerProxy(!useServerProxy)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    useServerProxy
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  {useServerProxy ? "Enabled (Recommended)" : "Direct Browser (Local Only)"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Vercel & HTTP Explanation Banner */}
        <div className="rounded-xl border border-indigo-900/40 bg-indigo-950/20 p-4 text-xs text-indigo-200 flex items-start gap-3">
          <Info className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="font-semibold text-indigo-100">
              Can Vercel send requests to HTTP sites?
            </p>
            <p className="text-slate-300 leading-relaxed">
              <strong>Yes, through Server-Side API routes!</strong> When deployed to Vercel (HTTPS),
              browsers block direct client-side requests to insecure <code className="bg-slate-900 px-1 py-0.5 rounded text-amber-300 font-mono">http://</code> endpoints due to{" "}
              <em>Mixed Content Security</em>. However, Vercel Serverless Functions (like our{" "}
              <code className="bg-slate-900 px-1 py-0.5 rounded text-indigo-300 font-mono">/api/classify</code>{" "}
              route) run in Node.js on the server side, where they can freely send requests to any HTTP endpoint.
            </p>
          </div>
        </div>

        {/* Upload & Preview Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column: Upload Dropzone */}
          <div className="flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <Upload className="w-4 h-4 text-indigo-400" />
                1. Upload Inspection Image
              </h2>
              <button
                type="button"
                onClick={loadSampleImage}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 hover:underline decoration-indigo-400/40"
              >
                <ImageIcon className="w-3 h-3" />
                Load sample image
              </button>
            </div>

            <div
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 min-h-[260px] ${
                isDragging
                  ? "border-indigo-500 bg-indigo-500/10 scale-[1.01]"
                  : "border-slate-800 hover:border-slate-700 bg-slate-900/40 hover:bg-slate-900/60"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={onInputChange}
                className="hidden"
              />

              <div className="w-14 h-14 rounded-full bg-slate-800/80 flex items-center justify-center mb-4 text-slate-400 group-hover:text-indigo-400 transition-colors">
                <FileImage className="w-7 h-7 text-indigo-400" />
              </div>

              <p className="text-sm font-medium text-slate-200 mb-1">
                Drop your inspection image here, or{" "}
                <span className="text-indigo-400 underline decoration-indigo-400/40 underline-offset-2">
                  browse
                </span>
              </p>
              <p className="text-xs text-slate-500">Supports PNG, JPG, JPEG, WebP, BMP</p>
            </div>

            {/* Quick Simulation / Demo Buttons */}
            <div className="rounded-xl border border-slate-800/80 bg-slate-900/30 p-3 space-y-2">
              <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Quick Preview & Simulation
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => runClassification("DEFECTIVE")}
                  disabled={isLoading}
                  className="px-3 py-1.5 rounded-lg border border-rose-900/50 bg-rose-950/20 hover:bg-rose-950/40 text-rose-300 text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  Simulate DEFECTIVE
                </button>
                <button
                  type="button"
                  onClick={() => runClassification("OK")}
                  disabled={isLoading}
                  className="px-3 py-1.5 rounded-lg border border-emerald-900/50 bg-emerald-950/20 hover:bg-emerald-950/40 text-emerald-300 text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Simulate OK
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Preview & Action */}
          <div className="flex flex-col space-y-4">
            <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <FileImage className="w-4 h-4 text-indigo-400" />
              2. Selected Image & Execution
            </h2>

            <div className="border border-slate-800 bg-slate-900/40 rounded-2xl p-4 flex flex-col justify-between min-h-[260px]">
              {previewUrl && file ? (
                <div className="space-y-4">
                  <div className="relative w-full h-44 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center">
                    <Image
                      src={previewUrl}
                      alt="Upload preview"
                      fill
                      className="object-contain"
                      unoptimized
                    />
                    {isLoading && (
                      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs flex flex-col items-center justify-center space-y-2">
                        <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
                        <span className="text-xs font-medium text-indigo-200">
                          Classifying image...
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="truncate max-w-[200px] font-medium text-slate-300">
                      {file.name}
                    </span>
                    <span>{(file.size / 1024).toFixed(1)} KB</span>
                    <button
                      type="button"
                      onClick={clearSelection}
                      disabled={isLoading}
                      className="text-slate-400 hover:text-rose-400 transition-colors p-1"
                      title="Clear image"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-500 py-12 text-center">
                  <FileImage className="w-10 h-10 mb-2 opacity-30" />
                  <p className="text-xs">No image selected</p>
                  <p className="text-[11px] text-slate-600 mt-1">
                    Upload an image or run a simulation to see results
                  </p>
                </div>
              )}

              <div className="pt-4 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => runClassification()}
                  disabled={isLoading || !file}
                  className={`w-full py-3 px-4 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all duration-200 shadow-lg ${
                    isLoading || !file
                      ? "bg-slate-800 text-slate-500 cursor-not-allowed shadow-none"
                      : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30 cursor-pointer"
                  }`}
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Sending to {targetUrl}...</span>
                    </>
                  ) : (
                    <>
                      <Globe className="w-4 h-4" />
                      <span>Send to /test/classify</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Prediction Results Banner */}
        {result && (
          <div className="space-y-4 pt-2">
            <h2 className="text-sm font-semibold text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-400" />
                Classification Output
              </span>
              {latencyMs !== null && (
                <span className="text-xs font-mono text-slate-400">
                  Latency: {latencyMs}ms
                </span>
              )}
            </h2>

            {/* PREDICTION: DEFECTIVE */}
            {isDefective && (
              <div className="p-6 rounded-2xl border-2 border-rose-500/60 bg-gradient-to-r from-rose-950/60 via-rose-900/30 to-slate-900 shadow-xl shadow-rose-950/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center space-x-4">
                  <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center shrink-0">
                    <AlertOctagon className="w-8 h-8 text-rose-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-rose-400">
                        Prediction Status
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-500/20 text-rose-300 font-bold">
                        ALERT
                      </span>
                    </div>
                    <div className="text-3xl font-extrabold tracking-tight text-rose-100 mt-0.5">
                      DEFECTIVE
                    </div>
                    {result.details && (
                      <p className="text-xs text-rose-200/80 mt-1">{result.details}</p>
                    )}
                  </div>
                </div>

                {result.confidence !== undefined && (
                  <div className="sm:text-right bg-rose-950/40 px-4 py-2 rounded-xl border border-rose-800/40">
                    <div className="text-[11px] text-rose-300/80">Confidence</div>
                    <div className="text-lg font-mono font-bold text-rose-200">
                      {(result.confidence * 100).toFixed(1)}%
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* PREDICTION: OK */}
            {isOk && (
              <div className="p-6 rounded-2xl border-2 border-emerald-500/60 bg-gradient-to-r from-emerald-950/60 via-emerald-900/30 to-slate-900 shadow-xl shadow-emerald-950/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center space-x-4">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                        Prediction Status
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 font-bold">
                        PASSED
                      </span>
                    </div>
                    <div className="text-3xl font-extrabold tracking-tight text-emerald-100 mt-0.5">
                      OK
                    </div>
                    {result.details && (
                      <p className="text-xs text-emerald-200/80 mt-1">{result.details}</p>
                    )}
                  </div>
                </div>

                {result.confidence !== undefined && (
                  <div className="sm:text-right bg-emerald-950/40 px-4 py-2 rounded-xl border border-emerald-800/40">
                    <div className="text-[11px] text-emerald-300/80">Confidence</div>
                    <div className="text-lg font-mono font-bold text-emerald-200">
                      {(result.confidence * 100).toFixed(1)}%
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* OTHER / CUSTOM PREDICTION */}
            {!isDefective && !isOk && rawPrediction && (
              <div className="p-6 rounded-2xl border border-blue-500/40 bg-blue-950/20 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <Info className="w-8 h-8 text-blue-400" />
                  <div>
                    <div className="text-xs text-blue-400 font-medium">Custom Prediction</div>
                    <div className="text-2xl font-bold text-blue-100">{rawPrediction}</div>
                  </div>
                </div>
              </div>
            )}

            {/* MISSING PREDICTION FIELD NOTICE */}
            {!rawPrediction && (
              <div className="p-5 rounded-2xl border border-amber-900/60 bg-amber-950/20 flex items-start space-x-3 text-amber-200">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-sm text-amber-100">
                    No &apos;prediction&apos; field found in response
                  </p>
                  <p className="text-xs text-slate-300">
                    The endpoint responded, but the body did not contain a{" "}
                    <code className="bg-slate-900 px-1 py-0.5 rounded font-mono text-amber-300">
                      prediction
                    </code>{" "}
                    key with <code className="text-rose-300 font-mono">DEFECTIVE</code> or{" "}
                    <code className="text-emerald-300 font-mono">OK</code>. Check the raw JSON
                    below.
                  </p>
                </div>
              </div>
            )}

            {/* Raw JSON Payload Accordion */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/80 overflow-hidden">
              <div className="px-4 py-3 bg-slate-800/40 border-b border-slate-800 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-300 font-mono">
                  Raw Response JSON
                </span>
                <button
                  type="button"
                  onClick={copyJson}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy JSON</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-4 text-xs font-mono text-slate-300 overflow-x-auto max-h-72">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="p-4 rounded-xl border border-rose-900/70 bg-rose-950/40 text-rose-200 flex items-start gap-3">
            <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <p className="font-semibold text-rose-100">Request Error</p>
              <p className="text-slate-300">{error}</p>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500">
        <p>Defect Inspection Frontend • Target: {targetUrl}</p>
      </footer>
    </div>
  );
}
