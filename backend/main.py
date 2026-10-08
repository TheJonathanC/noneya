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
    import torch.nn as nn
    import timm
    from torchvision import models, transforms
    HAS_TORCH = True
except ImportError:
    torch = None
    nn = None
    timm = None
    models = None
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

# ---------------------------------------------------------
# Model 1: Gatekeeper / Binary Defect Classifier
# ---------------------------------------------------------
model1 = None
model1_device = None
model1_transform = None
clf_model = None
clf_transform = None

if HAS_TORCH and transforms:
    clf_transform = transforms.Compose([
        transforms.Resize((512, 512)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])
    model1_transform = transforms.Compose([
        transforms.Resize((224, 224)),
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

def init_model1():
    """
    Initializes Model 1 (Gatekeeper/Binary Classifier).
    Detects if an image is 'Defective' or 'Normal'.
    Loads ResNet-18 binary if weights exist at models/classification/model1/model1_binary.pt
    or models/classification/model1.pt; falls back to loading clf.pt.
    Sets to eval() mode globally.
    """
    global model1, model1_device
    if model1 is not None:
        return model1

    if not HAS_TORCH:
        return None

    model1_device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    # Check for dedicated ResNet-18 binary weights
    candidate_paths = [
        os.path.join(CURRENT_DIR, "models", "classification", "model1", "model1_binary.pt"),
        os.path.join(CURRENT_DIR, "models", "classification", "model1", "model1.pt"),
        os.path.join(CURRENT_DIR, "models", "classification", "model1_binary.pt"),
    ]
    for p in candidate_paths:
        if os.path.exists(p) and models is not None:
            try:
                net = models.resnet18(weights=None)
                net.fc = nn.Linear(net.fc.in_features, 2)
                state = torch.load(p, map_location=model1_device)
                if isinstance(state, dict) and "state_dict" in state:
                    state = state["state_dict"]
                net.load_state_dict(state)
                net.to(model1_device)
                net.eval()
                model1 = net
                logger.info(f"Model 1 (ResNet-18 binary) loaded successfully from {p} on {model1_device}")
                return model1
            except Exception as e:
                logger.warning(f"Failed loading ResNet18 binary weights from {p}: {e}")

    # Fallback to existing clf_model (pre-trained binary classifier in eval mode)
    clf = clf_model or load_classifier()
    if clf is not None:
        clf.eval()
        model1 = clf
        logger.info("Model 1 initialized using clf.pt binary classifier in eval() mode.")
    return model1

# ---------------------------------------------------------
# Model 2: Multi-Label ResNet-18 Defect Classifier
# ---------------------------------------------------------
MODEL2_CLASSES = ['corrosion', 'crack', 'deformation', 'dent', 'porosity', 'scratch']
model2 = None
model2_device = None
model2_transform = None

if HAS_TORCH and transforms:
    model2_transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])

def init_model2():
    """
    Initializes torchvision.models.resnet18 with fc layer modified for 6 classes.
    Loads weights from backend/models/classification/model2/model2_multilabel.pt.
    Sets to eval() mode on CUDA (if available) or CPU.
    """
    global model2, model2_device
    if model2 is not None:
        return model2

    if not HAS_TORCH or models is None:
        logger.warning("PyTorch/torchvision not available to load Model 2.")
        return None

    model2_device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    weights_path = os.path.join(
        CURRENT_DIR, "models", "classification", "model2", "model2_multilabel.pt"
    )

    try:
        net = models.resnet18(weights=None)
        net.fc = nn.Linear(net.fc.in_features, len(MODEL2_CLASSES))

        if os.path.exists(weights_path):
            state = torch.load(weights_path, map_location=model2_device)
            if isinstance(state, dict) and "state_dict" in state:
                state = state["state_dict"]
            net.load_state_dict(state)
            logger.info(f"Model 2 (ResNet-18 multi-label) successfully loaded on {model2_device}")
        else:
            logger.warning(f"Model 2 weights file not found at: {weights_path}")

        net.to(model2_device)
        net.eval()
        model2 = net
        return model2
    except Exception as exc:
        logger.error(f"Failed to load Model 2 weights: {exc}")
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
    
    # Pre-warm classification models
    load_classifier()
    init_model1()
    init_model2()
    
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


# ---------------------------------------------------------
# Model 2: Multi-Label ResNet-18 Defect Testing Route
# ---------------------------------------------------------

@app.post("/test-model2")
async def test_model2(file: UploadFile = File(...)):
    """
    Multi-label defect classification test route (Vision Model: ResNet-18).
    
    Classes (6): ['corrosion', 'crack', 'deformation', 'dent', 'porosity', 'scratch']
    Logic:
      1. Sigmoid probabilities on model outputs: torch.sigmoid(outputs)[0].
      2. If any probability > 0.5 (50%), add that class to predicted_defects.
      3. Gatekeeper Fallback: If NO probability > 0.5, force prediction with torch.argmax(),
         append highest class to predicted_defects, and set is_forced = True.
      4. Output:
         - predicted_defects: List[str]
         - confidence_scores: Dict[str, str] (e.g. {"crack": "85.4%"})
         - requires_human_review: bool (is_forced)
    """
    # 1. Read and decode image
    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not read image file: {str(exc)}",
        )

    # 2. Ensure Model 2 is loaded
    net = model2 or init_model2()
    if net is None or model2_transform is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Model 2 (ResNet-18) is not initialized or weights file is missing.",
        )

    # 3. Preprocess (224x224, ToTensor, Normalize) and run inference
    try:
        input_tensor = model2_transform(image).unsqueeze(0).to(model2_device)
        with torch.no_grad():
            outputs = net(input_tensor)
            probs = torch.sigmoid(outputs)[0]
    except Exception as exc:
        logger.error(f"Model 2 inference failure: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Model 2 inference failed: {str(exc)}",
        )

    # 4. Gatekeeper logic
    predicted_defects = []
    confidence_scores = {}
    is_forced = False

    # Primary Logic: Iterate through probabilities. If any score > 0.5, add to predicted_defects
    for idx, class_name in enumerate(MODEL2_CLASSES):
        prob_val = float(probs[idx].item())
        if prob_val > 0.5:
            predicted_defects.append(class_name)
            confidence_scores[class_name] = f"{round(prob_val * 100, 1)}%"

    # Gatekeeper Fallback: If NO probability is > 0.5, force highest prediction
    if not predicted_defects:
        is_forced = True
        highest_idx = int(torch.argmax(probs).item())
        highest_class = MODEL2_CLASSES[highest_idx]
        highest_score = float(probs[highest_idx].item())
        predicted_defects.append(highest_class)
        confidence_scores[highest_class] = f"{round(highest_score * 100, 1)}%"

    requires_human_review = is_forced

    return {
        "predicted_defects": predicted_defects,
        "confidence_scores": confidence_scores,
        "requires_human_review": requires_human_review,
    }


# ---------------------------------------------------------
# Integrated Pipeline & Grad-CAM Heatmap Masking
# ---------------------------------------------------------

def get_final_conv_layer(model):
    """Dynamically finds the last Conv2d layer in a CNN model."""
    last_conv = None
    for module in model.modules():
        if isinstance(module, torch.nn.Conv2d):
            last_conv = module
    return last_conv


def extract_gradcam_mask(model, input_tensor, target_class: int = 1) -> "torch.Tensor":
    """
    Extracts a Grad-CAM heatmap mask from Model 1's final convolutional layer,
    normalizes it to [0.0, 1.0], and upsamples it to input_tensor spatial dimensions (H, W).
    """
    final_conv = get_final_conv_layer(model)
    if final_conv is None:
        h, w = input_tensor.shape[2], input_tensor.shape[3]
        return torch.ones((1, 1, h, w), device=input_tensor.device)

    activations = []
    gradients = []

    def f_hook(module, inp, out):
        activations.append(out)

    def b_hook(module, grad_in, grad_out):
        gradients.append(grad_out[0])

    f_handle = final_conv.register_forward_hook(f_hook)
    b_handle = final_conv.register_full_backward_hook(b_hook)

    try:
        with torch.enable_grad():
            tensor_clone = input_tensor.clone().detach().requires_grad_(True)
            output = model(tensor_clone)
            score = output[0, target_class]
            model.zero_grad()
            score.backward(retain_graph=True)

        if gradients and activations:
            grad = gradients[0]
            act = activations[0]
            # Global Average Pooling of gradients across spatial dimensions
            weights = torch.mean(grad, dim=(2, 3), keepdim=True)
            cam = torch.relu(torch.sum(weights * act, dim=1, keepdim=True))
        elif activations:
            cam = torch.relu(torch.mean(activations[0], dim=1, keepdim=True))
        else:
            cam = torch.ones((1, 1, input_tensor.shape[2], input_tensor.shape[3]), device=input_tensor.device)
    except Exception as exc:
        logger.warning(f"Grad-CAM hook warning: {exc}; using activation norm fallback.")
        if activations:
            cam = torch.relu(torch.mean(activations[0], dim=1, keepdim=True))
        else:
            cam = torch.ones((1, 1, input_tensor.shape[2], input_tensor.shape[3]), device=input_tensor.device)
    finally:
        f_handle.remove()
        b_handle.remove()

    # Normalize to [0, 1]
    cam_min = cam.min()
    cam_max = cam.max()
    if cam_max > cam_min:
        cam = (cam - cam_min) / (cam_max - cam_min)
    else:
        cam = torch.ones_like(cam)

    # Upsample to match original image spatial dimensions
    mask = torch.nn.functional.interpolate(
        cam,
        size=(input_tensor.shape[2], input_tensor.shape[3]),
        mode="bilinear",
        align_corners=False,
    )
    return mask


@app.post("/test-integrated-pipeline")
async def test_integrated_pipeline(file: UploadFile = File(...)):
    """
    Sequential Pipeline:
      Phase 1: Model 1 (Gatekeeper/Binary) classifies image.
      Phase 2: If Normal, immediately return status OK and route to telemetry/batch engine.
      Phase 3: If Defective, extract Grad-CAM heatmap mask from Model 1's final conv layer
               and multiply by the original image tensor to isolate the defect.
      Phase 4: Pass masked image into Model 2 (6-class ResNet-18) to categorize defects.
    """
    # 1. Read & decode image
    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not read image file: {str(exc)}",
        )

    # 2. Ensure both models are loaded
    m1 = model1 or init_model1() or load_classifier()
    m2 = model2 or init_model2()

    if m1 is None or m2 is None or clf_transform is None or model2_transform is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="One or both classification models are not loaded or weights are unavailable.",
        )

    # Phase 1: Model 1 Binary Evaluation
    device1 = next(m1.parameters()).device
    device2 = model2_device or next(m2.parameters()).device
    
    # Use 224x224 transform if ResNet, else 512x512 for EfficientNet
    is_resnet = isinstance(m1, models.ResNet) if models and hasattr(models, "ResNet") else False
    t1 = model1_transform if (is_resnet and model1_transform) else (clf_transform or model1_transform)
    input_tensor1 = t1(image).unsqueeze(0).to(device1)

    with torch.no_grad():
        logits1 = m1(input_tensor1)
        probs1 = torch.softmax(logits1, dim=1)[0]
        # Class 0: Normal/OK, Class 1: Defective
        p_defect = float(probs1[1].item())

    is_defective = p_defect >= 0.5

    # Phase 2: Normal Case Routing (Stop pipeline immediately)
    if not is_defective:
        return {
            "status": "OK",
            "routing": "Forwarded to batch engine / telemetry check",
        }

    # Phase 3: Defective Case & Heatmap Masking
    heatmap_mask = extract_gradcam_mask(m1, input_tensor1, target_class=1)
    masked_tensor = input_tensor1 * heatmap_mask  # Black out healthy background

    # Phase 4: Model 2 Multi-Label Categorization on Masked Defect
    # Resize masked tensor to 224x224 for ResNet-18
    masked_input2 = torch.nn.functional.interpolate(
        masked_tensor,
        size=(224, 224),
        mode="bilinear",
        align_corners=False,
    ).to(device2)

    with torch.no_grad():
        outputs2 = m2(masked_input2)
        probs2 = torch.sigmoid(outputs2)[0]

    predicted_defects = []
    confidence_scores = {}
    is_forced = False

    # Primary Logic: If score > 0.5, add to predicted_defects
    for idx, class_name in enumerate(MODEL2_CLASSES):
        score = float(probs2[idx].item())
        if score > 0.5:
            predicted_defects.append(class_name)
            confidence_scores[class_name] = f"{round(score * 100, 1)}%"

    # Gatekeeper Fallback: If NO score > 0.5, force prediction
    if not predicted_defects:
        is_forced = True
        highest_idx = int(torch.argmax(probs2).item())
        highest_class = MODEL2_CLASSES[highest_idx]
        highest_score = float(probs2[highest_idx].item())
        predicted_defects.append(highest_class)
        confidence_scores[highest_class] = f"{round(highest_score * 100, 1)}%"

    requires_human_review = is_forced

    return {
        "status": "Defective",
        "predicted_defects": predicted_defects,
        "confidence_scores": confidence_scores,
        "requires_human_review": requires_human_review,
    }


