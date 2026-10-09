import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limiter";

const DEFAULT_BACKEND_BASE = process.env.CLASSIFY_API_URL || "http://127.0.0.1:8000";
const REMOTE_BACKEND_BASE = "http://82.112.231.102";

export async function GET(request: NextRequest) {
  // Rate limiting check (60 GET requests per minute per IP)
  const clientIp = getClientIp(request.headers);
  const rateLimitResult = checkRateLimit(clientIp, { limit: 60, windowMs: 60 * 1000 });
  if (!rateLimitResult.success) {
    return NextResponse.json(
      {
        connected: false,
        count: 0,
        records: [],
        error: "Too many requests. Please slow down.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimitResult.retryAfterSeconds),
        },
      }
    );
  }

  const { searchParams } = new URL(request.url);
  const limit = searchParams.get("limit") || "30";

  const candidateUrls = [
    REMOTE_BACKEND_BASE,
    DEFAULT_BACKEND_BASE,
    "http://82.112.231.102",
    "http://127.0.0.1:8000",
    "http://localhost:8000",
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
