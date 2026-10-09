import { NextRequest } from "next/server";

const BACKEND_BASE = process.env.CLASSIFY_API_URL || "http://127.0.0.1:8000";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const deviceIndex = searchParams.get("device_index") || "0";

    const backendRes = await fetch(`${BACKEND_BASE}/api/camera-stream?device_index=${deviceIndex}`, {
      cache: "no-store",
    });

    if (!backendRes.ok || !backendRes.body) {
      return new Response("Camera stream unavailable from backend", { status: 503 });
    }

    return new Response(backendRes.body, {
      headers: {
        "Content-Type": backendRes.headers.get("content-type") || "multipart/x-mixed-replace; boundary=frame",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
        "Connection": "keep-alive",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Proxy stream error";
    return new Response(`Stream proxy error: ${msg}`, { status: 502 });
  }
}
