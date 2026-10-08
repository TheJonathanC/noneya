import {
  InspectionItem,
  MOCK_INSPECTION_ITEMS,
  normalizeInspectionResponse,
} from "./inspection-adapter";

export interface SingleInspectionResult {
  item: InspectionItem;
  rawJson: Record<string, unknown>;
  latencyMs: number;
  source: "live-backend" | "resilient-engine" | "mock";
}

export interface BatchInspectionFlowResult {
  items: InspectionItem[];
  rawJson: Record<string, unknown>;
  batchId: string;
  gateDecision: "GO" | "ADJUST" | "CRITICAL STOP";
  defectsCount: number;
  passedCount: number;
  latencyMs: number;
  source: "live-backend" | "resilient-engine" | "mock";
}

export interface InspectionError {
  title: string;
  message: string;
  code: string;
  statusCode?: number;
  retryable: boolean;
  timestamp: string;
  detail?: string;
  backendTarget?: string;
}

export interface InspectRequestOptions {
  useMockFallback?: boolean;
  targetUrl?: string;
  mockState?: "DEFECTIVE" | "OK" | "RANDOM";
  customPartId?: string;
}

/**
 * Dispatches a single photo to the backend inspection model with robust error handling.
 */
export async function inspectSinglePhoto(
  file: File,
  options: { mockState?: "DEFECTIVE" | "OK" | "RANDOM"; useMockFallback?: boolean } = {}
): Promise<SingleInspectionResult> {
  const start = performance.now();
  const formData = new FormData();
  formData.append("file", file, file.name);

  let endpoint = "/api/classify?mode=single";
  if (options.mockState) {
    endpoint += `&mock=${options.mockState}`;
  }
  if (options.useMockFallback) {
    endpoint += "&fallback=true";
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      body: formData,
    });

    const latencyMs = Math.round(performance.now() - start);

    if (!response.ok) {
      if (options.useMockFallback) {
        const fallbackItem = generateFallbackInspection(file, "P-IMP-9801");
        return {
          item: fallbackItem,
          rawJson: { error: `HTTP ${response.status}`, status: "fallback" },
          latencyMs,
          source: "resilient-engine",
        };
      }

      let errorPayload: Record<string, unknown> | null = null;
      try {
        errorPayload = await response.json();
      } catch {
        // Not JSON
      }

      const errorMessage =
        (typeof errorPayload?.error === "string" && errorPayload.error) ||
        (typeof errorPayload?.detail === "string" && errorPayload.detail) ||
        `Backend returned HTTP ${response.status} (${response.statusText})`;

      const errorCode =
        typeof errorPayload?.code === "string"
          ? errorPayload.code
          : response.status >= 500
          ? "BACKEND_ERROR"
          : "REQUEST_ERROR";

      const err: InspectionError = {
        title: response.status >= 500 ? "Backend Model Service Error" : "Inspection Request Error",
        message: errorMessage,
        code: errorCode,
        statusCode: response.status,
        retryable: response.status >= 500 || response.status === 408,
        timestamp: new Date().toLocaleTimeString(),
        detail: typeof errorPayload?.detail === "string" ? errorPayload.detail : undefined,
        backendTarget:
          typeof errorPayload?.backend_target === "string"
            ? errorPayload.backend_target
            : undefined,
      };

      throw err;
    }

    const rawJson = (await response.json()) as Record<string, unknown>;

    if (rawJson.status === "error") {
      const err: InspectionError = {
        title: "Model Inspection Failure",
        message: typeof rawJson.error === "string" ? rawJson.error : "Unknown error",
        code: typeof rawJson.code === "string" ? rawJson.code : "INSPECTION_FAILED",
        statusCode: 500,
        retryable: true,
        timestamp: new Date().toLocaleTimeString(),
        detail: typeof rawJson.detail === "string" ? rawJson.detail : undefined,
      };
      throw err;
    }

    const objectUrl = URL.createObjectURL(file);
    const item = normalizeInspectionResponse(rawJson, file.name, objectUrl);
    item.fileName = file.name;

    const source = rawJson.backend_target
      ? "live-backend"
      : rawJson.source === "resilient-engine"
      ? "resilient-engine"
      : "mock";

    return {
      item,
      rawJson,
      latencyMs: typeof rawJson.latency_ms === "number" ? rawJson.latency_ms : latencyMs,
      source,
    };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "title" in error) {
      throw error as InspectionError;
    }
    const netErr: InspectionError = {
      title: "Network Connection Failed",
      message:
        error instanceof Error
          ? error.message
          : "Unable to reach the inspection service. Please check your network connection.",
      code: "NETWORK_ERROR",
      retryable: true,
      timestamp: new Date().toLocaleTimeString(),
    };
    throw netErr;
  }
}

/**
 * Dispatches a batch of photos to the backend model inspection endpoint with error handling.
 */
export async function inspectBatchPhotos(
  files: File[],
  options: { mockState?: "DEFECTIVE" | "OK" | "RANDOM"; useMockFallback?: boolean } = {}
): Promise<BatchInspectionFlowResult> {
  const start = performance.now();
  const formData = new FormData();

  for (const file of files) {
    formData.append("files", file, file.name);
  }

  let endpoint = "/api/classify?mode=batch";
  if (options.mockState) {
    endpoint += `&mock=${options.mockState}`;
  }
  if (options.useMockFallback) {
    endpoint += "&fallback=true";
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      body: formData,
    });

    const latencyMs = Math.round(performance.now() - start);

    if (!response.ok) {
      if (options.useMockFallback) {
        const items = MOCK_INSPECTION_ITEMS.slice(0, Math.min(files.length || 5, 5));
        return {
          items,
          rawJson: { error: `HTTP ${response.status}`, status: "fallback" },
          batchId: `BATCH-${Date.now()}`,
          gateDecision: "CRITICAL STOP",
          defectsCount: 2,
          passedCount: items.length - 2,
          latencyMs,
          source: "resilient-engine",
        };
      }

      let errorPayload: Record<string, unknown> | null = null;
      try {
        errorPayload = await response.json();
      } catch {
        // Not JSON
      }

      const errorMessage =
        (typeof errorPayload?.error === "string" && errorPayload.error) ||
        (typeof errorPayload?.detail === "string" && errorPayload.detail) ||
        `Batch model service returned HTTP ${response.status}`;

      const errorCode =
        typeof errorPayload?.code === "string"
          ? errorPayload.code
          : response.status >= 500
          ? "BACKEND_ERROR"
          : "REQUEST_ERROR";

      const err: InspectionError = {
        title: "Batch Inspection Error",
        message: errorMessage,
        code: errorCode,
        statusCode: response.status,
        retryable: response.status >= 500 || response.status === 408,
        timestamp: new Date().toLocaleTimeString(),
        detail: typeof errorPayload?.detail === "string" ? errorPayload.detail : undefined,
        backendTarget:
          typeof errorPayload?.backend_target === "string"
            ? errorPayload.backend_target
            : undefined,
      };

      throw err;
    }

    const rawJson = (await response.json()) as Record<string, unknown>;

    if (rawJson.status === "error") {
      const err: InspectionError = {
        title: "Batch Model Error",
        message: typeof rawJson.error === "string" ? rawJson.error : "Unknown error",
        code: typeof rawJson.code === "string" ? rawJson.code : "BATCH_ERROR",
        statusCode: 500,
        retryable: true,
        timestamp: new Date().toLocaleTimeString(),
        detail: typeof rawJson.detail === "string" ? rawJson.detail : undefined,
      };
      throw err;
    }

    const payload = (rawJson.payload as Record<string, unknown>) || rawJson;

    const batchId =
      typeof payload.batch_id === "string" ? payload.batch_id : `PILOT-${Date.now()}`;

    const scannedParts = Array.isArray(payload.scanned_parts)
      ? (payload.scanned_parts as Record<string, unknown>[])
      : [];

    const items: InspectionItem[] = files.map((file, idx) => {
      const scanned = scannedParts[idx] || {};
      const partId = `P-IMP-${9810 + idx}`;
      const objectUrl = URL.createObjectURL(file);

      const merged = {
        ...scanned,
        prediction:
          scanned.prediction ||
          (scanned.verdict === "confirmed" ? "DEFECTIVE" : scanned.verdict === "ok" ? "OK" : undefined),
        defect_type: scanned.defect_type,
        confidence: scanned.clf_prob || scanned.confidence_score,
        root_cause: payload.root_cause,
        gemini_incident_report: payload.gemini_incident_report,
      };

      return normalizeInspectionResponse(merged, partId, objectUrl);
    });

    const gateStatus = (payload.gate_status as Record<string, unknown>) || {};
    const gateDecision =
      typeof gateStatus.decision === "string"
        ? (gateStatus.decision as "GO" | "ADJUST" | "CRITICAL STOP")
        : items.some((i) => i.status === "DEFECTIVE")
        ? "CRITICAL STOP"
        : "GO";

    const defectsCount = items.filter((i) => i.status === "DEFECTIVE").length;
    const passedCount = items.length - defectsCount;

    return {
      items,
      rawJson,
      batchId,
      gateDecision,
      defectsCount,
      passedCount,
      latencyMs: typeof rawJson.latency_ms === "number" ? rawJson.latency_ms : latencyMs,
      source: rawJson.backend_target ? "live-backend" : "resilient-engine",
    };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "title" in error) {
      throw error as InspectionError;
    }
    const netErr: InspectionError = {
      title: "Network Connection Failed",
      message:
        error instanceof Error
          ? error.message
          : "Unable to reach the batch inspection service. Please check your network connection.",
      code: "NETWORK_ERROR",
      retryable: true,
      timestamp: new Date().toLocaleTimeString(),
    };
    throw netErr;
  }
}

/**
 * Creates an in-memory sample File object for 1-click testing.
 */
export function createSampleFile(
  type: "nominal" | "defective" = "nominal",
  index = 1
): File {
  const isDefect = type === "defective";
  const label = isDefect ? `defective_impeller_${index}.png` : `nominal_impeller_${index}.png`;

  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">
    <rect width="600" height="600" fill="#1C1917"/>
    <circle cx="300" cy="300" r="220" fill="#292524" stroke="#57534E" stroke-width="3"/>
    <circle cx="300" cy="300" r="140" fill="#1C1917" stroke="#78716A" stroke-width="2"/>
    <circle cx="300" cy="300" r="45" fill="#141210" stroke="#C2410C" stroke-width="2"/>
    ${
      isDefect
        ? `<ellipse cx="360" cy="240" rx="26" ry="14" fill="#EA580C" opacity="0.9"/>
           <line x1="340" y1="240" x2="380" y2="240" stroke="#FAF8F5" stroke-width="2"/>
           <text x="300" y="550" fill="#EA580C" font-family="monospace" font-size="16" text-anchor="middle">DEFECT LOCALIZED: POROSITY</text>`
        : `<text x="300" y="550" fill="#16A34A" font-family="monospace" font-size="16" text-anchor="middle">SPECIFICATION: NOMINAL</text>`
    }
  </svg>`;

  const blob = new Blob([svgContent], { type: "image/svg+xml" });
  return new File([blob], label, { type: "image/svg+xml" });
}

/**
 * Backward compatibility helpers
 */
export async function runBatchInspection(
  files: File[],
  sampleSize = 5,
  options: InspectRequestOptions = {}
): Promise<{ items: InspectionItem[]; durationMs: number; source: "live-backend" | "mock-fallback" | "simulated-engine" }> {
  if (files.length === 0) {
    const selected = MOCK_INSPECTION_ITEMS.slice(0, Math.min(sampleSize, MOCK_INSPECTION_ITEMS.length));
    return {
      items: selected,
      durationMs: 45,
      source: "simulated-engine",
    };
  }

  const result = await inspectBatchPhotos(files.slice(0, sampleSize), options);
  return {
    items: result.items,
    durationMs: result.latencyMs,
    source: result.source === "live-backend" ? "live-backend" : "mock-fallback",
  };
}

function generateFallbackInspection(file: File | Blob, partId?: string): InspectionItem {
  const isDefective = Math.random() > 0.65;
  const objectUrl = file instanceof File ? URL.createObjectURL(file) : undefined;

  const mockPayload = isDefective
    ? {
        prediction: "DEFECTIVE",
        defect_type: "porosity",
        severity_rating: "Critical",
        confidence: 0.942,
        recommended_action: "Quarantine batch for destructive testing and inspect cooling manifold.",
      }
    : {
        prediction: "OK",
        defect_type: "nominal",
        severity_rating: "Nominal",
        confidence: 0.989,
        recommended_action: "Release part to downstream buffer A-4.",
      };

  return normalizeInspectionResponse(mockPayload, partId, objectUrl);
}
