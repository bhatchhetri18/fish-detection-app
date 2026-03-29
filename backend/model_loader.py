"""
model_loader.py
================
Handles loading the YOLO model from disk.
Separates model loading from detection logic for clean architecture.
"""

from ultralytics import YOLO
import os


def load_model(model_path: str = "best.pt") -> YOLO:
    """
    Load a YOLO model from the given path.

    Args:
        model_path (str): Path to the .pt model file.

    Returns:
        YOLO: Loaded YOLO model instance.

    Raises:
        FileNotFoundError: If model file does not exist.
    """
    if not os.path.exists(model_path):
        raise FileNotFoundError(
            f"Model file not found at '{model_path}'.\n"
            f"Please place your 'best.pt' file in the backend/ directory."
        )

    print(f"[ModelLoader] Loading YOLO model from: {model_path}")
    model = YOLO(model_path)
    print(f"[ModelLoader] ✅ Model loaded successfully.")
    return model
