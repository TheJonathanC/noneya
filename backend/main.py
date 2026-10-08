from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import datetime

app = FastAPI(title="Singularity Proxy Test API")

# Allow the frontend to connect without CORS blocking
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def health_check():
    """If Nginx proxy is working, navigating to http://<server-ip>/ will return this JSON."""
    return {"status": "Proxy is routing successfully to FastAPI on KVM 1"}

@app.post("/api/inspect")
async def inspect_component_test(file: UploadFile = File(...)):
    """Mock endpoint to test file uploads and JSON payload structure."""
    return {
        "timestamp": datetime.datetime.now().isoformat(),
        "component": "Brake Disc / Cast Impeller",
        "defect_type": "porosity",
        "severity_rating": "Critical",
        "localisation_heatmap_url": "/mock-heatmap-url.png",
        "root_cause_analysis": {
            "probable_cause": "abnormal casting temperature",
            "confidence_score": "89%",
            "batch_id": "B127",
            "machine_id": "M-04"
        },
        "recommended_action": "Inspect the temperature-control system before continuing production."
    }
