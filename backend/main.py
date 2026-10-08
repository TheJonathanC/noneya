"""
FastAPI Backend for Automotive Component Quality Inspection (Singularity 2026 Hackathon)
Track 3: Automotive Component Quality Inspection

Triple-Model Fusion Architecture:
- Vision Model A (Supervised): EfficientNet-B0 (defect/OK + Grad-CAM heatmap)
- Vision Model B (Unsupervised): PatchCore-lite (anomaly localization & score)
- Tabular Model: GradientBoosting / XGBoost + counterfactual SHAP-style attribution
- Gatekeeper: Beta distribution statistical model (GO, ADJUST, CRITICAL STOP)
- LLM: Gemini 1.5 Flash generates a strict 3-sentence incident report
"""

import os
import sys
import io
import time
import json
import logging
import asyncio
from typing import List, Optional, Dict, Any
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from PIL import Image

from fastapi import FastAPI, File, UploadFile, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

try:
    import torch
    import timm
    from torchvision import transforms
    HAS_TORCH = True
except ImportError:
    torch = None
    timm = None
    transforms = None
    HAS_TORCH = False

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Ensure current and parent directories are in sys.path for robust imports
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

# Domain model imports from models/classification
from models.classification.severity import pilot_gate, inspect_part, ZONES, LEVELS, ORDER
from models.classification import process_sim

# Optional Google Generative AI SDK
try:
    import google.generativeai as genai
    HAS_GENAI = True
except ImportError:
    genai = None
    HAS_GENAI = False

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("quality_inspection_api")

# Configure Gemini API if available
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
if HAS_GENAI and GEMINI_API_KEY:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        logger.info("Google Generative AI SDK configured successfully.")
    except Exception as e:
        logger.warning(f"Failed to configure Gemini with provided key: {e}")

# Global In-Memory ML Objects
sim_telemetry_df = None
sim_telemetry_z = None
risk_model = None

# PyTorch Classification Model (Vision Model A: EfficientNet-B0)
clf_model = None
clf_transform = None
if HAS_TORCH and transforms:
    clf_transform = transforms.Compose([
        transforms.Resize((512, 512)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])

def load_classifier():
    """Loads the real EfficientNet-B0 PyTorch classifier weights from clf.pt."""
    global clf_model
    if clf_model is not None:
        return clf_model
    
    clf_path = os.path.join(CURRENT_DIR, "models", "classification", "clf.pt")
    if not os.path.exists(clf_path):
        logger.warning(f"Classification weights not found at: {clf_path}")
        return None

    try:
        model = timm.create_model("efficientnet_b0", num_classes=2, pretrained=False)
        state_dict = torch.load(clf_path, map_location="cpu")
        model.load_state_dict(state_dict)
        model.eval()
        clf_model = model
        logger.info("EfficientNet-B0 classifier loaded successfully from clf.pt")
        return clf_model
    except Exception as exc:
        logger.error(f"Failed to load clf.pt: {exc}")
        return None

# Thread pool executor for parallel vision inference tasks
vision_executor = ThreadPoolExecutor(max_workers=5)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Startup & shutdown lifespan event handler.
    Globally initializes simulated process telemetry and pre-trains
    the risk model in memory so inference is instant.
    """
    global sim_telemetry_df, sim_telemetry_z, risk_model
    logger.info("Starting up: Generating simulated telemetry with seed=42...")
    sim_telemetry_df = process_sim.simulate(seed=42)
    sim_telemetry_z = process_sim.add_z(sim_telemetry_df.copy())
    
    logger.info("Starting up: Training telemetry risk model in memory...")
    risk_model = process_sim.train_risk(sim_telemetry_df)
    logger.info("Risk model successfully trained and ready in memory.")
    
    # Pre-warm classification model
    load_classifier()
    
    yield
    
    logger.info("Shutting down quality inspection backend.")
    vision_executor.shutdown(wait=False)


app = FastAPI(
    title="Singularity 2026 - Automotive Component Quality Inspection API",
    description="Triple-Model Fusion Backend for Casting Impeller Quality Control",
    version="1.0.0",
    lifespan=lifespan,
)

# Enable CORS for Next.js frontend (default dev port 3000 or custom ports)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------
# Helper Functions
# ---------------------------------------------------------

def run_mock_visual_scan(index: int, filename: str) -> Dict[str, Any]:
    """
    Simulates concurrent visual scan on an impeller image.
    In production, this feeds the image through:
      1) EfficientNet-B0 (classification + Grad-CAM heatmap)
      2) PatchCore-lite (anomaly map + spatial hotspot extraction)
    
    For demo/testing failure flow:
      Forces hardcoded defects_found = 2 across the 5 parts (indices 0 and 1 defective).
    """
    is_defective = index in (0, 1)

    if is_defective:
        defect_type = "shrinkage_porosity" if index == 0 else "vane_inclusion"
        zone = "hub" if index == 0 else "vane_cavity"
        peak_z = 4.85 if index == 0 else 3.72
        severity_label = "Critical" if index == 0 else "High"
        clf_prob = 0.94 if index == 0 else 0.83

        hotspots = [
            {
                "zone": zone,
                "peak_z": peak_z,
                "area_frac": 0.0028,
                "x": 0.52 if index == 0 else 0.38,
                "y": 0.48 if index == 0 else 0.55,
                "score": 0.76 if index == 0 else 0.59,
                "severity": severity_label,
            }
        ]
        return {
            "part_index": index,
            "filename": filename,
            "verdict": "confirmed",
            "severity": severity_label,
            "clf_prob": round(float(clf_prob), 3),
            "defect_type": defect_type,
            "hotspots": hotspots,
            "note": f"Visual anomaly localized in {zone} ({severity_label}).",
        }
    else:
        return {
            "part_index": index,
            "filename": filename,
            "verdict": "ok",
            "severity": "None",
            "clf_prob": round(float(0.04 + index * 0.02), 3),
            "defect_type": "none",
            "hotspots": [],
            "note": "Component within normal dimensional & surface tolerances.",
        }


def generate_gemini_report(incident_data: Dict[str, Any]) -> str:
    """
    Invokes Gemini 1.5 Flash via google.generativeai to produce a strict
    3-sentence incident report.
    Falls back gracefully if the API is offline or rate-limited.
    """
    gate = incident_data.get("gate_status", {})
    rc = incident_data.get("root_cause", {})
    cp = incident_data.get("changepoint", {})
    blast = incident_data.get("blast_radius", {})
    
    decision = gate.get("decision", "CRITICAL STOP")
    defects = gate.get("defects", 2)
    worst_sev = gate.get("worst_severity", "Critical")
    top_cause = rc.get("cause", "pour_temp")
    change_t = cp.get("change_t", 140)
    quarantined = blast.get("quarantined_count", 15)
    action = rc.get("action", "Inspect the temperature control system and re-set parameters.")

    # High-quality deterministic fallback template adhering strictly to 3 sentences
    fallback_report = (
        f"The automated gatekeeper triggered a {decision} after detecting {defects} defective casting impellers "
        f"with {worst_sev} severity in the 5-part pilot batch. "
        f"Telemetry attribution identified {top_cause} drift starting at process time {change_t} min as the root cause, "
        f"requiring an immediate quarantine of {quarantined} parts. "
        f"Corrective action: {action}"
    )

    if not HAS_GENAI or not GEMINI_API_KEY:
        logger.info("Using template incident report (Gemini API key not configured).")
        return fallback_report

    try:
        model = genai.GenerativeModel("gemini-1.5-flash")
        prompt = (
            "You are an expert automotive quality inspection engineer. "
            "Write a strict, professional 3-sentence incident report based on the following JSON data.\n\n"
            f"Data:\n{json.dumps(incident_data, indent=2)}\n\n"
            "Requirements:\n"
            "Sentence 1: State the gatekeeper verdict, number of defective parts found in the 5-part pilot batch, and worst defect severity.\n"
            "Sentence 2: State the primary root cause variable, process changepoint time, and quarantined parts count.\n"
            "Sentence 3: State the exact required engineering corrective action.\n"
            "Output exactly 3 sentences. No bullet points, no markdown formatting."
        )
        response = model.generate_content(prompt)
        text = response.text.strip() if response and response.text else ""
        if text:
            return text
        return fallback_report
    except Exception as exc:
        logger.warning(f"Gemini API invocation failed or rate-limited ({exc}); applying fallback template.")
        return fallback_report


def analyze_process_failure() -> Dict[str, Any]:
    """
    Analyzes simulated machine telemetry during failure flow:
      1) Identifies machine and time window with active fault/drift
      2) Calculates worst-case future risk
      3) Runs counterfactual root cause analysis (SHAP style)
      4) Computes EWMA changepoint drift report
      5) Calculates blast radius (quarantined parts count)
    """
    global sim_telemetry_df, sim_telemetry_z, risk_model

    if sim_telemetry_df is None or risk_model is None:
        sim_telemetry_df = process_sim.simulate(seed=42)
        sim_telemetry_z = process_sim.add_z(sim_telemetry_df.copy())
        risk_model = process_sim.train_risk(sim_telemetry_df)

    # Find the machine with an active drift or highest risk
    target_machine = "M-04"
    best_rep = {}
    
    for mach in process_sim.MACHINES:
        g = sim_telemetry_z[sim_telemetry_z["machine_id"] == mach].sort_values("t").reset_index(drop=True)
        rep = process_sim.drift_report(g)
        if rep:
            target_machine = mach
            best_rep = rep
            break

    g_mach = sim_telemetry_z[sim_telemetry_z["machine_id"] == target_machine].sort_values("t").reset_index(drop=True)
    feats = process_sim.feature_frame(g_mach)
    risk_scores = process_sim.risk(risk_model, feats)

    worst_idx = int(risk_scores.argmax())
    worst_risk = float(risk_scores[worst_idx])
    worst_row = feats.iloc[worst_idx]

    # 1. Root Cause Attribution
    rc = process_sim.root_cause(risk_model, worst_row)
    primary_factor = rc["cause"] if rc.get("cause") else "pour_temp"

    # 2. Drift Report & Changepoint
    if primary_factor in best_rep:
        rep_factor = best_rep[primary_factor]
    elif best_rep:
        primary_factor = list(best_rep.keys())[0]
        rep_factor = best_rep[primary_factor]
    else:
        rep_factor = {
            "alarm_idx": worst_idx,
            "alarm_t": int(g_mach["t"].iloc[worst_idx]),
            "change_idx": max(0, worst_idx - 8),
            "change_t": int(g_mach["t"].iloc[max(0, worst_idx - 8)]),
        }

    # 3. Blast Radius (quarantined parts)
    blast_seg = process_sim.blast_radius(g_mach, rep_factor, model=risk_model, min_risk=0.2)
    quarantined_count = int(len(blast_seg))
    at_risk_count = int(blast_seg["at_risk"].sum()) if "at_risk" in blast_seg.columns else quarantined_count

    return {
        "machine_id": target_machine,
        "worst_risk": round(worst_risk, 3),
        "worst_serial": str(g_mach["serial"].iloc[worst_idx]),
        "worst_time_min": int(g_mach["t"].iloc[worst_idx]),
        "root_cause": rc,
        "changepoint": {
            "factor": primary_factor,
            "alarm_idx": rep_factor["alarm_idx"],
            "alarm_t": rep_factor["alarm_t"],
            "change_idx": rep_factor["change_idx"],
            "change_t": rep_factor["change_t"],
        },
        "blast_radius": {
            "quarantined_count": quarantined_count,
            "at_risk_count": at_risk_count,
            "start_time_min": rep_factor["change_t"],
            "end_time_min": int(blast_seg["t"].iloc[-1]) if len(blast_seg) > 0 else rep_factor["alarm_t"],
            "quarantined_serials": blast_seg["serial"].head(10).tolist() if len(blast_seg) > 0 else [],
        },
    }


# ---------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------

@app.get("/")
def health_check():
    """Health check endpoint for reverse proxies and ingress monitors."""
    return {
        "status": "online",
        "service": "Automotive Component Quality Inspection API",
        "track": "Track 3: Automotive Component Quality Inspection (Singularity 2026)",
        "timestamp": datetime.utcnow().isoformat(),
    }


@app.get("/health")
def status_check():
    """Detailed backend component health status."""
    return {
        "status": "healthy",
        "models_loaded": {
            "risk_model_ready": risk_model is not None,
            "telemetry_sim_ready": sim_telemetry_df is not None,
            "gemini_sdk_available": HAS_GENAI,
            "gemini_key_configured": bool(GEMINI_API_KEY),
        },
    }


@app.post("/inspect-pilot-batch")
async def inspect_pilot_batch(files: List[UploadFile] = File(...)):
    """
    Main inspection endpoint for the 5-part pilot batch of casting impellers.
    
    Workflow:
      1. Receives 5 image uploads.
      2. Concurrently runs visual scans using asyncio and ThreadPoolExecutor (<1 min latency).
      3. Calls Gatekeeper logic: pilot_gate(defects_found).
      4. Failure Flow (if gate != 'GO'):
         - Calls process_sim.root_cause() for SHAP-style attribution.
         - Calls process_sim.drift_report() and process_sim.blast_radius() for changepoint & quarantine.
         - Calls Gemini 1.5 Flash (with fallback) for a 3-sentence incident report.
      5. Returns full structured JSON payload.
    """
    if len(files) != 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Expected exactly 5 impeller images for the pilot batch, but received {len(files)}.",
        )

    # 1. Parallel visual scan across the 5 images using asyncio + ThreadPoolExecutor
    loop = asyncio.get_running_loop()
    scan_tasks = [
        loop.run_in_executor(vision_executor, run_mock_visual_scan, i, file.filename or f"impeller_{i+1}.png")
        for i, file in enumerate(files)
    ]
    scanned_parts = await asyncio.gather(*scan_tasks)

    # 2. Gatekeeper Logic: Beta posterior calculation
    # In accordance with severity.py, pilot_gate takes the list of parts.
    # Defects_found is 2 as mocked in run_mock_visual_scan.
    defects_found = scanned_parts
    gate_status = pilot_gate(defects_found)
    decision = gate_status.get("decision", "GO")

    # 3. Assemble response payload
    response_payload: Dict[str, Any] = {
        "timestamp": datetime.utcnow().isoformat(),
        "batch_id": f"PILOT-{datetime.utcnow().strftime('%Y%m%d%H%M')}",
        "parts_tested": len(scanned_parts),
        "defects_count": gate_status.get("defects", 0),
        "gate_status": gate_status,
        "scanned_parts": scanned_parts,
    }

    # 4. Failure Flow (if gate decision is NOT 'GO')
    if decision != "GO":
        failure_analysis = analyze_process_failure()
        
        response_payload["machine_id"] = failure_analysis["machine_id"]
        response_payload["worst_case_risk"] = {
            "score": failure_analysis["worst_risk"],
            "serial": failure_analysis["worst_serial"],
            "timestamp_min": failure_analysis["worst_time_min"],
        }
        response_payload["root_cause"] = failure_analysis["root_cause"]
        response_payload["changepoint"] = failure_analysis["changepoint"]
        response_payload["blast_radius"] = failure_analysis["blast_radius"]

        # 5. Gemini 1.5 Flash Incident Report (strict 3 sentences)
        incident_report = generate_gemini_report(response_payload)
        response_payload["gemini_incident_report"] = incident_report
    else:
        response_payload["message"] = "Batch passed gatekeeper with zero critical defects. Production approved."
        response_payload["gemini_incident_report"] = (
            "Pilot batch passed all visual and telemetry tolerances with zero defects. "
            "Gatekeeper confirmed GO status for full production launch. "
            "Continuous automated monitoring remains active."
        )

    return response_payload


# Keep legacy mock route for backwards compatibility with any earlier tests
@app.post("/api/inspect")
async def legacy_inspect_test(file: UploadFile = File(...)):
    """Legacy single file test endpoint."""
    return {
        "timestamp": datetime.utcnow().isoformat(),
        "component": "Cast Impeller",
        "defect_type": "porosity",
        "severity_rating": "Critical",
        "localisation_heatmap_url": "/mock-heatmap-url.png",
        "root_cause_analysis": {
            "probable_cause": "abnormal casting temperature",
            "confidence_score": "89%",
            "batch_id": "B127",
            "machine_id": "M-04",
        },
        "recommended_action": "Inspect the temperature-control system before continuing production.",
    }


# ---------------------------------------------------------
# Standalone Model Testing Routes (Zero LLM / Gemini Dependency)
# ---------------------------------------------------------

@app.post("/test/classify")
@app.post("/test-classification")
async def test_classification(file: UploadFile = File(...)):
    """
    Standalone test route for the PyTorch classification model (Vision Model A: EfficientNet-B0).
    Evaluates a single impeller image directly using clf.pt without triggering the
    Gatekeeper, SHAP tabular risk, or Gemini 1.5 Flash incident reports.
    """
    t0 = time.perf_counter()
    try:
        content = await file.read()
        image = Image.open(io.BytesIO(content)).convert("RGB")
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not read or decode image file: {str(exc)}",
        )

    model = load_classifier()
    if model is None or clf_transform is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="PyTorch classification model (clf.pt) is not loaded or unavailable.",
        )

    try:
        tensor = clf_transform(image).unsqueeze(0)
        with torch.no_grad():
            logits = model(tensor)
            probs = torch.softmax(logits, dim=1).squeeze(0)
            p_ok = float(probs[0].item())
            p_defect = float(probs[1].item())
    except Exception as exc:
        logger.error(f"Classification inference failure: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Classification inference failed: {str(exc)}",
        )

    latency_ms = round((time.perf_counter() - t0) * 1000, 2)
    is_defect = p_defect >= 0.5
    confidence = p_defect if is_defect else p_ok

    return {
        "status": "success",
        "filename": file.filename,
        "image_dimensions": {"width": image.width, "height": image.height},
        "file_size_bytes": len(content),
        "prediction": "DEFECTIVE" if is_defect else "OK",
        "verdict": "confirmed_defect" if is_defect else "normal",
        "probabilities": {
            "defect": round(p_defect, 4),
            "ok": round(p_ok, 4),
        },
        "confidence_score": round(confidence, 4),
        "threshold": 0.5,
        "latency_ms": latency_ms,
        "pipeline_info": {
            "model": "Vision Model A: EfficientNet-B0",
            "weights_file": "models/classification/clf.pt",
            "gemini_bypassed": True,
        },
    }


@app.post("/test/classify-batch")
@app.post("/test-classification-batch")
async def test_classification_batch(files: List[UploadFile] = File(...)):
    """
    Batch standalone test route for evaluating multiple images concurrently
    through the PyTorch EfficientNet-B0 model (No Gemini calls).
    """
    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No files provided for batch classification.",
        )

    model = load_classifier()
    if model is None or clf_transform is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="PyTorch classification model (clf.pt) is not loaded or unavailable.",
        )

    t0 = time.perf_counter()
    results = []

    for idx, file in enumerate(files):
        try:
            content = await file.read()
            image = Image.open(io.BytesIO(content)).convert("RGB")
            tensor = clf_transform(image).unsqueeze(0)
            with torch.no_grad():
                logits = model(tensor)
                probs = torch.softmax(logits, dim=1).squeeze(0)
                p_ok = float(probs[0].item())
                p_defect = float(probs[1].item())

            is_defect = p_defect >= 0.5
            results.append({
                "index": idx,
                "filename": file.filename,
                "prediction": "DEFECTIVE" if is_defect else "OK",
                "probabilities": {
                    "defect": round(p_defect, 4),
                    "ok": round(p_ok, 4),
                },
                "confidence": round(p_defect if is_defect else p_ok, 4),
            })
        except Exception as exc:
            results.append({
                "index": idx,
                "filename": file.filename,
                "error": str(exc),
            })

    total_latency_ms = round((time.perf_counter() - t0) * 1000, 2)
    defects_count = sum(1 for r in results if r.get("prediction") == "DEFECTIVE")

    return {
        "status": "success",
        "total_images": len(files),
        "defects_detected": defects_count,
        "results": results,
        "total_latency_ms": total_latency_ms,
        "average_latency_ms": round(total_latency_ms / len(files), 2) if files else 0,
        "gemini_bypassed": True,
    }

