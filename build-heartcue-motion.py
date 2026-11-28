#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Render HeartCue-only transparent motion clips without touching office integration."""
from __future__ import annotations

import json
import math
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent
ASSET_DIR = ROOT / "assets" / "heartcue-motion"
BACKGROUND = ROOT / "previews" / "office-background-4x3.png"
WIDTH, HEIGHT = 2368, 1776
FPS = 12
DURATION = 3.0
FRAMES = round(FPS * DURATION)
CHAR_HEIGHT = 118
# Empty lower-front workstation selected on the clean 4:3 office background.
# Coordinates use the existing project convention: character center, top-left origin.
SEAT_CENTER = (1570, 1280)


def load_sprite(filename: str) -> Image.Image:
    path = ASSET_DIR / filename
    image = Image.open(path).convert("RGBA")
    array = np.asarray(image).copy()
    alpha = array[:, :, 3]
    # Drop low-alpha fringe pixels and clear hidden RGB to avoid transparent-edge artifacts.
    alpha[alpha < 14] = 0
    array[:, :, 3] = alpha
    array[alpha == 0, :3] = 0
    image = Image.fromarray(array, "RGBA")
    bbox = image.getchannel("A").getbbox()
    if not bbox:
        raise ValueError(f"Sprite has no visible subject: {path}")
    image = image.crop(bbox)
    width = max(1, round(image.width * CHAR_HEIGHT / image.height))
    return image.resize((width, CHAR_HEIGHT), Image.Resampling.LANCZOS)


def draw(canvas: Image.Image, sprite: Image.Image, x_offset: float = 0, y_offset: float = 0) -> None:
    x = round(SEAT_CENTER[0] - sprite.width / 2 + x_offset)
    y = round(SEAT_CENTER[1] - sprite.height / 2 + y_offset)
    canvas.alpha_composite(sprite, (x, y))


def encode_clip(name: str, frame_factory) -> Path:
    target = ASSET_DIR / f"heartcue-{name}.webm"
    command = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-f", "rawvideo", "-pix_fmt", "rgba", "-s", f"{WIDTH}x{HEIGHT}",
        "-r", str(FPS), "-i", "-", "-an", "-c:v", "libvpx-vp9",
        "-deadline", "good", "-cpu-used", "4", "-crf", "34", "-b:v", "0",
        "-pix_fmt", "yuva420p", "-auto-alt-ref", "0", "-row-mt", "1", str(target),
    ]
    process = subprocess.Popen(command, stdin=subprocess.PIPE)
    try:
        assert process.stdin is not None
        for index in range(FRAMES):
            process.stdin.write(frame_factory(index).tobytes())
        process.stdin.close()
        code = process.wait()
        if code:
            raise subprocess.CalledProcessError(code, command)
    except Exception:
        if process.poll() is None:
            process.kill()
        process.wait()
        raise
    return target


def blank() -> Image.Image:
    return Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))


def main() -> None:
    if not BACKGROUND.exists():
        raise FileNotFoundError(f"Missing clean 4:3 background reference: {BACKGROUND}")
    background = Image.open(BACKGROUND)
    if background.size != (WIDTH, HEIGHT):
        raise ValueError(f"Expected {WIDTH}x{HEIGHT} background, got {background.size}")

    seated = load_sprite("heartcue-seated-final.png")
    walk_a = load_sprite("heartcue-walk-a.png")
    walk_b = load_sprite("heartcue-walk-b.png")
    working_a = load_sprite("heartcue-working.png")
    working_b = load_sprite("heartcue-working-typing.png")
    wave = load_sprite("heartcue-wave.png")

    def sit_frame(i: int) -> Image.Image:
        t = i / FPS
        settle = max(0.0, 1.0 - t / 0.55)
        frame = blank()
        draw(frame, seated, y_offset=2.0 * settle + 1.2 * math.sin(2 * math.pi * t / 1.6))
        return frame

    def walk_frame(i: int) -> Image.Image:
        gait_phase = i % 8
        sprite = walk_a if gait_phase < 4 else walk_b
        bob = 2.0 * (1 - math.cos(2 * math.pi * gait_phase / 8)) / 2
        sway = 1.6 * math.sin(2 * math.pi * gait_phase / 8)
        frame = blank()
        draw(frame, sprite, x_offset=sway, y_offset=-bob)
        return frame

    def work_frame(i: int) -> Image.Image:
        t = i / FPS
        blend = (1 - math.cos(2 * math.pi * t * 1.5)) / 2
        bob = 0.8 * math.sin(2 * math.pi * t * 1.5)
        a, b = blank(), blank()
        draw(a, working_a, y_offset=bob)
        draw(b, working_b, y_offset=bob)
        return Image.blend(a, b, blend)

    def daily_frame(i: int) -> Image.Image:
        t = i / FPS
        frame = blank()
        draw(
            frame,
            wave,
            x_offset=1.8 * math.sin(2 * math.pi * t / 2.0),
            y_offset=1.5 * math.sin(2 * math.pi * t / 1.2),
        )
        return frame

    outputs = []
    for name, factory in (
        ("sitting", sit_frame),
        ("walking", walk_frame),
        ("working", work_frame),
        ("daily", daily_frame),
    ):
        path = encode_clip(name, factory)
        outputs.append({
            "file": str(path.relative_to(ROOT)),
            "bytes": path.stat().st_size,
            "fps": FPS,
            "duration_seconds": DURATION,
            "canvas": [WIDTH, HEIGHT],
            "alpha": "VP9 WebM, character only",
            "seat_center_px": list(SEAT_CENTER),
        })
        print(f"{path.relative_to(ROOT)} ({path.stat().st_size:,} bytes)", flush=True)

    manifest = {
        "character": "HeartCue",
        "status": "standalone preparation; not integrated into the 12-character layout and not invited",
        "background_reference": "previews/office-background-4x3.png",
        "selected_empty_lower_workstation_center_px": list(SEAT_CENTER),
        "coordinate_convention": "2368x1776 canvas; top-left origin; character center in pixels",
        "format": "Transparent VP9 WebM; one character only; 12 fps; 3 seconds per loop",
        "clips": outputs,
        "source_pose_files": [
            "heartcue-seated-final.png",
            "heartcue-walk-a.png",
            "heartcue-walk-b.png",
            "heartcue-working.png",
            "heartcue-working-typing.png",
            "heartcue-wave.png",
        ],
    }
    (ASSET_DIR / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main()
