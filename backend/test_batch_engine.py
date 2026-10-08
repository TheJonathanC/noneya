from batch_engine import evaluate_batch
from telemetry_bridge import generate_batch_telemetry


def mk(d):
    return {
        "status": "OK" if d == "ok" else "DEFECTIVE",
        "defect_type": d,
        "telemetry": generate_batch_telemetry(d),
    }


SCENARIOS = {
    "all good": ["ok"] * 5,
    "one porosity": ["ok", "ok", "ok", "ok", "porosity"],
    "crack + porosity": ["crack", "porosity", "ok", "ok", "ok"],
    "all defective": ["porosity", "deformation", "scratch", "porosity", "corrosion"],
}

for name, parts in SCENARIOS.items():
    r = evaluate_batch([mk(d) for d in parts])
    print(f"{name:18} -> {r['verdict']} (risk {r['prediction']['next_batch_risk']})")
    for f in r["fixes"]:
        print("    fix:", f["instruction"])
