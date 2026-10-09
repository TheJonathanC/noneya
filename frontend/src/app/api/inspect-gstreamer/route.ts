import { NextRequest, NextResponse } from "next/server";

const BACKEND_BASE = process.env.CLASSIFY_API_URL || "http://127.0.0.1:8000";

export async function POST(req: NextRequest) {
  try {
    let body = "{}";
    try {
      body = await req.text();
    } catch {
      // ignore
    }

    const backendRes = await fetch(`${BACKEND_BASE}/api/inspect-gstreamer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body,
    });

    if (!backendRes.ok) {
      const errText = await backendRes.text();
      try {
        const errJson = JSON.parse(errText);
        return NextResponse.json(errJson, { status: backendRes.status });
      } catch {
        return NextResponse.json({ error: errText }, { status: backendRes.status });
      }
    }

    const data = await backendRes.json();
    return NextResponse.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to communicate with inspection backend";
    return NextResponse.json(
      { error: msg, detail: "Ensure FastAPI server is running on port 8000" },
      { status: 502 }
    );
  }
}
