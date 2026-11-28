#!/usr/bin/env python3
"""나은 비서실 — 핑크 클레이 매듭 앱 아이콘 생성기

원본(정사각 JPG, 사방 흰 여백 + 둥근 사각형 아트워크)에서
 1) 흰 여백을 걷어내고 둥근 사각형 아트워크만 잘라
 2) 모서리가 투명한 버전(alpha)과 모서리까지 분홍이 꽉 찬 버전(full-bleed)을 만들어
 3) 아래 아이콘 세트를 다시 씁니다. (흰 테두리·프린지 없음)

사용법:
    python3 build-icon.py <원본.jpg>
"""
import os
import sys
from PIL import Image, ImageDraw

# 1254x1254 원본에서 실측한 아트워크(둥근 사각형) 외곽
BOX = (67, 83, 1177, 1177)
RADIUS_RATIO = 0.31      # 모서리 반경 / 변 (실측 ≈0.29, 흰 테두리 방지로 살짝 안쪽)
INSET = 3                # 마스크를 아트워크보다 안쪽으로 깎는 양(px)
INSET_FULL = 95          # full-bleed 크롭 여백(px) — 모서리 곡선 안쪽
SS = 4                   # 마스크 슈퍼샘플링


def square_alpha(art, inset=INSET):
    """아트워크 → 모서리 투명 정사각 RGBA"""
    aw, ah = art.size
    s = min(aw, ah)
    art = art.crop(((aw - s) // 2, (ah - s) // 2, (aw - s) // 2 + s, (ah - s) // 2 + s))
    big = Image.new("L", (s * SS, s * SS), 0)
    ImageDraw.Draw(big).rounded_rectangle(
        [inset * SS, inset * SS, (s - inset) * SS - 1, (s - inset) * SS - 1],
        radius=int(RADIUS_RATIO * s * SS), fill=255)
    img = art.convert("RGBA")
    img.putalpha(big.resize((s, s), Image.LANCZOS))
    return img


def full_bleed(src):
    """모서리 곡선 안쪽만 크롭 → 사방이 분홍으로 꽉 찬 정사각 RGB"""
    l, t, r, b = BOX
    crop = src.crop((l + INSET_FULL, t + INSET_FULL, r - INSET_FULL, b - INSET_FULL))
    w, h = crop.size
    s = min(w, h)
    return crop.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s))


def save(img, size, path):
    """프리멀티플라이드로 축소 → 투명 경계 프린지 방지"""
    out = img.convert("RGBa").resize((size, size), Image.LANCZOS).convert("RGBA")
    out.save(path, optimize=True)
    print("   ", path, f"{size}x{size}")


def build(src_path, root):
    src = Image.open(src_path).convert("RGB")
    art = src.crop(BOX)
    alpha = square_alpha(art)
    fb = full_bleed(src).convert("RGBA")
    assets = os.path.join(root, "assets")
    os.makedirs(assets, exist_ok=True)

    # assets/ — head·헤더에서 쓰는 정식 경로
    save(alpha, 512, os.path.join(assets, "app-icon.png"))
    save(alpha, 192, os.path.join(assets, "icon-192.png"))
    save(alpha, 168, os.path.join(assets, "brand-mark.png"))
    save(alpha, 64, os.path.join(assets, "favicon.png"))
    save(fb, 512, os.path.join(assets, "icon-512-maskable.png"))
    save(fb, 180, os.path.join(assets, "apple-touch-icon.png"))
    # 루트 — 예전 경로(북마크·구 매니페스트 캐시) 호환
    save(alpha, 512, os.path.join(root, "icon-512.png"))
    save(alpha, 192, os.path.join(root, "icon-192.png"))
    save(alpha, 64, os.path.join(root, "favicon.png"))
    save(fb, 180, os.path.join(root, "apple-touch-icon.png"))


if __name__ == "__main__":
    src = sys.argv[1] if len(sys.argv) > 1 else (
        "/workspace/memory/clones/0c350323-jinnaeun7/pickle/2026-11-28-2300/"
        "received/0-36427-a3d5c7cb2d81486384f6ca0f58dc2aa8.jpg")
    build(src, os.path.dirname(os.path.abspath(__file__)))
