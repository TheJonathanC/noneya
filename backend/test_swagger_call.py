import urllib.request
import urllib.error
import json
import io
from pathlib import Path

sample_path = Path("c:/Codes/Hackathon/noneya/backend/models/classification/image.jpeg")
with open(sample_path, "rb") as f:
    img_bytes = f.read()

boundary = "----SwaggerUITestBoundary12345"
body = io.BytesIO()

# 1. file=@cast_def_0_65.jpeg;type=image/jpeg
body.write(f"--{boundary}\r\n".encode())
body.write(b'Content-Disposition: form-data; name="file"; filename="cast_def_0_65.jpeg"\r\n')
body.write(b"Content-Type: image/jpeg\r\n\r\n")
body.write(img_bytes)
body.write(b"\r\n")

# 2. files=string (The Swagger UI default artifact that previously caused 422)
body.write(f"--{boundary}\r\n".encode())
body.write(b'Content-Disposition: form-data; name="files"\r\n\r\n')
body.write(b"string\r\n")
body.write(f"--{boundary}--\r\n".encode())

req = urllib.request.Request(
    "http://127.0.0.1:8000/api/inspect?batch_id=BATCH-2026-X89",
    data=body.getvalue(),
    headers={"Content-Type": f"multipart/form-data; boundary={boundary}", "accept": "*/*"},
    method="POST",
)

try:
    with urllib.request.urlopen(req, timeout=15) as resp:
        print(">>> HTTP STATUS:", resp.status)
        data = json.loads(resp.read().decode("utf-8"))
        print(">>> BATCH ID:", data.get("batch_id"))
        print(">>> GATE DECISION:", data.get("gate_decision"))
        print(">>> PROCESSED PARTS:", data.get("processed_parts"))
        print(">>> DEFECTS COUNT:", data.get("defects_count"))
        print(">>> GATE STATUS:", json.dumps(data.get("gate_status"), indent=2))
        print(">>> SUPERVISOR SUMMARY:", data.get("supervisor_summary"))
        res0 = data["results"][0]
        print(">>> PART 1 DEFECT:", res0.get("defect_type"))
        print(">>> PART 1 PREDICTED CLASSES:", res0.get("predicted_defects"))
        print(">>> PART 1 SENSOR CULPRIT:", res0.get("root_cause_analysis", {}).get("primary_culprit_sensor"))
        print(">>> PART 1 HAS GRAD-CAM HEATMAP:", "vision_results" in res0 and res0["vision_results"] is not None)
        print("\n>>> TEST SUCCEEDED: 422 COMPLETELY RESOLVED!")
except urllib.error.HTTPError as e:
    print(">>> HTTP ERROR:", e.code, e.read().decode("utf-8"))
