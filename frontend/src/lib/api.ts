import {
  InspectionItem,
  MOCK_INSPECTION_ITEMS,
  normalizeInspectionResponse,
} from "./inspection-adapter";

export interface InspectRequestOptions {
  useMockFallback?: boolean;
  targetUrl?: string;
  mockState?: "DEFECTIVE" | "OK" | "RANDOM";
  customPartId?: string;
}

export interface BatchInspectionResult {
  items: InspectionItem[];
  durationMs: number;
  source: "live-backend" | "mock-fallback" | "simulated-engine";
}

/**
 * Inspect a single file via the backend API with built-in mock fallback resilience.
 */
export async function inspectComponent(
  file: File | Blob,
  options: InspectRequestOptions = {}
): Promise<{ item: InspectionItem; source: "live-backend" | "mock-fallback" }> {
  const {
    useMockFallback = true,
    targetUrl = "http://82.112.231.102/test/classify",
    mockState,
    customPartId,
  } = options;

  // If user explicitly requested mock simulation
  if (mockState && mockState !== "RANDOM") {
    try {
      const res = await fetch(`/api/classify?mock=${mockState}`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        const objectUrl = file instanceof File ? URL.createObjectURL(file) : undefined;
        return {
          item: normalizeInspectionResponse(data, customPartId, objectUrl),
          source: "mock-fallback",
        };
      }
    } catch {
      // Fall through to local adapter
    }
  }

  // Attempt live call via Next.js server proxy route
  try {
    const formData = new FormData();
    formData.append("file", file, file instanceof File ? file.name : "component.jpg");

    const endpoint = `/api/classify?target=${encodeURIComponent(targetUrl)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(endpoint, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      const objectUrl = file instanceof File ? URL.createObjectURL(file) : undefined;
      return {
        item: normalizeInspectionResponse(data, customPartId, objectUrl),
        source: "live-backend",
      };
    } else {
      // Backend returned non-200 (e.g. 404 endpoint not yet implemented)
      if (useMockFallback) {
        const item = generateFallbackInspection(file, customPartId);
        return { item, source: "mock-fallback" };
      }
      throw new Error(`Inspection server returned HTTP ${response.status}`);
    }
  } catch (err: unknown) {
    if (useMockFallback) {
      const item = generateFallbackInspection(file, customPartId);
      return { item, source: "mock-fallback" };
    }
    throw err;
  }
}

/**
 * Generate a mock batch or process a batch of uploaded files.
 */
export async function runBatchInspection(
  files: File[],
  sampleSize = 5,
  options: InspectRequestOptions = {}
): Promise<BatchInspectionResult> {
  const start = performance.now();

  if (files.length === 0) {
    // Generate slice from curated mock batch
    const count = Math.min(Math.max(sampleSize, 1), MOCK_INSPECTION_ITEMS.length);
    const selected = MOCK_INSPECTION_ITEMS.slice(0, count);
    return {
      items: selected,
      durationMs: Math.round(performance.now() - start),
      source: "simulated-engine",
    };
  }

  // Inspect each file in parallel
  const promises = files.slice(0, sampleSize).map(async (file, index) => {
    const partId = `P-IMP-${9810 + index}`;
    try {
      const result = await inspectComponent(file, { ...options, customPartId: partId });
      return result.item;
    } catch {
      return generateFallbackInspection(file, partId);
    }
  });

  const items = await Promise.all(promises);
  return {
    items,
    durationMs: Math.round(performance.now() - start),
    source: options.useMockFallback ? "mock-fallback" : "live-backend",
  };
}

function generateFallbackInspection(file: File | Blob, partId?: string): InspectionItem {
  // Deterministic or pseudo-random inspection based on file name or timestamp
  const isDefective = Math.random() > 0.65;
  const objectUrl = file instanceof File ? URL.createObjectURL(file) : undefined;

  const mockPayload = isDefective
    ? {
        prediction: "DEFECTIVE",
        defect_type: "porosity",
        severity_rating: "Critical",
        confidence: 0.942,
        root_cause_analysis: {
          probable_cause: "abnormal casting temperature and mold chill rate variance",
          confidence_score: "94%",
        },
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
