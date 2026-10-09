# Qastra

Automated quality inspection for die-cast automotive components.

Qastra combines computer vision, tabular telemetry analysis, statistical gatekeeping, and LLM report generation into a single inspection pipeline for cast metal parts.

## Pipeline stages

1. Model 1 (Filter). EfficientNet-B0 screens parts for binary OK vs. Defective classification, paired with Grad-CAM heatmaps for anomaly localization. Parts marked nominal skip downstream stages.
2. Model 2 (Categorize). ResNet-18 classifies identified defects into specific classes (porosity, shrinkage, cracks, blisters, flash, and holes).
3. Model 3 (Root cause). XGBoost evaluates six machine sensor channels (mold temperature, injection pressure, cooling rate, vibration, speed, and humidity) alongside historical run data to isolate the root cause.
4. Statistical gatekeeper. A Beta distribution model evaluates pilot batches against historical defect distributions to output an operational verdict: GO, ADJUST, or CRITICAL STOP.
5. Report generation (Gemini). Gemini formats XGBoost diagnostics into structured JSON, then writes a concise three-sentence incident report for machine operators and plant supervisors.

## Repository structure

```
.
├── backend/
│   ├── main.py              # FastAPI application and route definitions
│   ├── database.py          # Beanie ODM schemas and MongoDB Atlas client
│   ├── telemetry_bridge.py  # Sensor simulation and drift diagnostics
│   ├── batch_engine.py      # Statistical gatekeeper and batch logic
│   ├── models/              # Model weights and classifiers
│   ├── requirements.txt     # Python backend dependencies
│   └── Dockerfile           # Backend container definition
├── frontend/
│   ├── src/app/
│   │   ├── page.tsx         # Landing page and architecture flow
│   │   ├── dashboard/       # Inspection Studio for single part and batch review
│   │   ├── simulation/      # Animated pipeline flow simulation
│   │   ├── data/            # Process telemetry sheet connected to MongoDB Atlas
│   │   └── phone/           # USB UVC and mobile camera inspection gate
│   ├── package.json         # Node.js dependencies
│   └── next.config.ts       # Next.js configuration
└── board/                   # System design diagrams and planning notes
```

## Setup and local development

### Backend

Requirements: Python 3.10+

1. Change into the backend directory and install dependencies:
   ```bash
   cd backend
   python -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

2. Copy the sample environment file and set keys:
   ```bash
   cp .env.example .env
   ```
   Set `GEMINI_API_KEY` and optional `MONGO_URI` overrides in `.env`.

3. Start the FastAPI development server:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```
   The interactive OpenAPI docs are available at `http://localhost:8000/docs`.

### Frontend

Requirements: Node.js 20+

1. Change into the frontend directory and install dependencies:
   ```bash
   cd frontend
   npm install
   ```

2. Configure environment variables in `frontend/.env.local` if pointing to a non-default backend:
   ```bash
   NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
   ```

3. Start the Next.js development server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your browser.

4. To test a production build:
   ```bash
   npm run build
   npm run start
   ```

## Key API endpoints

- `POST /api/inspect`: Inspects an uploaded part image. Returns binary status, defect class, Grad-CAM heatmap, and telemetry attribution.
- `POST /api/batch/evaluate`: Runs batch analysis across five impeller images and returns the gatekeeper verdict.
- `GET /api/telemetry/recent`: Returns recent sensor readings and classified defects directly from MongoDB Atlas.
- `GET /api/camera-status`: Checks connectivity for live camera hardware.
