import { NextRequest, NextResponse } from "next/server";


export async function POST(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const mock = searchParams.get("mock");

    // Allow mock simulations for testing UI states
    if (mock) {
      if (mock.toUpperCase() === "DEFECTIVE") {
        return NextResponse.json({
          prediction: "DEFECTIVE",
          confidence: 0.962,
          timestamp: new Date().toISOString(),
          details: "Simulated defect detected: Surface hairline fracture",
        });
      }
      if (mock.toUpperCase() === "OK") {
        return NextResponse.json({
          prediction: "OK",
          confidence: 0.988,
          timestamp: new Date().toISOString(),
          details: "Simulated inspection: Component passed all structural checks",
        });
      }
      if (mock.toUpperCase() === "NO_PREDICTION") {
        return NextResponse.json({
          status: "completed",
          message: "Processed successfully, but no prediction field returned",
          timestamp: new Date().toISOString(),
        });
      }
    }

    const formData = await request.formData();
    const file = formData.get("file") || formData.get("image");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: "No image file provided. Please provide a file with key 'file' or 'image'." },
        { status: 400 }
      );
    }

    const targetUrl =
      searchParams.get("target") ||
      process.env.CLASSIFY_API_URL ||
      "http://82.112.231.102/test/classify";

    // Prepare outbound multipart form data
    const outboundFormData = new FormData();
    // FastAPI commonly expects 'file', but also append 'image' if different parameter name is used
    outboundFormData.append("file", file, (file as File).name || "upload.jpg");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    try {
      const response = await fetch(targetUrl, {
        method: "POST",
        body: outboundFormData,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const contentType = response.headers.get("content-type") || "";
      let responseData: unknown;

      if (contentType.includes("application/json")) {
        responseData = await response.json();
      } else {
        const text = await response.text();
        try {
          responseData = JSON.parse(text);
        } catch {
          responseData = { rawText: text };
        }
      }

      if (!response.ok) {
        return NextResponse.json(
          {
            error: `Target server returned HTTP ${response.status} (${response.statusText})`,
            status: response.status,
            targetUrl,
            data: responseData,
          },
          { status: response.status }
        );
      }

      return NextResponse.json(responseData);
    } catch (fetchErr: unknown) {
      clearTimeout(timeout);
      const isAbort = fetchErr instanceof Error && fetchErr.name === "AbortError";
      return NextResponse.json(
        {
          error: isAbort
            ? `Connection to ${targetUrl} timed out after 20 seconds.`
            : `Failed to connect to ${targetUrl}: ${fetchErr instanceof Error ? fetchErr.message : String(fetchErr)}`,
          targetUrl,
        },
        { status: 502 }
      );
    }
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
