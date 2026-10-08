import os
import joblib
import numpy as np
from datetime import datetime, timezone
from pathlib import Path

MODEL_PATH = Path(__file__).resolve().parent / "models" / "model3_xgboost.pkl"

# Defect signature targets derived from domain physics
SIGNATURE_TARGETS = {
    "ok": {
        "mold_temp": 685.0, "injection_pressure": 142.0, "cooling_rate": 12.0,
        "vibration": 1.2, "machine_speed": 1200, "humidity": 42.0
    },
    "porosity": {
        "mold_temp": 742.0, "injection_pressure": 118.0, "cooling_rate": 8.2,
        "vibration": 1.1, "machine_speed": 1190, "humidity": 44.0
    },
    "crack": {
        "mold_temp": 620.0, "injection_pressure": 178.0, "cooling_rate": 26.4,
        "vibration": 2.4, "machine_speed": 1210, "humidity": 41.5
    },
    "deformation": {
        "mold_temp": 715.0, "injection_pressure": 128.0, "cooling_rate": 9.0,
        "vibration": 1.9, "machine_speed": 1480, "humidity": 39.0
    },
    "scratch": {
        "mold_temp": 682.0, "injection_pressure": 140.0, "cooling_rate": 12.1,
        "vibration": 4.8, "machine_speed": 1360, "humidity": 43.0
    },
    "corrosion": {
        "mold_temp": 650.0, "injection_pressure": 141.0, "cooling_rate": 11.5,
        "vibration": 1.1, "machine_speed": 980, "humidity": 84.0
    }
}

ROOT_CAUSE_MAPPINGS = {
    "mold_temp": "Melt / mold temperature variance outside permissible thermal tolerance",
    "injection_pressure": "Hydraulic ram injection / pack pressure fluctuation",
    "cooling_rate": "Coolant loop flow or quench timing deviation causing thermal stress",
    "vibration": "Excessive mechanical chatter on transfer tracks or spindle runout",
    "machine_speed": "Conveyor cadence / cycle cadence mismatch",
    "humidity": "Condensation or rinse drying tunnel moisture trap saturation"
}

DEFAULT_STDEVS = {
    "mold_temp": 4.5,
    "injection_pressure": 3.0,
    "cooling_rate": 0.8,
    "vibration": 0.15,
    "machine_speed": 25.0,
    "humidity": 2.5
}

DEFAULT_FEATURES = [
    "mold_temp", "injection_pressure", "cooling_rate",
    "vibration", "machine_speed", "humidity"
]

DEFAULT_CLASSES = ["ok", "porosity", "crack", "deformation", "scratch", "corrosion"]


def _init_bundle():
    """Loads the Model 3 XGBoost bundle, or trains and persists one if missing."""
    global model, features, classes, baselines, stdevs
    if MODEL_PATH.exists():
        try:
            bundle = joblib.load(MODEL_PATH)
            return (
                bundle["model"],
                bundle["features"],
                bundle["classes"],
                bundle["baselines"],
                bundle["stdevs"]
            )
        except Exception as err:
            pass

    # Fallback/bootstrap training from domain physics SIGNATURE_TARGETS
    feats = DEFAULT_FEATURES
    cls_list = DEFAULT_CLASSES
    base = SIGNATURE_TARGETS["ok"]
    stds = DEFAULT_STDEVS

    try:
        from xgboost import XGBClassifier
        X_train = []
        y_train = []
        for c_idx, c_name in enumerate(cls_list):
            target = SIGNATURE_TARGETS.get(c_name, base)
            for _ in range(80):
                sample = [float(np.random.normal(target[f], stds[f])) for f in feats]
                X_train.append(sample)
                y_train.append(c_idx)

        clf = XGBClassifier(
            n_estimators=40,
            max_depth=4,
            eval_metric="mlogloss",
            random_state=42
        )
        clf.fit(np.array(X_train), np.array(y_train))
        trained_model = clf

        MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
        bundle = {
            "model": trained_model,
            "features": feats,
            "classes": cls_list,
            "baselines": base,
            "stdevs": stds
        }
        joblib.dump(bundle, MODEL_PATH)
        return trained_model, feats, cls_list, base, stds
    except Exception:
        # Distance-based probabilistic fallback
        class HeuristicModel:
            def predict_proba(self, X):
                scores = []
                for c_name in cls_list:
                    tgt = np.array([SIGNATURE_TARGETS[c_name][f] for f in feats])
                    s = np.array([stds[f] for f in feats])
                    dist = np.sum(((X[0] - tgt) / s) ** 2)
                    scores.append(-dist / 2.0)
                scores = np.array(scores)
                exp_scores = np.exp(scores - np.max(scores))
                return [exp_scores / np.sum(exp_scores)]

        return HeuristicModel(), feats, cls_list, base, stds


# Initialize Model 3 bundle attributes
model, features, classes, baselines, stdevs = _init_bundle()


def generate_batch_telemetry(defect_type: str) -> dict:
    """Simulates real-world SCADA/PLC sensor output based on the visual classification."""
    target = SIGNATURE_TARGETS.get(defect_type.lower(), SIGNATURE_TARGETS["ok"])
    telemetry = {}
    for feat in features:
        mean_val = target[feat]
        std_val = stdevs[feat]
        val = np.random.normal(mean_val, std_val)
        telemetry[feat] = int(val) if feat == "machine_speed" else round(float(val), 2)
    return telemetry


def diagnose_telemetry(telemetry: dict) -> dict:
    """Runs Model 3 (XGBoost) and isolates the primary culprit sensor."""
    # 1. Inference via XGBoost
    input_vector = np.array([[telemetry[f] for f in features]])
    probs = model.predict_proba(input_vector)[0]
    pred_idx = int(np.argmax(probs))
    predicted_class = classes[pred_idx]
    confidence = float(probs[pred_idx])

    # 2. Compute Z-score feature drift relative to nominal baseline
    z_scores = {
        feat: abs(telemetry[feat] - baselines[feat]) / stdevs[feat]
        for feat in features
    }
    primary_sensor = max(z_scores, key=z_scores.get)

    return {
        "predicted_cause_defect": predicted_class,
        "confidence_score": round(confidence, 3),
        "primary_culprit_sensor": primary_sensor,
        "z_score_deviation": round(z_scores[primary_sensor], 2),
        "diagnostic_explanation": ROOT_CAUSE_MAPPINGS.get(primary_sensor, "Nominal process parameters"),
        "cause": primary_sensor,
        "action": ROOT_CAUSE_MAPPINGS.get(primary_sensor, "Nominal process parameters"),
    }
