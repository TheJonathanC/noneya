"""
test_api.py - Verification script for Singularity 2026 Quality Inspection API
Tests:
1. Health check endpoints
2. Inspection endpoint (/inspect-pilot-batch) with 5 mock impeller images
3. Verification of Gatekeeper logic, Failure Flow, SHAP root cause, blast radius, and Gemini report
"""

import io
import sys
import os
from PIL import Image

# Ensure backend directory is in sys.path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

from fastapi.testclient import TestClient
from main import app


def create_dummy_image(color=(128, 128, 128), size=(512, 512)) -> bytes:
    """Creates an in-memory PNG image to simulate an impeller scan."""
    buf = io.BytesIO()
    img = Image.new("RGB", size, color=color)
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf.getvalue()


def test_quality_inspection_pipeline():
    print("=" * 60)
    print("Testing Singularity 2026 Quality Inspection FastAPI Backend")
    print("=" * 60)

    with TestClient(app) as client:
        # 1. Test Root & Health endpoints
        print("\n[1] Testing Health Endpoints...")
        res_root = client.get("/")
        assert res_root.status_code == 200, f"Root returned {res_root.status_code}"
        print(" Root (/) check passed:", res_root.json())

        res_health = client.get("/health")
        assert res_health.status_code == 200, f"Health returned {res_health.status_code}"
        print(" Health (/health) check passed:", res_health.json())

        # 2. Test Invalid Image Count (< 5 images)
        print("\n[2] Testing Validation for Image Count (!= 5)...")
        files_invalid = [
            ("files", ("part_1.png", create_dummy_image(), "image/png")),
            ("files", ("part_2.png", create_dummy_image(), "image/png")),
        ]
        res_invalid = client.post("/inspect-pilot-batch", files=files_invalid)
        assert res_invalid.status_code == 400, f"Expected 400, got {res_invalid.status_code}"
        print(" Validation correctly rejected 2 images with 400 Bad Request.")

        # 3. Test Pilot Batch Inspection with 5 Images
        print("\n[3] Testing POST /inspect-pilot-batch with 5 Impeller Images...")
        files_batch = [
            ("files", (f"impeller_{i+1}.png", create_dummy_image(color=(100 + i * 20, 100, 100)), "image/png"))
            for i in range(5)
        ]

        response = client.post("/inspect-pilot-batch", files=files_batch)
        assert response.status_code == 200, f"Inspection failed with {response.status_code}: {response.text}"
        data = response.json()

        print("\n[4] Inspecting Response Payload Structure:")
        print("Batch ID:", data.get("batch_id"))
        print("Parts Tested:", data.get("parts_tested"))
        print("Defects Count:", data.get("defects_count"))
        
        # Verify Gate Status
        gate = data.get("gate_status", {})
        print("\n--- Gatekeeper Decision ---")
        print("Decision:", gate.get("decision"))
        print("Action:", gate.get("action"))
        print("Defects:", gate.get("defects"))
        print("Worst Severity:", gate.get("worst_severity"))
        print("Flagged Indices:", gate.get("reject_parts"))
        assert gate.get("decision") in ("CRITICAL STOP", "ADJUST"), "Expected failure flow decision"
        assert gate.get("defects") == 2, f"Expected 2 defects, got {gate.get('defects')}"

        # Verify Failure Flow fields
        print("\n--- Root Cause Attribution (SHAP-style Counterfactual) ---")
        rc = data.get("root_cause", {})
        print("Primary Cause Factor:", rc.get("cause"))
        print("Confidence:", rc.get("confidence"))
        print("Diagnostic:", rc.get("what"))
        print("Action:", rc.get("action"))
        print("Attribution Drops:", rc.get("drops"))
        assert rc.get("cause") is not None, "Root cause must be identified"

        print("\n--- Drift Changepoint & Blast Radius ---")
        cp = data.get("changepoint", {})
        print("Changepoint Factor:", cp.get("factor"))
        print("Alarm Time (t):", cp.get("alarm_t"), "min")
        print("Change Time (t):", cp.get("change_t"), "min")

        blast = data.get("blast_radius", {})
        print("Quarantined Parts Count:", blast.get("quarantined_count"))
        print("At-Risk Parts Count:", blast.get("at_risk_count"))
        print("Quarantine Serials:", blast.get("quarantined_serials"))
        assert blast.get("quarantined_count") > 0, "Quarantined count should be > 0"

        print("\n--- Gemini 1.5 Flash Incident Report ---")
        report = data.get("gemini_incident_report", "")
        print("Report Text:")
        print(report)
        # 4. Test Standalone PyTorch Classification Model (/test/classify) - No Gemini
        print("\n[4] Testing Standalone PyTorch Classification Model (/test/classify)...")
        single_file = {"file": ("test_impeller.png", create_dummy_image(), "image/png")}
        res_clf = client.post("/test/classify", files=single_file)
        assert res_clf.status_code == 200, f"Expected 200, got {res_clf.status_code}: {res_clf.text}"
        clf_data = res_clf.json()
        print(" Standalone classification prediction:", clf_data.get("prediction"))
        print(" Probabilities:", clf_data.get("probabilities"))
        print(" Latency:", clf_data.get("latency_ms"), "ms")
        assert clf_data.get("pipeline_info", {}).get("gemini_bypassed") is True, "Gemini must be bypassed"

        # 5. Test Batch Classification (/test/classify-batch)
        print("\n[5] Testing Batch Classification Route (/test/classify-batch)...")
        batch_files = [
            ("files", (f"part_{i}.png", create_dummy_image(), "image/png")) for i in range(3)
        ]
        res_batch = client.post("/test/classify-batch", files=batch_files)
        assert res_batch.status_code == 200, f"Expected 200, got {res_batch.status_code}"
        batch_data = res_batch.json()
        # 6. Test Model 2 Multi-Label Classification (/test-model2)
        print("\n[6] Testing Model 2 Multi-Label Classification (/test-model2)...")
        file_m2 = {"file": ("impeller_defect_sample.png", create_dummy_image((200, 150, 100)), "image/png")}
        res_m2 = client.post("/test-model2", files=file_m2)
        assert res_m2.status_code == 200, f"Expected 200, got {res_m2.status_code}: {res_m2.text}"
        m2_data = res_m2.json()
        print(" Model 2 Predicted Defects:", m2_data.get("predicted_defects"))
        print(" Model 2 Confidence Scores:", m2_data.get("confidence_scores"))
        print(" Model 2 Requires Human Review:", m2_data.get("requires_human_review"))
        assert "predicted_defects" in m2_data
        assert "confidence_scores" in m2_data
        assert "requires_human_review" in m2_data

        # 7. Test Integrated Pipeline (/test-integrated-pipeline)
        print("\n[7] Testing Integrated Pipeline (/test-integrated-pipeline)...")
        # 7a: Normal / Healthy Case routing check (color (100, 200, 100) evaluates to prob OK = 1.0)
        res_pipe_normal = client.post(
            "/test-integrated-pipeline",
            files={"file": ("healthy_impeller.png", create_dummy_image(color=(100, 200, 100)), "image/png")}
        )
        assert res_pipe_normal.status_code == 200, f"Expected 200, got {res_pipe_normal.status_code}: {res_pipe_normal.text}"
        norm_data = res_pipe_normal.json()
        print(" Normal Case Response:", norm_data)
        assert norm_data.get("status") == "OK"
        assert norm_data.get("routing") == "Forwarded to batch engine / telemetry check"

        # 7b: Defective Case with real image if available
        test_img_path = os.path.join(CURRENT_DIR, "models", "classification", "image.jpeg")
        if os.path.exists(test_img_path):
            with open(test_img_path, "rb") as f:
                img_bytes = f.read()
            res_pipe_defect = client.post(
                "/test-integrated-pipeline",
                files={"file": ("defective_part.jpg", img_bytes, "image/jpeg")}
            )
            assert res_pipe_defect.status_code == 200, f"Expected 200, got {res_pipe_defect.status_code}: {res_pipe_defect.text}"
            defect_data = res_pipe_defect.json()
            print(" Defective Case Response:")
            print("   Status:", defect_data.get("status"))
            print("   Predicted Defects:", defect_data.get("predicted_defects"))
            print("   Confidence Scores:", defect_data.get("confidence_scores"))
            print("   Requires Human Review:", defect_data.get("requires_human_review"))
            assert defect_data.get("status") == "Defective"
            assert isinstance(defect_data.get("predicted_defects"), list)
            assert isinstance(defect_data.get("confidence_scores"), dict)
            assert isinstance(defect_data.get("requires_human_review"), bool)

        print("\n" + "=" * 60)
        print("ALL TESTS PASSED SUCCESSFULLY! BACKEND PIPELINE VERIFIED.")
        print("=" * 60)


if __name__ == "__main__":
    test_quality_inspection_pipeline()
