import { NextRequest, NextResponse } from "next/server";

const DEFAULT_BACKEND_BASE = process.env.CLASSIFY_API_URL || "http://127.0.0.1:8000";
const REMOTE_BACKEND_BASE = "http://82.112.231.102";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = searchParams.get("limit") || "30";

  const candidateUrls = [
    DEFAULT_BACKEND_BASE,
    "http://127.0.0.1:8000",
    "http://localhost:8000",
    REMOTE_BACKEND_BASE,
  ];

  const uniqueUrls = Array.from(new Set(candidateUrls.filter(Boolean)));

  for (const baseUrl of uniqueUrls) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`${baseUrl}/api/telemetry/recent?limit=${limit}`, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      clearTimeout(timer);

      if (res.ok) {
        const json = await res.json();
        return NextResponse.json(json);
      }
    } catch {
      // Try next candidate
    }
  }

  // Graceful fallback if MongoDB / backend is not connected yet
  return NextResponse.json({
    connected: false,
    count: 0,
    records: [],
  });
}
