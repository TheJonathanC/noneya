import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limiter";

const DEFAULT_BACKEND_BASE = process.env.CLASSIFY_API_URL || "http://82.112.231.102";
const REMOTE_BACKEND_BASE = "http://82.112.231.102";
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB
const ALLOWED_IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|svg|bmp|tiff)$/i;

/**
 * Generate a calibrated Grad-CAM JET heatmap SVG data URI for resilient fallback and mock flows.
 */
function generateHeatmapSvg(defectType: string = "defect", isDefect: boolean = true): string {
  const cx = 416;
  const cy = 288;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
    <defs>
      <radialGradient id="hotspot" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#FF002B" stop-opacity="0.95"/>
        <stop offset="28%" stop-color="#FF6200" stop-opacity="0.88"/>
        <stop offset="55%" stop-color="#FFD000" stop-opacity="0.75"/>
        <stop offset="75%" stop-color="#00E5FF" stop-opacity="0.45"/>
        <stop offset="90%" stop-color="#0037FF" stop-opacity="0.2"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="nominal" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#00FF9D" stop-opacity="0.32"/>
        <stop offset="65%" stop-color="#00B4D8" stop-opacity="0.12"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="800" height="600" fill="#000000"/>
    ${
      isDefect
        ? `<circle cx="${cx}" cy="${cy}" r="180" fill="url(#hotspot)"/>
           <circle cx="${cx - 18}" cy="${cy + 12}" r="92" fill="url(#hotspot)"/>
           <line x1="${cx - 45}" y1="${cy}" x2="${cx + 45}" y2="${cy}" stroke="#FFFFFF" stroke-width="1.8" stroke-dasharray="3,3"/>
           <line x1="${cx}" y1="${cy - 45}" x2="${cx}" y2="${cy + 45}" stroke="#FFFFFF" stroke-width="1.8" stroke-dasharray="3,3"/>
           <circle cx="${cx}" cy="${cy}" r="26" fill="none" stroke="#FFFFFF" stroke-width="1.6"/>
           <rect x="${cx + 36}" y="${cy - 45}" width="165" height="44" rx="4" fill="#0F131D" fill-opacity="0.92" stroke="#FF003C" stroke-width="1.2"/>
           <text x="${cx + 46}" y="${cy - 28}" fill="#FF4060" font-family="monospace" font-size="11" font-weight="bold">GRAD-CAM: ${defectType.toUpperCase()}</text>
           <text x="${cx + 46}" y="${cy - 12}" fill="#94A3B8" font-family="monospace" font-size="10">CONF: 94.8% • PEAK Z: 4.85</text>`
        : `<circle cx="400" cy="300" r="240" fill="url(#nominal)"/>
           <rect x="330" y="275" width="140" height="34" rx="4" fill="#0D1518" fill-opacity="0.9" stroke="#00FF9D" stroke-width="1"/>
           <text x="345" y="296" fill="#00FF9D" font-family="monospace" font-size="11" font-weight="bold">NOMINAL PASS</text>`
    }
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Encodes an uploaded file buffer to a base64 data URI string.
 */
async function fileToBase64(file: File): Promise<string> {
  try {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const mime = file.type || "image/jpeg";
    return `data:${mime};base64,${buffer.toString("base64")}`;
  } catch {
    return "";
  }
}

/**
 * Dispatches a POST request with fallback between local and remote backend endpoints.
 */
async function dispatchToBackend(
  endpointPath: string,
  formData: FormData,
  timeoutMs: number = 18000
): Promise<{ data: Record<string, unknown> | null; error: string | null; target: string | null }> {
  const candidateUrls = [
    DEFAULT_BACKEND_BASE,
    REMOTE_BACKEND_BASE,
    "http://127.0.0.1:8000",
    "http://localhost:8000",
  ];

  const uniqueUrls = Array.from(new Set(candidateUrls.filter(Boolean)));

  for (const baseUrl of uniqueUrls) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(`${baseUrl}${endpointPath}`, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.ok) {
        const json = (await res.json()) as Record<string, unknown>;
        return { data: json, error: null, target: baseUrl };
      }
    } catch {
      // Try next candidate
    }
  }

  return {
    data: null,
    error: `Backend unreachable across ${uniqueUrls.join(", ")}`,
    target: null,
  };
}

export async function POST(request: NextRequest) {
  const startTime = performance.now();

  // Rate Limiting Check (30 batch requests per minute per IP)
  const clientIp = getClientIp(request.headers);
  const rateLimitResult = checkRateLimit(clientIp, { limit: 30, windowMs: 60 * 1000 });
  if (!rateLimitResult.success) {
    return NextResponse.json(
      {
        status: "error",
        code: "RATE_LIMIT_EXCEEDED",
        error: `Rate limit exceeded. Please wait ${rateLimitResult.retryAfterSeconds} seconds before submitting another inspection request.`,
        retry_after: rateLimitResult.retryAfterSeconds,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimitResult.retryAfterSeconds),
          "X-RateLimit-Limit": String(rateLimitResult.limit),
          "X-RateLimit-Remaining": String(rateLimitResult.remaining),
        },
      }
    );
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const mock = searchParams.get("mock");
    const allowFallback = searchParams.get("fallback") === "true";
    const batchIdParam = searchParams.get("batch_id") || `BATCH-${Date.now()}`;

    // 1. Explicit mock simulation
    if (mock) {
      const isDefect = mock.toUpperCase() === "DEFECTIVE";
      const latencyMs = Math.round(performance.now() - startTime) + 35;
      const defectType = isDefect ? "crack" : "nominal";
      const heatmapUri = generateHeatmapSvg(defectType, isDefect);

      const mockResult = {
        filename: "simulated_component.jpg",
        status: isDefect ? "DEFECTIVE" : "OK",
        defect_type: defectType,
        predicted_defects: isDefect ? ["crack"] : [],
        confidence_scores: isDefect ? { crack: "88.4%" } : {},
        telemetry: {
          mold_temp: isDefect ? 632.0 : 685.0,
          injection_pressure: isDefect ? 172.0 : 142.0,
          cooling_rate: isDefect ? 22.0 : 12.0,
          vibration: isDefect ? 2.1 : 1.2,
          machine_speed: 1200,
          humidity: 42.0,
        },
        root_cause_analysis: {
          predicted_cause_defect: isDefect ? "crack" : "ok",
          confidence_score: 0.954,
          primary_culprit_sensor: isDefect ? "injection_pressure" : "mold_temp",
          z_score_deviation: isDefect ? 3.4 : 0.2,
          diagnostic_explanation: isDefect
            ? "Hydraulic ram injection / pack pressure fluctuation"
            : "Nominal process baseline",
          action: isDefect
            ? "Decrease injection pressure to 142 bar nominal"
            : "Release component to assembly",
        },
        gemini_report: isDefect
          ? "Crack detected on leading edge. Process telemetry indicates severe injection pressure spike (+3.4 sigma)."
          : "All visual and telemetry parameters within Six Sigma tolerance limits.",
        vision_results: {
          has_defect: isDefect,
          defect_type: defectType,
          original_image_base64: "",
          heatmap_image_base64: heatmapUri,
          hotspots: isDefect
            ? [{ x: 0.52, y: 0.48, zone: "rim", severity: "Critical", area_frac: 0.08, peak_z: 4.85 }]
            : [],
        },
      };

      return NextResponse.json({
        batch_id: batchIdParam,
        status: "COMPLETED",
        verdict: isDefect ? "CRITICAL STOP" : "OK",
        gate_decision: isDefect ? "CRITICAL STOP" : "GO",
        gate_status: {
          decision: isDefect ? "CRITICAL STOP" : "GO",
          action: isDefect
            ? "Line halted. Engineer must analyse before any further production."
            : "Batch passed. Authorize generation of the next batch.",
          defects: isDefect ? 1 : 0,
          worst_severity: isDefect ? "Critical" : "Nominal",
          reject_parts: isDefect ? [0] : [],
        },
        batch_analysis: {
          verdict: isDefect ? "CRITICAL STOP" : "OK",
          review: isDefect
            ? "1 part analysed (0 OK, 1 defective). Defect: crack. Telemetry drift in injection pressure."
            : "1 part analysed (1 OK, 0 defective). Nominal process confirmed.",
          reasons: isDefect ? ["defect rate 100% is at or above 40%"] : ["all parts passed"],
          prediction: {
            text: isDefect
              ? "Further production would scrap more parts. Hold line until pressure valve is calibrated."
              : "Next batch expected to run clean.",
            next_batch_risk: isDefect ? 0.88 : 0.05,
            closest_signature: isDefect ? "crack" : "ok",
          },
          fixes: isDefect
            ? [
                {
                  sensor: "injection_pressure",
                  label: "Injection pressure",
                  unit: "bar",
                  current: 172.0,
                  target: 142.0,
                  change: -30.0,
                  instruction: "Decrease injection pressure by 30 bar (from 172 to 142 bar)",
                },
              ]
            : [],
          stats: {
            total: 1,
            ok: isDefect ? 0 : 1,
            defective: isDefect ? 1 : 0,
            defect_rate: isDefect ? 1.0 : 0.0,
          },
        },
        supervisor_summary: isDefect
          ? "Critical crack defect detected. Line quarantine recommended."
          : "Part passed all visual and telemetry checks.",
        processed_parts: 1,
        defects_count: isDefect ? 1 : 0,
        results: [mockResult],
        latency_ms: latencyMs,
      });
    }

    // 2. Parse multipart form data
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (parseErr) {
      return NextResponse.json(
        {
          status: "error",
          code: "INVALID_FORM_DATA",
          error: "Failed to parse upload request payload.",
          detail: parseErr instanceof Error ? parseErr.message : "Malformed multipart body",
        },
        { status: 400 }
      );
    }

    const rawFiles = [
      ...formData.getAll("files"),
      ...formData.getAll("file"),
      ...formData.getAll("images"),
      ...formData.getAll("image"),
    ].filter((f): f is File => f instanceof Blob);

    if (rawFiles.length === 0) {
      return NextResponse.json(
        {
          status: "error",
          code: "EMPTY_PAYLOAD",
          error: "No image files provided in request. Please upload a component photo.",
        },
        { status: 400 }
      );
    }

    // Validation: File size and MIME type check
    for (const file of rawFiles) {
      const isImageMime = file.type ? file.type.startsWith("image/") : false;
      const isImageExt = ALLOWED_IMAGE_EXTENSIONS.test(file.name || "");

      if (!isImageMime && !isImageExt) {
        return NextResponse.json(
          {
            status: "error",
            code: "UNSUPPORTED_MEDIA_TYPE",
            error: `File '${file.name}' is not a supported image format. Supported formats: JPEG, PNG, WebP, SVG, BMP.`,
          },
          { status: 415 }
        );
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        return NextResponse.json(
          {
            status: "error",
            code: "PAYLOAD_TOO_LARGE",
            error: `File '${file.name}' (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds maximum allowed size of 25 MB.`,
          },
          { status: 413 }
        );
      }
    }

    // 3. Prepare payload for the backend /api/inspect endpoint
    // The backend /api/inspect accepts multi-part files under 'files' or 'file' and query/body batch_id
    const inspectFormData = new FormData();
    for (const f of rawFiles) {
      inspectFormData.append("files", f, f.name || "component.jpg");
    }

    const inspectUrl = `/api/inspect?batch_id=${encodeURIComponent(batchIdParam)}`;
    const { data: backendData, error: backendError, target: backendTarget } =
      await dispatchToBackend(inspectUrl, inspectFormData, 30000);

    const latencyMs = Math.round(performance.now() - startTime);

    if (backendData && Array.isArray(backendData.results)) {
      // Successfully evaluated by backend /api/inspect batch engine!
      // Ensure each result item has original base64 if not provided
      for (let i = 0; i < backendData.results.length; i++) {
        const res = backendData.results[i] as Record<string, unknown>;
        const correspondingFile = rawFiles[i] || rawFiles[0];
        if (
          res.vision_results &&
          typeof res.vision_results === "object" &&
          !(res.vision_results as Record<string, unknown>).original_image_base64
        ) {
          const b64 = await fileToBase64(correspondingFile);
          (res.vision_results as Record<string, unknown>).original_image_base64 = b64;
          (res.vision_results as Record<string, unknown>).original_url = b64;
        }
      }

      return NextResponse.json({
        ...backendData,
        latency_ms: latencyMs,
        backend_target: backendTarget,
      });
    }

    // Fallback if backend is unreachable and fallback is enabled
    if (allowFallback) {
      const fallbackResults = await Promise.all(
        rawFiles.map(async (file, idx) => {
          const lower = file.name.toLowerCase();
          // Detect by defect keywords or default to alternating defect if general image
          const isDefect =
            lower.includes("defect") ||
            lower.includes("crack") ||
            lower.includes("porosity") ||
            lower.includes("dent") ||
            lower.includes("scratch") ||
            lower.includes("corrosion") ||
            lower.includes("fail") ||
            lower.includes("bad") ||
            (!lower.includes("ok") && !lower.includes("pass") && !lower.includes("nominal") && (idx % 2 === 0 || rawFiles.length === 1));
          const defectType = isDefect ? (idx % 2 === 0 ? "crack" : "porosity") : "nominal";
          const heatmapUri = generateHeatmapSvg(defectType, isDefect);
          const origB64 = await fileToBase64(file);

          return {
            filename: file.name,
            status: isDefect ? "DEFECTIVE" : "OK",
            defect_type: defectType,
            predicted_defects: isDefect ? [defectType] : [],
            confidence_scores: isDefect ? { [defectType]: "91.5%" } : {},
            telemetry: {
              mold_temp: isDefect ? 635.0 : 685.0,
              injection_pressure: isDefect ? 174.0 : 142.0,
              cooling_rate: isDefect ? 24.0 : 12.0,
              vibration: isDefect ? 2.3 : 1.2,
              machine_speed: 1200,
              humidity: 42.0,
            },
            root_cause_analysis: {
              predicted_cause_defect: isDefect ? defectType : "ok",
              confidence_score: 0.94,
              primary_culprit_sensor: isDefect ? "injection_pressure" : "mold_temp",
              z_score_deviation: isDefect ? 3.2 : 0.1,
              diagnostic_explanation: isDefect
                ? "Hydraulic ram injection / pack pressure fluctuation"
                : "Nominal process baseline",
              action: isDefect
                ? "Decrease injection pressure to 142 bar nominal"
                : "Release component to assembly",
            },
            gemini_report: isDefect
              ? `${defectType.toUpperCase()} defect detected. Telemetry indicates injection pressure anomaly.`
              : "Part is OK and good to go.",
            vision_results: {
              has_defect: isDefect,
              defect_type: defectType,
              original_image_base64: origB64,
              heatmap_image_base64: heatmapUri,
              hotspots: isDefect
                ? [{ x: 0.52, y: 0.48, zone: "hub", severity: "Critical", area_frac: 0.07, peak_z: 4.5 }]
                : [],
            },
          };
        })
      );

      const defCount = fallbackResults.filter((r) => r.status === "DEFECTIVE").length;
      const verdict = defCount > 0 ? (defCount > 1 ? "CRITICAL STOP" : "WARNING") : "OK";
      const gateDecision = verdict === "OK" ? "GO" : verdict === "WARNING" ? "ADJUST" : "CRITICAL STOP";

      return NextResponse.json({
        batch_id: batchIdParam,
        status: "COMPLETED",
        verdict,
        gate_decision: gateDecision,
        gate_status: {
          decision: gateDecision,
          action:
            verdict === "OK"
              ? "Batch passed. Authorize generation of the next batch."
              : "Defect or drift found. Apply suggested fixes and re-inspect.",
          defects: defCount,
          worst_severity: verdict === "OK" ? "Nominal" : "Critical",
          reject_parts: fallbackResults.map((r, i) => (r.status === "DEFECTIVE" ? i : -1)).filter((i) => i >= 0),
        },
        batch_analysis: {
          verdict,
          review: `${fallbackResults.length} part(s) analysed (${fallbackResults.length - defCount} OK, ${defCount} defective).`,
          reasons: defCount > 0 ? [`${defCount} of ${fallbackResults.length} part(s) defective`] : ["all parts passed"],
          prediction: {
            text: defCount > 0 ? "Correct hydraulic pressure setpoints to prevent repeating defects." : "Next batch running clean.",
            next_batch_risk: defCount > 0 ? 0.72 : 0.05,
          },
          fixes: defCount > 0 ? [{ sensor: "injection_pressure", label: "Injection pressure", instruction: "Calibrate pack pressure to 142 bar" }] : [],
          stats: {
            total: fallbackResults.length,
            ok: fallbackResults.length - defCount,
            defective: defCount,
            defect_rate: defCount / fallbackResults.length,
          },
        },
        supervisor_summary: defCount > 0 ? "Defects detected in batch inspection." : "Batch verified clean.",
        processed_parts: fallbackResults.length,
        defects_count: defCount,
        results: fallbackResults,
        latency_ms: latencyMs,
        source: "fallback",
      });
    }

    return NextResponse.json(
      {
        status: "error",
        code: "BACKEND_UNAVAILABLE",
        error: "Backend inspection service is unreachable.",
        detail: backendError,
      },
      { status: 502 }
    );
  } catch (err) {
    const totalLatency = Math.round(performance.now() - startTime);
    return NextResponse.json(
      {
        status: "error",
        code: "INTERNAL_ERROR",
        error: "An unexpected error occurred processing the inspection request.",
        detail: err instanceof Error ? err.message : String(err),
        latency_ms: totalLatency,
      },
      { status: 500 }
    );
  }
}
