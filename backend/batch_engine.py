"""
Batch Engine
------------
Consumes every per-part result (Model 1 -> Model 2 -> Model 3 -> LLM grooming),
compares batch telemetry against historical baselines and returns:

  * verdict   : OK | WARNING | CRITICAL STOP
  * review    : detailed written review of the batch
  * prediction: what is likely to happen next and how likely
  * fixes     : concrete setpoint changes (temperature, pressure, ...)
"""

from typing import Any, Dict, List, Optional

import numpy as np

from telemetry_bridge import baselines, stdevs, features, SIGNATURE_TARGETS

SENSOR_META = {
    "mold_temp": ("Mold temperature", "C"),
    "injection_pressure": ("Injection pressure", "bar"),
    "cooling_rate": ("Cooling rate", "C/s"),
    "vibration": ("Vibration", "mm/s"),
    "machine_speed": ("Machine speed", "units/h"),
    "humidity": ("Humidity", "%RH"),
}

DRIFT_WARN_SIGMA = 2.0
DRIFT_CRITICAL_SIGMA = 5.0
CRITICAL_DEFECT_RATE = 0.4
CRITICAL_DEFECTS = {"crack"}

INDICATORS = {
    "OK": {
        "level": 1,
        "color": "green",
        "label": "OK",
        "meaning": "Pass. Release the next batch.",
    },
    "WARNING": {
        "level": 2,
        "color": "amber",
        "label": "WARNING",
        "meaning": "Defect or drift found. Apply the suggested fixes, then re-run.",
    },
    "CRITICAL STOP": {
        "level": 3,
        "color": "red",
        "label": "CRITICAL STOP",
        "meaning": "Worst case. Line halted, an engineer must analyse.",
    },
}


def _sensor_table(parts: List[Dict[str, Any]]) -> Dict[str, Dict[str, float]]:
    """Mean of each sensor across the given parts versus the historical baseline."""
    table: Dict[str, Dict[str, float]] = {}
    for feat in features:
        vals = [p["telemetry"][feat] for p in parts if p.get("telemetry") and feat in p["telemetry"]]
        if not vals:
            continue
        mean = float(np.mean(vals))
        base = float(baselines[feat])
        sd = float(stdevs[feat])
        z = (mean - base) / sd
        name, unit = SENSOR_META.get(feat, (feat, ""))
        table[feat] = {
            "label": name,
            "unit": unit,
            "batch_mean": round(mean, 2),
            "baseline": round(base, 2),
            "stdev": round(sd, 2),
            "z": round(z, 2),
            "delta_to_baseline": round(base - mean, 2),
        }
    return table


def _fix_text(feat: str, row: Dict[str, float]) -> str:
    direction = "Decrease" if row["delta_to_baseline"] < 0 else "Increase"
    return (
        f"{direction} {row['label'].lower()} by {abs(row['delta_to_baseline']):g} {row['unit']} "
        f"(from {row['batch_mean']:g} to {row['baseline']:g} {row['unit']})"
    )


def evaluate_batch(
    batch_results: List[Dict[str, Any]],
    historical_defects: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    batch_results      : per-part dicts (status, defect_type, telemetry, ...)
    historical_defects : classified_defect labels from earlier batches (e.g. Mongo)
    """
    valid = [r for r in batch_results if r.get("status") in ("OK", "DEFECTIVE")]
    errors = len(batch_results) - len(valid)
    total = len(valid)
    defective = [r for r in valid if r["status"] == "DEFECTIVE"]
    good = [r for r in valid if r["status"] == "OK"]
    n_def = len(defective)
    defect_rate = n_def / total if total else 0.0

    # Defect mix
    mix: Dict[str, int] = {}
    for r in defective:
        mix[r.get("defect_type", "unknown")] = mix.get(r.get("defect_type", "unknown"), 0) + 1

    # Telemetry: the fault signature comes from defective parts, otherwise whole batch drift
    focus_parts = defective if defective else valid
    sensors = _sensor_table(focus_parts)
    ranked = sorted(sensors.items(), key=lambda kv: abs(kv[1]["z"]), reverse=True)
    max_z = abs(ranked[0][1]["z"]) if ranked else 0.0
    drifting = [(f, row) for f, row in ranked if abs(row["z"]) >= DRIFT_WARN_SIGMA]

    # Historical comparison
    hist = historical_defects or []
    hist_rate = None
    if hist:
        hist_rate = sum(1 for h in hist if h and h != "ok") / len(hist)

    # Verdict
    reasons: List[str] = []
    critical_hit = [d for d in mix if d in CRITICAL_DEFECTS]
    if critical_hit:
        reasons.append(f"critical defect type present: {', '.join(critical_hit)}")
    if total and defect_rate >= CRITICAL_DEFECT_RATE:
        reasons.append(f"defect rate {defect_rate:.0%} is at or above {CRITICAL_DEFECT_RATE:.0%}")
    if hist_rate is not None and n_def > 0 and defect_rate >= max(2 * hist_rate, 0.2) and n_def >= 2:
        reasons.append(f"defect rate is more than double the historical {hist_rate:.0%}")

    if total == 0:
        verdict = "CRITICAL STOP"
        reasons.append("no part could be analysed")
    elif reasons:
        verdict = "CRITICAL STOP"
    elif n_def > 0 or drifting:
        verdict = "WARNING"
        if n_def:
            reasons.append(f"{n_def} of {total} part(s) defective")
        if drifting:
            reasons.append("process drift beyond 2 sigma: " + ", ".join(f for f, _ in drifting))
    else:
        verdict = "OK"
        reasons.append("all parts passed and telemetry sits within 2 sigma of the baseline")

    # Fix suggestions
    fixes: List[Dict[str, Any]] = []
    if verdict != "OK":
        for feat, row in drifting:
            if feat == "vibration" and row["z"] < 0:
                continue  # lower vibration is never a fault
            if len(fixes) >= 4:
                break
            fixes.append({
                "sensor": feat,
                "label": row["label"],
                "unit": row["unit"],
                "current": row["batch_mean"],
                "target": row["baseline"],
                "change": row["delta_to_baseline"],
                "z": row["z"],
                "instruction": _fix_text(feat, row),
            })

    # Prediction
    if verdict == "OK":
        risk = min(0.1, max_z / 40.0)
        prediction = "Next batch is expected to run clean if setpoints stay unchanged."
    elif verdict == "WARNING":
        risk = min(0.75, 0.25 + 0.15 * len(drifting) + 0.1 * n_def)
        if fixes:
            top = fixes[0]
            prediction = (
                f"Defects will likely repeat unless {top['label'].lower()} returns to "
                f"{top['target']:g} {top['unit']}. Expected defect rate after the fix: under 5%."
            )
        else:
            prediction = "Isolated defect with no clear process cause. Re-inspect the next batch closely."
    else:
        risk = min(0.99, 0.8 + 0.04 * n_def)
        prediction = "Further production would very likely scrap more parts. Hold the line until an engineer clears it."

    # Nearest known defect signature for the batch drift
    signature = None
    if focus_parts and sensors:
        best, best_d = None, 1e9
        for name, tgt in SIGNATURE_TARGETS.items():
            d = sum(((sensors[f]["batch_mean"] - tgt[f]) / stdevs[f]) ** 2 for f in sensors)
            if d < best_d:
                best, best_d = name, d
        signature = best

    indicator = INDICATORS[verdict]
    mix_text = ", ".join(f"{k} x{v}" for k, v in mix.items()) or "none"
    review = (
        f"{total} part(s) analysed ({len(good)} OK, {n_def} defective"
        f"{f', {errors} unreadable' if errors else ''}). Defect mix: {mix_text}. "
        f"Largest telemetry drift: "
        + (f"{ranked[0][1]['label'].lower()} at {ranked[0][1]['z']:+.1f} sigma. " if ranked else "n/a. ")
        + (f"Historical defect rate is {hist_rate:.0%}. " if hist_rate is not None else "")
        + ("Reason: " + "; ".join(reasons) + ".")
    )

    return {
        "verdict": verdict,
        "indicator": indicator,
        "review": review,
        "reasons": reasons,
        "prediction": {
            "text": prediction,
            "next_batch_risk": round(risk, 2),
            "closest_signature": signature,
        },
        "fixes": fixes,
        "stats": {
            "total": total,
            "ok": len(good),
            "defective": n_def,
            "unreadable": errors,
            "defect_rate": round(defect_rate, 3),
            "historical_defect_rate": None if hist_rate is None else round(hist_rate, 3),
            "defect_mix": mix,
            "max_drift_sigma": round(max_z, 2),
        },
        "sensor_analysis": sensors,
    }
