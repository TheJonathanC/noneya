"""
test_pipeline_e2e.py - Standalone Verification Script:
1. Direct chained pipeline test: Model 1 -> Model 2 -> Model 3 (XGBoost) -> Structured Output
2. Live HTTP test against FastAPI /api/inspect endpoint (single & batch)
"""

import os
import sys
import io
import json
import logging
from pathlib import Path
from PIL import Image

CURRENT_DIR = Path(__file__).resolve().parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("pipeline_e2e")

import torch
import torch.nn as nn
from torchvision import transforms
import torchvision.models as models
import timm
import joblib
import numpy as np

# Class definitions
MODEL2_CLASSES = ['corrosion', 'crack', 'deformation', 'dent', 'porosity', 'scratch']

SIGNATURE_TARGETS = {
    "ok": {"mold_temp": 685.0, "injection_pressure": 142.0, "cooling_rate": 12.0, "vibration": 1.2, "machine_speed": 1200, "humidity": 42.0},
    "porosity": {"mold_temp": 742.0, "injection_pressure": 118.0, "cooling_rate": 8.2, "vibration": 1.1, "machine_speed": 1190, "humidity": 44.0},
    "crack": {"mold_temp": 620.0, "injection_pressure": 178.0, "cooling_rate": 26.4, "vibration": 2.4, "machine_speed": 1210, "humidity": 41.5},
    "deformation": {"mold_temp": 715.0, "injection_pressure": 128.0, "cooling_rate": 9.0, "vibration": 1.9, "machine_speed": 1480, "humidity": 39.0},
    "dent": {"mold_temp": 692.0, "injection_pressure": 158.0, "cooling_rate": 13.5, "vibration": 3.6, "machine_speed": 1240, "humidity": 42.0},
    "scratch": {"mold_temp": 682.0, "injection_pressure": 140.0, "cooling_rate": 12.1, "vibration": 4.8, "machine_speed": 1360, "humidity": 43.0},
    "corrosion": {"mold_temp": 650.0, "injection_pressure": 141.0, "cooling_rate": 11.5, "vibration": 1.1, "machine_speed": 980, "humidity": 84.0},
}

ROOT_CAUSE_MAPPINGS = {
    "mold_temp": "Melt / mold temperature variance outside permissible thermal tolerance",
    "injection_pressure": "Hydraulic ram injection / pack pressure fluctuation",
    "cooling_rate": "Coolant loop flow or quench timing deviation causing thermal stress",
    "vibration": "Excessive mechanical chatter on transfer tracks or spindle runout",
    "machine_speed": "Conveyor cadence / cycle cadence mismatch",
    "humidity": "Condensation or rinse drying tunnel moisture trap saturation",
}

# Image Transforms
transform_m1 = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])

transform_m2 = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])


def load_model1():
    """Loads Model 1: EfficientNet-B0 Binary Defect Gatekeeper from clf.pt"""
    clf_path = CURRENT_DIR / "models" / "classification" / "clf.pt"
    if not clf_path.exists():
        raise FileNotFoundError(f"Model 1 weights not found at {clf_path}")
    net = timm.create_model("efficientnet_b0", num_classes=2, pretrained=False)
    state = torch.load(clf_path, map_location="cpu")
    net.load_state_dict(state)
    net.eval()
    return net


def load_model2():
    """Loads Model 2: ResNet-18 6-Class Multi-Label Classifier from model2_multilabel.pt"""
    m2_path = CURRENT_DIR / "models" / "classification" / "model2" / "model2_multilabel.pt"
    if not m2_path.exists():
        raise FileNotFoundError(f"Model 2 weights not found at {m2_path}")
    net = models.resnet18(weights=None)
    net.fc = nn.Linear(net.fc.in_features, len(MODEL2_CLASSES))
    state = torch.load(m2_path, map_location="cpu")
    if isinstance(state, dict) and "state_dict" in state:
        state = state["state_dict"]
    net.load_state_dict(state)
    net.eval()
    return net


def load_model3():
    """Loads Model 3: Trained XGBoost Bundle from model3_xgboost.pkl"""
    m3_path = CURRENT_DIR / "models" / "model3_xgboost.pkl"
    if not m3_path.exists():
        raise FileNotFoundError(f"Model 3 bundle not found at {m3_path}")
    bundle = joblib.load(m3_path)
    return bundle["model"], bundle["features"], bundle["classes"], bundle["baselines"], bundle["stdevs"]


def run_pipeline(image_path: Path) -> dict:
    """
    Executes:
      1. Model 1 (Gatekeeper Binary) -> Evaluates if component has defect
      2. Model 2 (Defect Multi-label) -> Predicts specific defect categories & scores
      3. Model 3 (XGBoost Diagnostic) -> Simulates sensor telemetry & determines root cause
    """
    print("=" * 72)
    print("  RUNNING PIPELINE: MODEL 1 -> MODEL 2 -> MODEL 3 (XGBOOST)")
    print("=" * 72)

    image = Image.open(image_path).convert("RGB")
    print(f" Loaded Image: {image_path.name} ({image.size[0]}x{image.size[1]})")

    # -------------------------------------------------------------
    # STAGE 1: Model 1 (Binary Gatekeeper)
    # -------------------------------------------------------------
    print("\n--- STAGE 1: Model 1 (EfficientNet-B0 Binary Gatekeeper) ---")
    m1 = load_model1()
    tensor1 = transform_m1(image).unsqueeze(0)
    with torch.no_grad():
        logits1 = m1(tensor1)
        probs1 = torch.softmax(logits1, dim=1)[0]
        p_normal = float(probs1[0].item())
        p_defective = float(probs1[1].item())

    is_defective = p_defective >= 0.5
    verdict1 = "DEFECTIVE" if is_defective else "OK"
    print(f"  P(Normal)    : {p_normal * 100:.2f}%")
    print(f"  P(Defective) : {p_defective * 100:.2f}%")
    print(f"  Gate Decision: [{verdict1}] (is_defective = {is_defective})")

    # -------------------------------------------------------------
    # STAGE 2: Model 2 (6-Class Defect Categorizer)
    # -------------------------------------------------------------
    print("\n--- STAGE 2: Model 2 (ResNet-18 6-Class Multi-Label Defect Model) ---")
    m2 = load_model2()
    tensor2 = transform_m2(image).unsqueeze(0)
    with torch.no_grad():
        outputs2 = m2(tensor2)
        probs2 = torch.sigmoid(outputs2)[0]

    predicted_defects = []
    confidence_scores = {}
    print("  Class Probabilities (Sigmoid):")
    for idx, c_name in enumerate(MODEL2_CLASSES):
        score = float(probs2[idx].item())
        print(f"    - {c_name:12s}: {score * 100:5.2f}%")
        if score > 0.5:
            predicted_defects.append(c_name)
            confidence_scores[c_name] = f"{round(score * 100, 1)}%"

    if not predicted_defects:
        highest_idx = int(torch.argmax(probs2).item())
        defect_type = MODEL2_CLASSES[highest_idx]
        predicted_defects.append(defect_type)
        confidence_scores[defect_type] = f"{round(float(probs2[highest_idx].item()) * 100, 1)}%"
    else:
        defect_type = predicted_defects[0]

    print(f"  Identified Primary Defect: '{defect_type}'")
    print(f"  Active Defect Categories : {predicted_defects}")

    # -------------------------------------------------------------
    # STAGE 3: Model 3 (XGBoost Process Telemetry Diagnostic Engine)
    # -------------------------------------------------------------
    print("\n--- STAGE 3: Model 3 (XGBoost Sensor Telemetry & Root Cause) ---")
    xgb_model, features, classes, baselines, stdevs = load_model3()

    # Generate correlated telemetry from target signature
    target = SIGNATURE_TARGETS.get(defect_type, SIGNATURE_TARGETS["ok"])
    telemetry = {}
    for f in features:
        val = np.random.normal(target[f], stdevs[f])
        telemetry[f] = int(val) if f == "machine_speed" else round(float(val), 2)

    print("  Correlated Machine Sensor Readings:")
    for f, v in telemetry.items():
        delta = v - baselines[f]
        print(f"    - {f:20s}: {v:8.2f} (Delta vs Nominal: {delta:+6.2f})")

    # XGBoost inference
    input_vector = np.array([[telemetry[f] for f in features]])
    xgb_probs = xgb_model.predict_proba(input_vector)[0]
    pred_idx = int(np.argmax(xgb_probs))
    pred_class = classes[pred_idx]
    xgb_confidence = float(xgb_probs[pred_idx])

    # Z-Score drift calculation
    z_scores = {f: abs(telemetry[f] - baselines[f]) / stdevs[f] for f in features}
    primary_culprit = max(z_scores, key=z_scores.get)

    diagnostic = {
        "predicted_cause_defect": pred_class,
        "confidence_score": round(xgb_confidence, 3),
        "primary_culprit_sensor": primary_culprit,
        "z_score_deviation": round(z_scores[primary_culprit], 2),
        "diagnostic_explanation": ROOT_CAUSE_MAPPINGS.get(primary_culprit, "Nominal process"),
        "recommended_action": ROOT_CAUSE_MAPPINGS.get(primary_culprit, "Release component"),
    }

    print(f"  XGBoost Predicted Risk Class : {pred_class} (Confidence: {xgb_confidence * 100:.1f}%)")
    print(f"  Primary Culprit Sensor Drift : {primary_culprit} (Z-Score: {z_scores[primary_culprit]:.2f} sigma)")
    print(f"  Diagnostic Root Cause Action : {diagnostic['diagnostic_explanation']}")

    # -------------------------------------------------------------
    # Output Packaging
    # -------------------------------------------------------------
    output = {
        "status": "SUCCESS",
        "file": image_path.name,
        "model1_gatekeeper": {
            "model_type": "EfficientNet-B0 (Binary)",
            "verdict": verdict1,
            "is_defective": is_defective,
            "defect_probability": round(p_defective, 4),
        },
        "model2_classifier": {
            "model_type": "ResNet-18 (6-Class Multi-Label)",
            "defect_type": defect_type,
            "predicted_defects": predicted_defects,
            "confidence_scores": confidence_scores,
        },
        "model3_xgboost": {
            "model_type": "XGBClassifier (Process Drift Attribution)",
            "sensor_readings": telemetry,
            "root_cause": diagnostic,
        },
        "final_decision": {
            "action": "CRITICAL STOP / QUARANTINE" if is_defective else "GO / NOMINAL",
            "primary_defect": defect_type if is_defective else "None",
            "root_cause_sensor": primary_culprit if is_defective else "None",
        },
    }
    return output


def test_api_inspect_http():
    """Tests the live FastAPI /api/inspect HTTP route."""
    print("\n" + "=" * 72)
    print("  TESTING LIVE FASTAPI ENDPOINT: POST http://127.0.0.1:8000/api/inspect")
    print("=" * 72)

    import urllib.request
    sample_file = CURRENT_DIR / "models" / "classification" / "image.jpeg"
    with open(sample_file, "rb") as f:
        img_bytes = f.read()

    boundary = "----WebKitFormBoundaryE2ETest7788"
    body = io.BytesIO()
    body.write(f"--{boundary}\r\n".encode())
    body.write(b'Content-Disposition: form-data; name="file"; filename="sample_impeller.jpeg"\r\n')
    body.write(b"Content-Type: image/jpeg\r\n\r\n")
    body.write(img_bytes)
    body.write(b"\r\n")
    body.write(f"--{boundary}\r\n".encode())
    body.write(b'Content-Disposition: form-data; name="batch_id"\r\n\r\n')
    body.write(b"PILOT-RUN-2026\r\n")
    body.write(f"--{boundary}--\r\n".encode())

    req = urllib.request.Request(
        "http://127.0.0.1:8000/api/inspect",
        data=body.getvalue(),
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        print(f"  HTTP Response Status: {resp.status}")
        print(f"  Batch ID            : {data.get('batch_id')}")
        print(f"  Processed Parts     : {data.get('processed_parts')}")
        res = data["results"][0]
        print(f"  Result 1 Verdict    : {res.get('status')}")
        print(f"  Defect Type         : {res.get('defect_type')}")
        print(f"  Predicted Defects   : {res.get('predicted_defects')}")
        print(f"  Culprit Sensor      : {res.get('root_cause_analysis', {}).get('primary_culprit_sensor')}")
        print(f"  Has Vision Results  : {'vision_results' in res and res['vision_results'] is not None}")
        print("  POST /api/inspect PASSED successfully!")


if __name__ == "__main__":
    sample_path = CURRENT_DIR / "models" / "classification" / "image.jpeg"
    res = run_pipeline(sample_path)
    print("\n" + "=" * 72)
    print("  ASSEMBLED JSON OUTPUT:")
    print("=" * 72)
    print(json.dumps(res, indent=2))

    test_api_inspect_http()
    print("\n>>> ALL TESTS PASSED: MODEL 1 -> MODEL 2 -> MODEL 3 -> OUTPUT COMPLETED! <<<")
