from telemetry_bridge import generate_batch_telemetry, diagnose_telemetry, classes

hits = 0
total = 0
for true_cls in classes:
    ok = 0
    n = 50
    for _ in range(n):
        d = diagnose_telemetry(generate_batch_telemetry(true_cls))
        ok += d["predicted_cause_defect"] == true_cls
    hits += ok
    total += n
    print(f"{true_cls:12} accuracy {ok / n:.0%}")

print(f"overall      accuracy {hits / total:.0%}")

sample = generate_batch_telemetry("porosity")
print("\nsample sensors:", sample)
print("diagnosis     :", diagnose_telemetry(sample))
