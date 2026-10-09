# Qastra - Backend API Documentation
> Please refer to the root [`API_DOCUMENTATION.md`](../API_DOCUMENTATION.md) for full endpoint specifications, interactive Swagger UI guides, and pipeline architecture diagrams.

## Quick Route Summary

### 1. Main Production Routes
- `POST /api/inspect` - Full 6-stage batch inspection pipeline (Model 1 + Model 2 + Model 3 + Gemini + Gatekeeper)
- `POST /inspect-pilot-batch` - 5-part pilot batch gatekeeper inspection
- `POST /api/inspect-phone` - Tethered USB Phone / DroidCam live frame inspection
- `POST /api/inspect-gstreamer` - Remote ESP32-CAM stream snapshot inspection
- `GET /api/camera-stream` - Live MJPEG video feed
- `GET /api/camera-status` - Active camera stream status & resolution
- `GET /api/camera-snapshot` - Instant single-frame JPEG grab

### 2. System & Database
- `GET /` - API root status
- `GET /health` - Model and subsystem health
- `GET /api/db/health` - MongoDB Atlas health and telemetry count
- `POST /api/db/reconnect` - Live MongoDB Atlas reconnect
- `GET /api/telemetry/recent` - Query recent inspection telemetry

### 3. Test & Diagnostic Routes
- `GET/POST /api/model3-gemini/batch` - Model 3 XGBoost + Gemini batch diagnosis
- `GET /api/model3-gemini/batch/stream` - SSE progressive batch stream
- `GET /model3-batch-demo` - Interactive web diagnostic UI
- `POST /test/classify` - Standalone Model 1 binary defect classifier
- `POST /test/classify-batch` - Standalone Model 1 batch concurrency
- `POST /test-model2` - Standalone Model 2 multi-label ResNet-18
- `POST /test-integrated-pipeline` - Standalone Model 1 + Grad-CAM + Model 2 pipeline
