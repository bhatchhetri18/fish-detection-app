"""
Fish Detection API - FastAPI Backend
=====================================
Main entry point for the Fish Detection web application.
Handles image uploads and returns YOLO-based detection results.
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

from detector import FishDetector

# ─────────────────────────────────────────────
# App Initialization
# ─────────────────────────────────────────────
app = FastAPI(
    title="Fish Detection API",
    description="AI-powered fish detection using YOLOv8",
    version="1.0.0"
)

# Allow frontend to communicate with backend (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directory to temporarily store uploaded & annotated images
UPLOAD_DIR = "uploads"
OUTPUT_DIR = "outputs"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Mount output folder so frontend can fetch annotated images via URL
app.mount("/outputs", StaticFiles(directory=OUTPUT_DIR), name="outputs")

# Load the YOLO fish detector once at startup
detector = None

@app.on_event("startup")
def load_model():
    global detector
    print("Loading YOLO model...")
    detector = FishDetector(model_path="best.pt")
    print("Model loaded successfully")

# In-memory detection history (resets on server restart)
detection_history: List[dict] = []


# ─────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────

@app.get("/")
def root():
    """Health check endpoint."""
    return {"status": "Fish Detection API is running 🐟", "version": "1.0.0"}


@app.post("/detect")
async def detect_fish(file: UploadFile = File(...)):
    """
    POST /detect
    ─────────────
    Accepts a single image file, runs YOLO detection,
    and returns structured detection results.

    Response JSON:
    {
        "filename": "...",
        "timestamp": "...",
        "status": "fish_detected | unknown_fish | non_marine | no_detection",
        "message": "...",
        "detections": [
            {
                "label": "Tuna",
                "confidence": 0.92,
                "bbox": [x1, y1, x2, y2]
            }
        ],
        "annotated_image_url": "/outputs/<uuid>.jpg"
    }
    """
    # Validate file type
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are accepted.")

    # Save uploaded image
    file_ext = os.path.splitext(file.filename)[-1] or ".jpg"
    unique_id = str(uuid.uuid4())
    input_path = os.path.join(UPLOAD_DIR, f"{unique_id}{file_ext}")
    output_path = os.path.join(OUTPUT_DIR, f"{unique_id}_annotated.jpg")

    with open(input_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Run detection
    result = detector.detect(input_path, output_path)

    # Attach metadata
    result["filename"] = file.filename
    result["timestamp"] = datetime.now().isoformat()
    result["annotated_image_url"] = f"/outputs/{unique_id}_annotated.jpg"

    # Store in history
    detection_history.append({
        "id": unique_id,
        "filename": file.filename,
        "timestamp": result["timestamp"],
        "status": result["status"],
        "message": result["message"],
        "fish_count": len([d for d in result["detections"] if d.get("is_fish")]),
        "annotated_image_url": result["annotated_image_url"],
    })

    # Clean up raw upload
    os.remove(input_path)

    return JSONResponse(content=result)


@app.get("/history")
def get_history():
    """
    GET /history
    ─────────────
    Returns all past detections grouped by date.
    """
    grouped = {}
    for entry in reversed(detection_history):
        date_str = entry["timestamp"][:10]  # YYYY-MM-DD
        today = datetime.now().strftime("%Y-%m-%d")
        yesterday = (datetime.now().replace(day=datetime.now().day - 1)).strftime("%Y-%m-%d")

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
    """
    GET /stats
    ─────────────
    Returns dashboard statistics.
    """
    total = len(detection_history)
    fish_detected = sum(1 for h in detection_history if h["status"] == "fish_detected")
    unknown = sum(1 for h in detection_history if h["status"] == "unknown_fish")
    non_marine = sum(1 for h in detection_history if h["status"] == "non_marine")
    no_detection = sum(1 for h in detection_history if h["status"] == "no_detection")

    return {
        "total_processed": total,
        "fish_detected": fish_detected,
        "unknown_objects": unknown,
        "non_marine": non_marine,
        "no_detection": no_detection,
    }


@app.delete("/history")
def clear_history():
    """Clear all detection history."""
    detection_history.clear()
    return {"message": "History cleared."}


# ─────────────────────────────────────────────
# Run Server
# ─────────────────────────────────────────────
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
