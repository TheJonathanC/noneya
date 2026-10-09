import { NextResponse } from "next/server";

const BACKEND_BASE = process.env.CLASSIFY_API_URL || "http://127.0.0.1:8000";

export async function GET() {
  try {
    const res = await fetch(`${BACKEND_BASE}/api/camera-status`, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json({ is_connected: false, is_running: false }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ is_connected: false, is_running: false }, { status: 502 });
  }
}
