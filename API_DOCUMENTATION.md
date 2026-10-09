# Qastra - API Documentation
> **Automated Component Quality Inspection, Root-Cause Diagnostics, and Batch Gatekeeping Pipeline**

Interactive Swagger UI is accessible at [`http://localhost:8000/docs`](http://localhost:8000/docs)  
Interactive ReDoc specification is accessible at [`http://localhost:8000/redoc`](http://localhost:8000/redoc)

---

## Base URLs & Environments

| Environment | Base URL | Description |
| :--- | :--- | :--- |
| **FastAPI Backend (Direct)** | `http://localhost:8000` | Native Python AI backend and video inference engine. |
| **Next.js Frontend Proxy** | `http://localhost:3000` | Fullstack Next.js proxy route layer (`/api/*`). |
| **Default Remote Stream** | `http://172.10.3.17:81/stream` | ESP32-CAM wireless video and snapshot source. |

---

## Pipeline Architecture Overview

Production inspection flows sequentially through six coordinated stages:

```
[ Intake: Camera / Upload / ESP32 ]
                 │
                 ▼
┌───────────────────────────────────────────────┐
│ STAGE 1: Model 1 Gatekeeper (EfficientNet-B0) │ ──> Normal/OK (Bypasses Stage 2)
│ Extract binary defect probability + Grad-CAM  │
└──────────────────────┬────────────────────────┘
                       │ Defective
                       ▼
┌───────────────────────────────────────────────┐
│ STAGE 2: Model 2 Categorize (ResNet-18)       │
│ Multi-label classification (6 defect classes) │
└──────────────────────┬────────────────────────┘
                       │
                       ▼
┌───────────────────────────────────────────────┐
│ STAGE 3: Model 3 Root Cause (XGBoost + SCADA) │
│ Ingests simulated/PLC telemetry; isolates     │
│ primary culprit sensor & Z-score drift        │
└──────────────────────┬────────────────────────┘
                       │
                       ▼
┌───────────────────────────────────────────────┐
│ STAGE 4: Gemini Structured Incident JSON      │
│ Normalizes root cause, drift sigma, mitigations│
└──────────────────────┬────────────────────────┘
                       │
                       ▼
┌───────────────────────────────────────────────┐
│ STAGE 5: Gemini Supervisor Briefing           │
│ Synthesizes clean 3-sentence incident report  │
└──────────────────────┬────────────────────────┘
                       │
                       ▼
┌───────────────────────────────────────────────┐
│ STAGE 6: Batch Engine Gatekeeper Decision     │
│ Computes batch drift, historical defect risk, │
│ setpoint adjustments, and GO/ADJUST/STOP      │
└───────────────────────────────────────────────┘
```

---

# Part 1: Main Production Routes

Production endpoints serving the Next.js frontend, tethered USB camera feed, and remote ESP32-CAM hardware.

---

### 1. `POST /api/inspect`
**Full Multi-Stage Batch Inspection Pipeline**

Executes the end-to-end 6-stage AI workflow on one or more component images. Evaluates visual defect features, generates Grad-CAM heatmaps, performs Model 2 classification, simulates SCADA telemetry, computes Model 3 XGBoost root-cause attributions, and invokes the Batch Gatekeeper.

- **Method**: `POST`
- **Content-Type**: `multipart/form-data`
- **Parameters**:
  - `file` *(binary upload, optional/repeated)*: Component image(s) (e.g. `cast_def_0_65.jpeg`).
  - `batch_id` *(query/form string, optional)*: Batch identifier (defaults to auto-generated `BATCH-YYYYMMDD-XXXX`).

#### Request Example (cURL):
```bash
curl -X POST "http://localhost:8000/api/inspect?batch_id=PILOT-B101" \
  -H "Accept: application/json" \
  -F "file=@backend/models/classification/image.jpeg"
```

#### Response Structure (200 OK):
```json
{
  "batch_id": "PILOT-B101",
  "status": "COMPLETED",
  "verdict": "WARNING",
  "gate_decision": "ADJUST",
  "gate_action": "Defect or drift found. Apply suggested fixes, then re-run pilot batch.",
  "supervisor_summary": "1 part(s) analysed (0 OK, 1 defective). Defect mix: porosity x1. Largest telemetry drift: mold temperature at +3.2 sigma.",
  "results": [
    {
      "filename": "image.jpeg",
      "status": "DEFECTIVE",
      "defect_type": "porosity",
      "confidence_scores": { "porosity": "85.0%" },
      "telemetry": {
        "mold_temp": 742.4,
        "injection_pressure": 118.2,
        "cooling_rate": 8.1,
        "vibration": 1.1,
        "machine_speed": 1190,
        "humidity": 44.1
      },
      "root_cause_analysis": {
        "predicted_cause_defect": "porosity",
        "primary_culprit_sensor": "mold_temp",
        "z_score_deviation": 3.24,
        "diagnostic_explanation": "Melt / mold temperature variance outside permissible thermal tolerance"
      },
      "gemini_report": "Defect verified as porosity caused by elevated mold temperature. Cooling rate is insufficient.",
      "vision_results": {
        "is_defective": true,
        "confidence": 0.982,
        "heatmap_base64": "data:image/jpeg;base64,..."
      }
    }
  ],
  "batch_analysis": {
    "verdict": "WARNING",
    "fixes": [
      {
        "sensor": "mold_temp",
        "current_mean": 742.4,
        "target": 685.0,
        "delta": -57.4,
        "instruction": "Lower Mold temperature by 57.4 C (from 742.4 C to 685.0 C)"
      }
    ],
    "stats": {
      "total": 1,
      "ok": 0,
      "defective": 1,
      "defect_rate": 1.0,
      "max_drift_sigma": 3.24
    }
  }
}
```

---

### 2. `POST /inspect-pilot-batch`
**5-Part Pilot Batch Gatekeeper Inspection**

Concurrently inspects exactly 5 impeller images via a thread pool, checks defect thresholds against the Gatekeeper rule, and generates a strict 3-sentence Gemini incident summary.

- **Method**: `POST`
- **Content-Type**: `multipart/form-data`
- **Parameters**:
  - `files` *(array of 5 binary images)*: Exactly 5 component images.

#### Request Example (cURL):
```bash
curl -X POST "http://localhost:8000/inspect-pilot-batch" \
  -F "files=@part1.jpg" \
  -F "files=@part2.jpg" \
  -F "files=@part3.jpg" \
  -F "files=@part4.jpg" \
  -F "files=@part5.jpg"
```

---

### 3. `POST /api/inspect-phone`
**Tethered Phone / DirectShow Video Frame Inspection**

Instantly grabs the latest frame from the active DirectShow camera feed (DroidCam virtual webcam device 0), or accepts a mobile photo upload, or pulls an IP webcam frame. Immediately runs PyTorch ResNet-18 binary classification (~30ms-150ms).

- **Method**: `POST`
- **Content-Type**: `multipart/form-data` OR `application/json`
- **Body Options**:
  - *No body / Empty body*: Classifies live frame cached from DroidCam DirectShow device 0.
  - *Multipart file*: `file=@shutter.jpg`
  - *JSON*: `{"image_base64": "..."}` or `{"stream_url": "http://172.10.3.17:81/stream"}`

#### Request Example (cURL):
```bash
# Analyze current live DroidCam frame directly:
curl -X POST "http://localhost:8000/api/inspect-phone"

# Or inspect an uploaded mobile photo:
curl -X POST "http://localhost:8000/api/inspect-phone" \
  -F "file=@photo.jpg"
```

#### Response Structure (200 OK):
```json
{
  "status": "success",
  "prediction": "DEFECTIVE",
  "is_defective": true,
  "confidence": 0.942,
  "probabilities": { "defect": 0.942, "ok": 0.058 },
  "gatekeeper_verdict": "REJECT / QUARANTINE",
  "capture_source": "usb_droidcam_live_feed",
  "inspection_latency_ms": 42.1
}
```

---

### 4. `POST /api/inspect-gstreamer`
**ESP32-CAM GStreamer Stream Snapshot Inspection**

Captures a live frame from an ESP32-CAM network stream (via GStreamer or HTTP fallback) and executes binary classification and defect diagnostics.

- **Method**: `POST`
- **Content-Type**: `application/json` or empty
- **Parameters**:
  - `stream_url` *(optional string)*: Target ESP32 URL (defaults to `http://172.10.3.17:81/stream`).

#### Request Example (cURL):
```bash
curl -X POST "http://localhost:8000/api/inspect-gstreamer" \
  -H "Content-Type: application/json" \
  -d '{"stream_url": "http://172.10.3.17:81/stream"}'
```

---

### 5. `GET /api/camera-stream`
**Live MJPEG Camera Video Stream**

Continuous multipart MJPEG stream from the local USB / DroidCam camera (DirectShow device 0). Zero WebRTC browser permission barriers; directly embeddable in standard HTML `<img>` elements.

- **Method**: `GET`
- **Query Parameters**:
  - `device_index` *(integer, default `0`)*: Video capture device index.
- **Content-Type**: `multipart/x-mixed-replace; boundary=frame`

#### Frontend Usage:
```html
<img src="http://localhost:8000/api/camera-stream?device_index=0" alt="Live Camera" />
```

---

### 6. `GET /api/camera-status`
**Live Camera Status & Resolution**

Returns active device state, whether frames are flowing, capture dimensions, active browser viewers, and latency.

- **Method**: `GET`

#### Response Structure (200 OK):
```json
{
  "is_running": true,
  "is_connected": true,
  "device_index": 0,
  "resolution": { "width": 1920, "height": 1080 },
  "active_subscribers": 1,
  "last_frame_age_ms": 32.5
}
```

---

### 7. `GET /api/camera-snapshot`
**Instant Single-Frame JPEG Snapshot**

Returns the single latest cached frame from the camera buffer as a standard `image/jpeg` payload.

- **Method**: `GET`
- **Response**: `200 OK` (`image/jpeg` binary)

---

# Part 2: System & Database Routes

Operational status, telemetry persistence, and database health.

---

### 8. `GET /`
**API Root Status**

Returns service uptime and track metadata.

- **Response (200 OK)**:
  ```json
  {
    "status": "online",
    "service": "Automotive Component Quality Inspection API",
    "track": "Track 3: Automotive Component Quality Inspection (Singularity 2026)",
    "timestamp": "2026-10-09T10:00:00.000000"
  }
  ```

---

### 9. `GET /health`
**System & Model Health Status**

Verifies whether PyTorch weights, telemetry simulators, Gemini API keys, and MongoDB Atlas are operational.

- **Response (200 OK)**:
  ```json
  {
    "status": "healthy",
    "models_loaded": {
      "risk_model_ready": true,
      "telemetry_sim_ready": true,
      "gemini_sdk_available": true,
      "gemini_key_configured": true,
      "mongodb_connected": true
    }
  }
  ```

---

### 10. `GET /api/db/health`
**MongoDB Connectivity Health**

Checks MongoDB connection status and counts persisted inspection telemetry records.

---

### 11. `POST /api/db/reconnect`
**Reconnect MongoDB Atlas**

Triggers a live re-initialization of the Beanie / Motor ODM connection without restarting the server.

---

### 12. `GET /api/telemetry/recent`
**Fetch Recent Inspection Records**

Retrieves historical inspection and SCADA telemetry records from MongoDB.

- **Query Parameters**:
  - `limit` *(integer, default `20`)*: Number of records to return.

---

# Part 3: Test & Diagnostic Routes

Isolated validation endpoints for testing individual ML models, running synthetic SCADA drift batches, and streaming Server-Sent Events.

---

### 13. `GET /api/model3-gemini/batch` & `POST /api/model3-gemini/batch`
*(Aliases: `/api/test-model3-gemini`)*  
**Model 3 + Gemini Batch Telemetry Diagnostic**

Runs Model 3 (XGBoost SCADA root cause diagnostic) working with Gemini for each individual part of a batch, and then aggregates the end-batch synthesis (verdict, setpoint fixes, and supervisor review).

- **Method**: `GET` or `POST`
- **Query Parameters**:
  - `parts` *(string, default `"ok,porosity,ok,crack,ok"`)*: Comma-separated defect sequence. Allowed values: `ok`, `porosity`, `crack`, `deformation`, `scratch`, `corrosion`.
  - `batch_id` *(string, default `"PILOT-M3-GEMINI"`)*: Batch identification tag.

#### Request Example (cURL):
```bash
curl -X GET "http://localhost:8000/api/model3-gemini/batch?parts=ok,porosity,ok,crack,ok&batch_id=TEST-01"
```

#### Response Structure:
```json
{
  "batch_id": "TEST-01",
  "total_parts": 5,
  "individual_parts": [
    {
      "part_index": 2,
      "defect_type": "porosity",
      "status": "DEFECTIVE",
      "scada_telemetry": { "mold_temp": 741.8, "injection_pressure": 117.9, "cooling_rate": 8.3 },
      "model3_diagnosis": {
        "predicted_cause_defect": "porosity",
        "primary_culprit_sensor": "mold_temp",
        "z_score_deviation": 3.19
      },
      "gemini_part_report": "Part #2 flagged defective due to high mold temperature drift."
    }
  ],
  "batch_engine_evaluation": {
    "verdict": "CRITICAL STOP",
    "fixes": [
      {
        "sensor": "injection_pressure",
        "instruction": "Lower Injection pressure by 36.0 bar"
      }
    ],
    "gemini_batch_review": "Batch halted due to critical crack signatures and severe hydraulic pressure drift."
  }
}
```

---

### 14. `GET /api/model3-gemini/batch/stream`
**SSE Stream: Step-by-Step Model 3 + Gemini Batch**

Server-Sent Events (SSE) streaming endpoint that progressively emits each individual part's telemetry diagnosis as it processes, concluding with the final batch gatekeeper synthesis.

- **Method**: `GET`
- **Query Parameters**:
  - `parts` *(string, default `"ok,porosity,ok,crack,ok"`)*
  - `batch_id` *(string, default `"STREAM-M3-GEMINI"`)*
- **Stream Events**:
  - `event: batch_start`
  - `event: part_output` (emitted per part)
  - `event: end_batch` (aggregated verdict and fixes)
  - `event: done`

---

### 15. `GET /model3-batch-demo`
*(Alias: `/demo/model3-batch`)*  
**Interactive Model 3 + Gemini Visual Demo UI**

Self-contained web application rendering live progress bars, telemetry tables, radar charts, and Gemini cards for inspecting batches step by step.

---

### 16. `POST /test/classify`
*(Alias: `/test-classification`)*  
**Test Vision Model 1 (EfficientNet-B0 Binary)**

Evaluates a single image directly using `clf.pt` with zero LLM/Gemini dependencies.

- **Parameters**: `file` (single image binary)
- **Response**: `is_defective`, `confidence`, `probabilities`, and Grad-CAM heatmap.

---

### 17. `POST /test/classify-batch`
*(Alias: `/test-classification-batch`)*  
**Test Vision Model 1: Batch Concurrent Images**

Evaluates multiple uploaded images concurrently through Model 1 without triggering gatekeepers or Gemini.

- **Parameters**: `files` (array of image binaries)
- **Response**: Array of results with individual classifications and latency metrics.

---

### 18. `POST /test-model2`
**Test Vision Model 2: Multi-Label ResNet-18**

Tests the 6-class multi-label defect classifier on an isolated image:
- Classes: `['corrosion', 'crack', 'deformation', 'dent', 'porosity', 'scratch']`
- Returns: `predicted_defects`, `confidence_scores`, and fallback review flags.

---

### 19. `POST /test-integrated-pipeline`
**Test Integrated Model 1 + Model 2 Grad-CAM Pipeline**

Executes Model 1 -> Grad-CAM bounding isolation -> masked image generation -> Model 2 categorization in sequence without external telemetry or database overhead.

---

## Quick Reference Summary Table

| Category | Method | Endpoint | Primary Purpose |
| :--- | :--- | :--- | :--- |
| **Main** | `POST` | `/api/inspect` | Full 6-stage batch pipeline (Model 1 -> 2 -> 3 -> Gemini -> Gatekeeper) |
| **Main** | `POST` | `/inspect-pilot-batch` | 5-part pilot batch gatekeeper check |
| **Main** | `POST` | `/api/inspect-phone` | Live frame inspection via tethered DroidCam/USB or mobile upload |
| **Main** | `POST` | `/api/inspect-gstreamer` | Remote ESP32-CAM stream snapshot inspection |
| **Main** | `GET` | `/api/camera-stream` | Low-latency live MJPEG video stream |
| **Main** | `GET` | `/api/camera-status` | Camera hardware resolution & streaming status |
| **Main** | `GET` | `/api/camera-snapshot` | Instant single-frame JPEG grab |
| **System** | `GET` | `/` | API status and track information |
| **System** | `GET` | `/health` | Subsystem and model readiness health check |
| **System** | `GET` | `/api/db/health` | MongoDB Atlas status and document counter |
| **System** | `POST` | `/api/db/reconnect` | On-the-fly MongoDB Atlas reconnect |
| **System** | `GET` | `/api/telemetry/recent` | Query recent persisted inspection records |
| **Test** | `GET/POST`| `/api/model3-gemini/batch` | Model 3 XGBoost + Gemini individual & batch analysis |
| **Test** | `GET` | `/api/model3-gemini/batch/stream`| Real-time Server-Sent Events (SSE) telemetry stream |
| **Test** | `GET` | `/model3-batch-demo` | Interactive visual demo dashboard |
| **Test** | `POST` | `/test/classify` | Standalone Model 1 binary defect classifier test |
| **Test** | `POST` | `/test/classify-batch` | Standalone Model 1 batch concurrency test |
| **Test** | `POST` | `/test-model2` | Standalone Model 2 multi-label ResNet-18 test |
| **Test** | `POST` | `/test-integrated-pipeline` | Standalone Model 1 + Grad-CAM + Model 2 chained test |
