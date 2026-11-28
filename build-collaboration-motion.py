#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Build transparent 4:3 collaboration route clips and a sequential composite preview.

The output clips contain only one character sprite on transparent alpha. The preview
composites one mover at a time over the character-free reference office.
"""
from __future__ import annotations

import argparse
import json
import math
import shutil
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent
WIDTH, HEIGHT = 2368, 1776
FPS = 12
CHAR_HEIGHT = 118
START_HOLD = 0.45
OUTBOUND = 2.2
COLLAB_HOLD = 1.5
RETURN = 2.2
END_HOLD = 0.45
CLIP_SECONDS = START_HOLD + OUTBOUND + COLLAB_HOLD + RETURN + END_HOLD

# Route positions are character-center coordinates on the supplied 2368 x 1776 image.
# The two adjusted routes keep their start/return seats and avoid the fixed white-cat seat.
ROUTES = [
    {
        "key": "q", "display": "큐 · 파란 세모", "sprite": "q",
        "seat": [735, 694], "via": [[800, 730], [835, 785]], "target": [860, 810],
        "original": [[735, 694], [800, 730], [835, 785], [860, 810]],
        "group": "StarCue",
    },
    {
        "key": "starcue", "display": "별큐 · 왕관 쓴 윙크 노란 별", "sprite": "starcue",
        "seat": [673, 860], "via": [[640, 950], [760, 1020]], "target": [860, 1030],
        "original": [[673, 860], [770, 900], [880, 925], [1030, 930]],
        "group": "큐",
    },
    {
        "key": "chorok", "display": "초록 · 노트북 자리", "sprite": "chorok",
        "seat": [1238, 457],
        "via": [[1180, 610], [1080, 650], [900, 650], [840, 820]],
        "target": [820, 1020],
        "original": [[1238, 457], [1180, 610], [1150, 720], [1150, 810]],
        "group": "노트북 행",
        "route_adjustment": "좌석에서 빠져나온 뒤 중앙 테이블 서쪽 열린 바닥으로 우회",
    },
    {
        "key": "norang", "display": "노랑 · 일반 노랑 캐릭터", "sprite": "norang",
        "seat": [1390, 510], "via": [[1350, 640], [1450, 740], [1500, 850]], "target": [1510, 930],
        "original": [[1390, 510], [1350, 640], [1315, 730], [1300, 810]],
        "group": "노트북 행",
        "route_adjustment": "중앙 테이블 동쪽의 열린 바닥으로 우회",
    },
    {
        "key": "xeye", "display": "연분홍 X-eye", "sprite": "instinct",
        "seat": [1481, 591], "via": [[1450, 730], [1470, 830]], "target": [1500, 930],
        "original": [[1481, 591], [1435, 730], [1400, 830], [1410, 930]],
        "group": "노트북 행",
    },
    {
        "key": "jinpink", "display": "진분홍", "sprite": "jinpink",
        "seat": [1631, 667], "via": [[1590, 760], [1530, 850]], "target": [1490, 950],
        "original": [[1631, 667], [1590, 760], [1560, 845], [1570, 930]],
        "group": "노트북 행",
    },
    {
        "key": "vooy-pink-triangle", "display": "부이 · 분홍 세모", "sprite": "maknae",
        "seat": [1686, 891], "via": [[1720, 920], [1740, 950]], "target": [1750, 970],
        "original": [[1686, 891], [1720, 920], [1740, 950], [1750, 970]],
        "group": "데스크톱 업무 행",
    },
    {
        "key": "muse-white", "display": "뮤즈 · 옆의 하얀 캐릭터", "sprite": "vooy",
        "seat": [1015, 768], "via": [[920, 800], [840, 900], [800, 990]], "target": [780, 1060],
        "original": [[1015, 768], [965, 820], [920, 875], [900, 930]],
        "group": "라운지 허들",
    },
    {
        "key": "kyring-cat", "display": "키링 · 흰 고양이", "sprite": "muse",
        "seat": [1222, 770], "via": [[1320, 780], [1420, 880], [1470, 970]], "target": [1480, 1020],
        "original": [[1222, 770], [1280, 820], [1330, 875], [1360, 930]],
        "group": "라운지 허들",
    },
    {
        "key": "hama", "display": "하마뮤즈 · 커피 든 보라 하마", "sprite": "hama",
        "seat": [1000, 1187], "via": [[950, 1195], [910, 1220]], "target": [880, 1240],
        "original": [[1000, 1187], [950, 1195], [910, 1220], [880, 1240]],
        "group": "라운지 허들",
    },
    {
        "key": "hark", "display": "하크 · 검정 캐릭터", "sprite": "hark",
        "seat": [1154, 1164], "via": [[1080, 1080], [1000, 1000], [930, 950]], "target": [900, 930],
        "original": [[1154, 1164], [1150, 1230], [1150, 1300], [1150, 1370]],
        "group": "라운지 허들",
    },
    {
        "key": "instinct-i", "display": "인스팅트 · I 캐릭터", "sprite": "kyring",
        "seat": [1293, 1195], "via": [[1380, 1120], [1460, 1050], [1540, 1000]], "target": [1600, 980],
        "original": [[1293, 1195], [1350, 1205], [1400, 1225], [1440, 1240]],
        "group": "라운지 허들",
    },
]


def route_points(route: dict) -> list[tuple[float, float]]:
    return [tuple(route["seat"]), *[tuple(p) for p in route["via"]], tuple(route["target"])]


def route_position(route: dict, elapsed: float) -> tuple[float, float]:
    points = route_points(route)
    if elapsed <= START_HOLD:
        return points[0]
    t = elapsed - START_HOLD
    if t < OUTBOUND:
        return along(points, t / OUTBOUND)
    t -= OUTBOUND
    if t < COLLAB_HOLD:
        return points[-1]
    t -= COLLAB_HOLD
    if t < RETURN:
        return along(list(reversed(points)), t / RETURN)
    return points[0]


def along(points: list[tuple[float, float]], progress: float) -> tuple[float, float]:
    lengths = [math.dist(a, b) for a, b in zip(points, points[1:])]
    total = sum(lengths)
    if not total:
        return points[-1]
    distance = max(0.0, min(1.0, progress)) * total
    for a, b, length in zip(points, points[1:], lengths):
        if distance <= length or length == lengths[-1]:
            t = 0.0 if not length else distance / length
            return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)
        distance -= length
    return points[-1]


def load_sprites() -> dict[str, Image.Image]:
    result: dict[str, Image.Image] = {}
    for route in ROUTES:
        key = route["sprite"]
        if key in result:
            continue
        path = ROOT / "assets" / "chars" / f"{key}.png"
        if not path.exists():
            raise FileNotFoundError(f"Missing sprite: {path}")
        image = Image.open(path).convert("RGBA")
        alpha = image.getchannel("A")
        bbox = alpha.getbbox()
        if not bbox:
            raise ValueError(f"Sprite has no opaque subject: {path}")
        image = image.crop(bbox)
        if key == "starcue":
            extrema = image.getchannel("A").getextrema()
            coverage = sum(1 for v in image.getchannel("A").getdata() if v > 8) / (image.width * image.height)
            if extrema[0] != 0 or extrema[1] < 200 or coverage > 0.94:
                raise ValueError("StarCue must be a true transparent cutout; refusing a background-filled sprite")
        width = max(1, round(image.width * CHAR_HEIGHT / image.height))
        result[key] = image.resize((width, CHAR_HEIGHT), Image.Resampling.LANCZOS)
    return result


def draw_center(canvas: Image.Image, sprite: Image.Image, position: tuple[float, float]) -> None:
    x, y = position
    canvas.alpha_composite(sprite, (round(x - sprite.width / 2), round(y - sprite.height / 2)))


def render_alpha_frame(route: dict, sprites: dict[str, Image.Image], elapsed: float) -> Image.Image:
    frame = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    # Very small vertical step bob only while walking; scale, facing and sprite pixels remain fixed.
    walking = START_HOLD < elapsed < START_HOLD + OUTBOUND or START_HOLD + OUTBOUND + COLLAB_HOLD < elapsed < CLIP_SECONDS - END_HOLD
    x, y = route_position(route, elapsed)
    if walking:
        y -= 1.5 * (1 + math.cos(2 * math.pi * elapsed * 2.3)) / 2
    draw_center(frame, sprites[route["sprite"]], (x, y))
    return frame


def encode_webm(route: dict, sprites: dict[str, Image.Image], outdir: Path) -> Path:
    frames_dir = Path(tempfile.mkdtemp(prefix="collab-frames-"))
    try:
        count = math.ceil(CLIP_SECONDS * FPS)
        for i in range(count):
            t = min(i / FPS, CLIP_SECONDS - 1 / FPS)
            render_alpha_frame(route, sprites, t).save(frames_dir / f"frame-{i:05d}.png", compress_level=1)
        target = outdir / f"collab-{route['key']}.webm"
        cmd = [
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-framerate", str(FPS),
            "-i", str(frames_dir / "frame-%05d.png"), "-an", "-c:v", "libvpx-vp9",
            "-deadline", "good", "-cpu-used", "4", "-crf", "34", "-b:v", "0",
            "-pix_fmt", "yuva420p", "-auto-alt-ref", "0", "-row-mt", "1", str(target),
        ]
        subprocess.run(cmd, check=True)
        return target
    finally:
        shutil.rmtree(frames_dir, ignore_errors=True)


def scene_base(background: Image.Image, sprites: dict[str, Image.Image], omit_key: str | None = None) -> Image.Image:
    base = background.convert("RGBA").copy()
    for route in ROUTES:
        if route["key"] == omit_key:
            continue
        draw_center(base, sprites[route["sprite"]], tuple(route["seat"]))
    return base


def write_preview(background: Image.Image, sprites: dict[str, Image.Image], outdir: Path) -> Path:
    target = outdir / "collaboration-sequence.mp4"
    preview_fps = 10
    scale = (WIDTH // 2, HEIGHT // 2)
    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "rawvideo",
        "-pix_fmt", "rgb24", "-s", f"{scale[0]}x{scale[1]}", "-r", str(preview_fps), "-i", "-",
        "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "27", "-pix_fmt", "yuv420p",
        "-movflags", "+faststart", str(target),
    ]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    try:
        for route in ROUTES:
            base = scene_base(background, sprites, omit_key=route["key"])
            total = round(CLIP_SECONDS * preview_fps)
            for i in range(total):
                t = min(i / preview_fps, CLIP_SECONDS - 1 / preview_fps)
                frame = base.copy()
                # The moving actor is drawn once at its current position; its seated copy is omitted.
                pos = route_position(route, t)
                walking = START_HOLD < t < START_HOLD + OUTBOUND or START_HOLD + OUTBOUND + COLLAB_HOLD < t < CLIP_SECONDS - END_HOLD
                if walking:
                    pos = (pos[0], pos[1] - 1.5 * (1 + math.cos(2 * math.pi * t * 2.3)) / 2)
                draw_center(frame, sprites[route["sprite"]], pos)
                small = frame.convert("RGB").resize(scale, Image.Resampling.LANCZOS)
                assert proc.stdin is not None
                proc.stdin.write(small.tobytes())
        assert proc.stdin is not None
        proc.stdin.close()
        return_code = proc.wait()
        if return_code:
            raise subprocess.CalledProcessError(return_code, cmd)
    except Exception:
        if proc.poll() is None:
            proc.kill()
        proc.wait()
        raise
    return target


def validate(routes: list[dict]) -> None:
    # Validate point bounds and use a conservative 92px centre-to-centre clearance from
    # every other character's fixed seat. One character moves at a time.
    margin = CHAR_HEIGHT / 2 + 28
    fixed = {r["key"]: tuple(r["seat"]) for r in routes}
    issues = []
    for route in routes:
        points = route_points(route)
        for x, y in points:
            if not (margin <= x <= WIDTH - margin and margin <= y <= HEIGHT - margin):
                issues.append(f"{route['key']}: out-of-bounds point {(x, y)}")
        for other_key, seat in fixed.items():
            if other_key == route["key"]:
                continue
            for a, b in zip(points, points[1:]):
                vx, vy = b[0] - a[0], b[1] - a[1]
                den = vx * vx + vy * vy
                t = 0 if den == 0 else max(0, min(1, ((seat[0]-a[0])*vx+(seat[1]-a[1])*vy)/den))
                d = math.dist((a[0]+t*vx, a[1]+t*vy), seat)
                if d < margin:
                    issues.append(f"{route['key']} passes within {d:.1f}px of fixed {other_key}")
                    break
    if issues:
        raise ValueError("Route collision validation failed:\n- " + "\n- ".join(issues))


def write_manifest(outdir: Path) -> None:
    entries = []
    for route in ROUTES:
        existing = []
        for state in ("working", "resting"):
            p = ROOT / "assets" / "lounge-motion" / f"{route['sprite']}-{state}.webm"
            if p.exists():
                existing.append(str(p.relative_to(ROOT)))
        points = route_points(route)
        entries.append({
            "key": route["key"], "display": route["display"], "sprite": f"assets/chars/{route['sprite']}.png",
            "existing_work_rest_clips": existing,
            "collaboration_clip": f"assets/collaboration-motion/collab-{route['key']}.webm",
            "start_center_px": list(points[0]), "outbound_via_px": [list(p) for p in points[1:-1]],
            "target_center_px": list(points[-1]), "return": "reverse same path",
            "group": route.get("group", ""),
            "original_suggested_path_px": route.get("original"),
            "route_adjustment": route.get("route_adjustment", ""),
        })
    data = {
        "canvas": {"width": WIDTH, "height": HEIGHT, "coordinate_origin": "top-left", "position": "character center"},
        "background_reference": "previews/office-background-4x3.png",
        "route_reference_image": "user-provided 36153.png",
        "format": "VP9 WebM with transparent alpha; character sprite only",
        "playback": {"fps": FPS, "duration_seconds": round(CLIP_SECONDS, 2), "start_hold": START_HOLD, "collaboration_hold": COLLAB_HOLD},
        "sequential_preview": "previews/collaboration-sequence.mp4",
        "characters": entries,
    }
    (outdir / "manifest.json").write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--background", default="/home/ubuntu/upload/6tXLmltxYsEjpR8rI4ZBLG/36216.png")
    parser.add_argument("--skip-webm", action="store_true")
    parser.add_argument("--skip-preview", action="store_true")
    args = parser.parse_args()
    background = Image.open(args.background).convert("RGB")
    if background.size != (WIDTH, HEIGHT):
        raise ValueError(f"Expected {WIDTH}x{HEIGHT} scene background, got {background.size}")
    assets_dir = ROOT / "assets" / "collaboration-motion"
    preview_dir = ROOT / "previews"
    assets_dir.mkdir(parents=True, exist_ok=True)
    preview_dir.mkdir(parents=True, exist_ok=True)
    background.save(preview_dir / "office-background-4x3.png", optimize=True)
    validate(ROUTES)
    sprites = load_sprites()
    if not args.skip_webm:
        for n, route in enumerate(ROUTES, 1):
            path = encode_webm(route, sprites, assets_dir)
            print(f"[{n}/{len(ROUTES)}] {path.relative_to(ROOT)} ({path.stat().st_size:,} bytes)", flush=True)
    if not args.skip_preview:
        path = write_preview(background, sprites, preview_dir)
        print(f"preview {path.relative_to(ROOT)} ({path.stat().st_size:,} bytes)", flush=True)
    write_manifest(assets_dir)
    print(f"manifest {assets_dir / 'manifest.json'}", flush=True)


if __name__ == "__main__":
    main()
