"""
Fish Detection API - FastAPI Backend
=====================================
Main entry point for the Fish Detection web application.
Handles image uploads and returns YOLO-based detection results.

Render deployment fixes (v1.1):
  - LAZY model loading: model is NOT loaded at startup.
    This lets uvicorn bind the port before touching PyTorch,
    preventing the "No open ports detected" / OOM kill on Render's free tier.
  - First POST /detect call loads the model; subsequent calls reuse it.
"""

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
import uvicorn
import uuid
import os
import shutil
from typing import List
from datetime import datetime

# ── Lazy import — do NOT import FishDetector at module level.
# Importing ultralytics/torch at the top triggers PyTorch initialisation
# before uvicorn has a chance to bind the port, causing Render to kill
# the process before it ever starts listening.
_detector = None  # will be populated on first /detect request


def _get_detector():
    """Load and cache the detector.  Thread-safe for single-worker deployments."""
    global _detector
    if _detector is None:
        from detector import FishDetector  # import deferred intentionally
        print("[AquaDetect] Loading YOLO model (first request)…")
        _detector = FishDetector(model_path="best.pt")
        print("[AquaDetect] Model ready.")
    return _detector


# ─────────────────────────────────────────────
# App Initialization
# ─────────────────────────────────────────────
app = FastAPI(
    title="Fish Detection API",
    description="AI-powered fish detection using YOLOv8",
    version="1.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
OUTPUT_DIR = "outputs"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

app.mount("/outputs", StaticFiles(directory=OUTPUT_DIR), name="outputs")

# In-memory detection history (resets on server restart)
detection_history: List[dict] = []


# ─────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────

@app.get("/")
def root():
    """Health check — responds immediately without touching the model."""
    return {"status": "Fish Detection API is running 🐟", "version": "1.1.0"}


@app.post("/detect")
async def detect_fish(file: UploadFile = File(...)):
    """
    POST /detect
    ─────────────
    Accepts a single image file, runs YOLO detection,
    and returns structured detection results.
    The model is loaded on the first call to this endpoint.
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are accepted.")

    file_ext  = os.path.splitext(file.filename)[-1] or ".jpg"
    unique_id = str(uuid.uuid4())
    input_path  = os.path.join(UPLOAD_DIR, f"{unique_id}{file_ext}")
    output_path = os.path.join(OUTPUT_DIR, f"{unique_id}_annotated.jpg")

    with open(input_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Load model lazily — safe to call multiple times (cached after first call)
    detector = _get_detector()
    result   = detector.detect(input_path, output_path)

    result["filename"]            = file.filename
    result["timestamp"]           = datetime.now().isoformat()
    result["annotated_image_url"] = f"/outputs/{unique_id}_annotated.jpg"

    detection_history.append({
        "id":                  unique_id,
        "filename":            file.filename,
        "timestamp":           result["timestamp"],
        "status":              result["status"],
        "message":             result["message"],
        "fish_count":          len([d for d in result["detections"] if d.get("is_fish")]),
        "annotated_image_url": result["annotated_image_url"],
    })

    os.remove(input_path)
    return JSONResponse(content=result)


@app.get("/history")
def get_history():
    grouped = {}
    today     = datetime.now().strftime("%Y-%m-%d")
    yesterday = datetime.now().replace(day=datetime.now().day - 1).strftime("%Y-%m-%d")

    for entry in reversed(detection_history):
        date_str = entry["timestamp"][:10]
        if date_str == today:
            label = "Today"
        elif date_str == yesterday:
            label = "Yesterday"
        else:
            label = date_str
        grouped.setdefault(label, []).append(entry)

    return {"history": grouped}


@app.get("/stats")
def get_stats():
    total = len(detection_history)
    return {
        "total_processed": total,
        "fish_detected":   sum(1 for h in detection_history if h["status"] == "fish_detected"),
        "unknown_objects": sum(1 for h in detection_history if h["status"] == "unknown_fish"),
        "non_marine":      sum(1 for h in detection_history if h["status"] == "non_marine"),
        "no_detection":    sum(1 for h in detection_history if h["status"] == "no_detection"),
    }


@app.delete("/history")
def clear_history():
    detection_history.clear()
    return {"message": "History cleared."}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
