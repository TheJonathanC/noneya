import { NextRequest, NextResponse } from "next/server";

const BACKEND_BASE = process.env.CLASSIFY_API_URL || "http://127.0.0.1:8000";

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let body: BodyInit;
    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (contentType.includes("application/json")) {
      body = await req.text();
      headers["Content-Type"] = "application/json";
    } else if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      body = formData;
    } else {
      body = await req.arrayBuffer();
      if (contentType) headers["Content-Type"] = contentType;
    }

    const backendRes = await fetch(`${BACKEND_BASE}/api/inspect-phone`, {
      method: "POST",
      headers,
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
      { error: msg, detail: "Ensure FastAPI server is running on http://127.0.0.1:8000" },
      { status: 502 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: "online",
    service: "inspect-phone-proxy",
    target: `${BACKEND_BASE}/api/inspect-phone`,
  });
}
