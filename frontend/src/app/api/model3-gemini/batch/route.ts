import { NextRequest, NextResponse } from "next/server";

const BACKEND_BASE = process.env.CLASSIFY_API_URL || "http://127.0.0.1:8000";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const parts = searchParams.get("parts") || "ok,porosity,ok,crack,ok";
  const batchId = searchParams.get("batch_id") || "BATCH-M3-GEMINI";

  try {
    const res = await fetch(`${BACKEND_BASE}/api/model3-gemini/batch?parts=${encodeURIComponent(parts)}&batch_id=${encodeURIComponent(batchId)}`, {
      method: "GET",
      headers: { "Accept": "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: errText }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to communicate with Model 3 / Gemini backend";
    return NextResponse.json(
      { error: msg },
      { status: 502 }
    );
  }
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const parts = searchParams.get("parts") || "ok,porosity,ok,crack,ok";
  const batchId = searchParams.get("batch_id") || "BATCH-M3-GEMINI";

  try {
    const res = await fetch(`${BACKEND_BASE}/api/model3-gemini/batch?parts=${encodeURIComponent(parts)}&batch_id=${encodeURIComponent(batchId)}`, {
      method: "POST",
      headers: { "Accept": "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: errText }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to communicate with Model 3 / Gemini backend";
    return NextResponse.json(
      { error: msg },
      { status: 502 }
    );
  }
}
