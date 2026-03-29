"""
detector.py
============
Core fish detection logic using YOLO.

Detection Behavior:
    1. Fish detected          → Returns label + confidence
    2. Unknown fish-like obj  → "Unknown fish detected. This species is not in the model."
    3. Human/other object     → "This application detects marine life only."
    4. Nothing detected       → "No fish detected in the image."
"""

import cv2
import numpy as np
from PIL import Image
from typing import Any
from model_loader import load_model


# ─────────────────────────────────────────────────────────────
# Known non-fish COCO class names (for context detection)
# These are standard classes YOLO pretrained models may detect.
# ─────────────────────────────────────────────────────────────
NON_MARINE_CLASSES = {
    "person", "bicycle", "car", "motorcycle", "airplane", "bus",
    "train", "truck", "boat", "traffic light", "fire hydrant",
    "stop sign", "parking meter", "bench", "bird", "cat", "dog",
    "horse", "sheep", "cow", "elephant", "bear", "zebra", "giraffe",
    "backpack", "umbrella", "handbag", "tie", "suitcase", "frisbee",
    "skis", "snowboard", "sports ball", "kite", "baseball bat",
    "baseball glove", "skateboard", "surfboard", "tennis racket",
    "bottle", "wine glass", "cup", "fork", "knife", "spoon", "bowl",
    "banana", "apple", "sandwich", "orange", "broccoli", "carrot",
    "hot dog", "pizza", "donut", "cake", "chair", "couch",
    "potted plant", "bed", "dining table", "toilet", "tv", "laptop",
    "mouse", "remote", "keyboard", "cell phone", "microwave", "oven",
    "toaster", "sink", "refrigerator", "book", "clock", "vase",
    "scissors", "teddy bear", "hair drier", "toothbrush"
}

# Confidence threshold — detections below this are ignored
CONFIDENCE_THRESHOLD = 0.25

# ─────────────────────────────────────────────────────────────
# Bounding Box Color Scheme
# ─────────────────────────────────────────────────────────────
COLOR_FISH    = (0, 220, 150)   # Teal-green for confirmed fish
COLOR_UNKNOWN = (255, 160, 50)  # Orange for unknown fish
COLOR_OTHER   = (50, 100, 255)  # Blue for non-marine objects


class FishDetector:
    """
    Wraps a YOLO model and provides fish-specific detection logic.
    """

    def __init__(self, model_path: str = "best.pt"):
        self.model = load_model(model_path)
        self.class_names = self.model.names  # dict: {id: class_name}
        print(f"[Detector] Class names: {self.class_names}")

    def detect(self, image_path: str, output_path: str) -> dict[str, Any]:
        """
        Run YOLO detection on an image and return structured results.

        Args:
            image_path  (str): Path to input image.
            output_path (str): Path to save the annotated output image.

        Returns:
            dict: Detection result payload.
        """
        # Load image
        image = cv2.imread(image_path)
        if image is None:
            return self._error_response("Could not read the image file.")

        # Run inference
        results = self.model.predict(
            source=image_path,
            conf=CONFIDENCE_THRESHOLD,
            save=False,
            verbose=False
        )

        detections = []
        has_fish     = False
        has_unknown  = False
        has_nonmarine = False

        # ── Parse YOLO output ──────────────────────────────────────
        for result in results:
            boxes = result.boxes
            if boxes is None:
                continue

            for box in boxes:
                conf  = float(box.conf[0])
                cls_id = int(box.cls[0])
                label  = self.class_names.get(cls_id, "Unknown").lower()
                x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())

                # ── Classify detection type ────────────────────────
                if label in NON_MARINE_CLASSES:
                    # Non-marine / human object
                    has_nonmarine = True
                    det_type = "non_marine"
                    display_label = label.title()
                    color = COLOR_OTHER
                elif label == "unknown" or label == "?":
                    # Explicitly unknown
                    has_unknown = True
                    det_type = "unknown_fish"
                    display_label = "Unknown"
                    color = COLOR_UNKNOWN
                else:
                    # Treat as fish (model was trained on fish classes)
                    has_fish = True
                    det_type = "fish"
                    display_label = label.title()
                    color = COLOR_FISH

                detections.append({
                    "label":       display_label,
                    "confidence":  round(conf, 4),
                    "bbox":        [x1, y1, x2, y2],
                    "type":        det_type,
                    "is_fish":     det_type == "fish",
                })

                # ── Draw bounding box on image ─────────────────────
                self._draw_box(image, x1, y1, x2, y2, display_label, conf, color)

        # Save annotated image
        cv2.imwrite(output_path, image)

        # ── Build response based on detection results ──────────────
        if has_fish and not has_nonmarine:
            fish_names = list({d["label"] for d in detections if d["is_fish"]})
            status  = "fish_detected"
            message = f"Fish detected: {', '.join(fish_names)}."

        elif has_unknown and not has_fish and not has_nonmarine:
            status  = "unknown_fish"
            message = "Unknown fish detected. This species is not in the model."

        elif has_nonmarine:
            status  = "non_marine"
            message = "This application detects marine life only."

        elif has_fish and has_nonmarine:
            # Mixed — fish also detected alongside other objects
            fish_names = list({d["label"] for d in detections if d["is_fish"]})
            status  = "fish_detected"
            message = f"Fish detected: {', '.join(fish_names)}. (Other non-marine objects also found.)"

        else:
            status  = "no_detection"
            message = "No fish detected in the image."

        return {
            "status":     status,
            "message":    message,
            "detections": detections,
        }

    # ─────────────────────────────────────────────────────────────────
    # Private Helpers
    # ─────────────────────────────────────────────────────────────────

    def _draw_box(
        self,
        image: np.ndarray,
        x1: int, y1: int, x2: int, y2: int,
        label: str,
        conf: float,
        color: tuple
    ) -> None:
        """Draw a bounding box with label and confidence on the image."""
        thickness = 2
        font      = cv2.FONT_HERSHEY_SIMPLEX
        font_scale = 0.6

        # Draw rectangle
        cv2.rectangle(image, (x1, y1), (x2, y2), color, thickness)

        # Label background
        text = f"{label}  {conf:.0%}"
        (tw, th), _ = cv2.getTextSize(text, font, font_scale, 1)
        cv2.rectangle(image, (x1, y1 - th - 10), (x1 + tw + 6, y1), color, -1)

        # Label text
        cv2.putText(
            image, text,
            (x1 + 3, y1 - 5),
            font, font_scale,
            (0, 0, 0), 1, cv2.LINE_AA
        )

    def _error_response(self, msg: str) -> dict:
        """Return a standardized error response."""
        return {
            "status":     "error",
            "message":    msg,
            "detections": [],
        }
