#!/usr/bin/env python3
"""나은 비서실 — 오피스 맵을 10명 일체형 클레이 3D 배경 + 이름표 배지/구역 핀으로 재구성.

사용법:  python3 build-clay.py
입력:    downloads/naeun-office-clay-3d-10.png (10명 일체형, 1254×1254)
출력:    work/naeun-office/index.html 의 오피스 맵 섹션(이미지/배지/핀/CSS/JS)만 교체
"""
import base64
import io
import re
import shutil
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]          # /workspace
OUT = ROOT / "work" / "naeun-office" / "index.html"
SRC_IMG = ROOT / "downloads" / "naeun-office-clay-3d-10.png"

# ── 1. 배경 이미지: 1,100px 최적화 후 Base64 인라인 ──────────────────────────
im = Image.open(SRC_IMG).convert("RGB")
im = im.resize((1100, 1100), Image.LANCZOS)
buf = io.BytesIO()
im.save(buf, "JPEG", quality=86, optimize=True, progressive=True)
IMG_B64 = base64.b64encode(buf.getvalue()).decode()
print(f"image: 1100x1100 jpeg {len(buf.getvalue())//1024}KB (base64 {len(IMG_B64)//1024}KB)")

# ── 2. 이름표 배지 (좌표는 downloads/naeun-office-clay-3d-10.png 기준 %) ─────
#   no, 이름, 표시문구, data-space, left, top, 애니메이션(초/딜레이)
TAGS = [
    (1, "뮤즈",     "뮤즈",       "command", 41.5, 18.8, 5.1, 0.1),
    (2, "인스팅트", "인스팅트",   "command", 57.0, 25.8, 6.2, 0.9),
    (3, "초록",     "초록",       "meeting", 14.6, 37.6, 5.6, 1.7),
    (4, "노랑",     "노랑",       "meeting", 25.2, 33.9, 4.9, 0.4),
    (5, "진분홍",   "진분홍",     "meeting", 38.2, 32.9, 6.6, 1.2),
    (6, "막내",     "막내",       "meeting", 26.6, 44.9, 5.8, 2.1),
    (7, "하크",     "하크",       "lounge",  38.0, 59.4, 5.3, 2.6),
    (8, "부이",     "부이",       "lounge",  57.2, 60.9, 6.4, 3.1),
    (9, "큐",       "큐",         "lounge",  78.5, 51.3, 5.0, 1.5),
    (10, "키링",    "키링",       "lounge",  76.0, 70.2, 5.9, 3.7),
]
SUB = {"초록": "(메인)"}   # 이름 뒤 작은 보조 표기

tags_html = []
for no, name, label, space, left, top, dur, delay in TAGS:
    sub = SUB.get(name)
    inner = f"<b>{label}</b>" + (f"<small>{sub}</small>" if sub else "")
    tags_html.append(
        f'          <button class="nametag nt-{no}" type="button" data-member="{name}" data-space="{space}" '
        f'title="{name} 상세 보기" aria-label="{name} 상세 보기">{inner}</button>'
    )
TAGS_HTML = "\n".join(tags_html)

tags_css = []
for no, name, label, space, left, top, dur, delay in TAGS:
    tags_css.append(
        f"  .nt-{no}{{left:{left}%; top:{top}%; animation-duration:{dur}s; animation-delay:{delay}s}}"
    )
TAGS_CSS = "\n".join(tags_css)

# ── 3. 교체 조각 ─────────────────────────────────────────────────────────────
NEW_ZOOM = (
    '<div class="office-zoom" id="officeZoom">\n'
    f'          <img src="data:image/jpeg;base64,{IMG_B64}" alt="열 명의 비서가 한 방에서 일하는 클레이 3D 오피스 — '
    '위쪽 모니터 지휘 책상에 뮤즈와 인스팅트, 왼쪽 둥근 회의 테이블에 초록·노랑·진분홍·막내, '
    '아래쪽 개인 책상에 하크·부이, 오른쪽 책상에 큐·키링, 오른쪽 소파 라운지" '
    'decoding="async" fetchpriority="high">\n'
    '        </div>'
)

NEW_PINS = '''          <button class="pin pin-meeting" type="button" data-space="meeting" aria-pressed="true"><span class="pin-dot" aria-hidden="true"></span>대회의실</button>
          <button class="pin pin-command" type="button" data-space="command" aria-pressed="false"><span class="pin-dot" aria-hidden="true"></span>지휘실</button>
          <button class="pin pin-lounge" type="button" data-space="lounge" aria-pressed="false"><span class="pin-dot" aria-hidden="true"></span>라운지</button>

          <!-- NAME-TAGS:START -->
''' + TAGS_HTML + '''
          <!-- NAME-TAGS:END -->'''

NEW_TAG_CSS = '''  /* ── 클레이 3D 이름표 배지 ── */
  .office-stage{--tagF:clamp(9px, 1.06cqw, 11.5px); container-type:inline-size}
  .pin{z-index:900}
  .nametag{
    z-index:40; font-size:var(--tagF); max-width:44%;
    padding:.36em .78em .36em .62em; gap:.42em;
  }
  .nametag b{font-weight:800; letter-spacing:-.2px}
  .nametag small{font-size:.86em; font-weight:700; color:#8C7A6C; letter-spacing:-.1px}
  .nametag::before{width:.6em; height:.6em; box-shadow:0 0 0 .18em rgba(34,197,94,.2)}
  .nametag::after{width:.6em; height:.6em; bottom:-.32em}
  .office-stage.focus-meeting .nametag:not([data-space="meeting"]),
  .office-stage.focus-command .nametag:not([data-space="command"]),
  .office-stage.focus-lounge .nametag:not([data-space="lounge"]){opacity:.55}
  /* 이름표 위치 (배경 이미지 대비 %) */
''' + TAGS_CSS + '''
'''
RESP_CSS = """  /* 클레이 3D 이름표 — 좁은 화면 보정 (맨 뒤에 둬서 기존 모바일 규칙을 덮음) */
  @media (max-width:720px){
    .office-stage{--tagF:clamp(8.6px, 2.1cqw, 11.5px)}
    .nametag{font-size:var(--tagF); padding:3px 7px 3px 5px; gap:3px}
    .pin{font-size:11px; padding:5px 9px; gap:4px}
  }
  @media (max-width:560px){
    .office-stage{--tagF:8.2px}
    .nametag{max-width:32%; padding:2px 5px 2px 4px; gap:3px; box-shadow:0 2px 7px rgba(90,65,45,.2)}
    .nametag small{display:none}
    .nametag::before{width:4.5px; height:4.5px; box-shadow:0 0 0 1.5px rgba(34,197,94,.22)}
    .nametag::after{width:5px; height:5px; bottom:-2.5px}
    .pin{font-size:8.5px; padding:3.5px 7px; gap:4px}
    .pin .pin-dot{width:6px; height:6px}
    .nt-1{left:41%; top:19.4%} .nt-2{left:57%; top:26.4%}
    .nt-3{left:13.6%; top:37.8%}
    .nt-5{left:36.4%; top:33.2%} .nt-7{left:37.5%; top:59.8%}
    .nt-9{left:79%; top:51.8%} .nt-10{left:76%; top:70.6%}
    .pin-command{left:53.5%; top:36.6%}
    .pin-meeting{left:31.5%; top:53.6%}
  }
"""
print("tags:", len(TAGS))

# ── 4. index.html 변환 ──────────────────────────────────────────────────────
html = OUT.read_text(encoding="utf-8")
orig_len = len(html)


def sub1(pattern, repl, text, flags=re.S, label=""):
    new, n = re.subn(pattern, lambda m: repl, text, count=1, flags=flags)
    if n != 1:
        raise SystemExit(f"[FAIL] {label}: 매칭 {n}건")
    print(f"[ok] {label}")
    return new


# 4-1 배경 이미지
html = sub1(r'<div class="office-zoom" id="officeZoom">\s*<img src="data:image/[^"]+"[^>]*>\s*</div>',
            NEW_ZOOM, html, label="office-zoom image")

# 4-2 핀 3개 + 이름표 배지 (walker 제거)
html = sub1(r'          <button class="pin pin-meeting".*?<!-- WALKERS:END -->',
            NEW_PINS, html, label="pins + nametags (walkers removed)")

# 4-3 walker CSS → 이름표 배지 CSS
html = sub1(r'\s*/\* WALKERS-CSS:START \*/.*?/\* WALKERS-CSS:END \*/',
            "\n" + NEW_TAG_CSS, html, label="walker css")

# 4-4 walker JS 블록 제거
html = sub1(r'\n\s*/\* WALKERS-JS:START \*/.*?/\* WALKERS-JS:END \*/', "", html, label="walker js")

# 4-4b 옛 이름표 좌표(.nt-1~.nt-11) 제거 — 새 좌표가 뒤에서 덮어쓰이지 않게
html = sub1(r"\n?\s*\.nt-1\{left:41%.*?\.nt-11\{[^}]*\}", "", html, label="old nt-1..nt-11 css")

# 4-5 남은 .walker 선택자 정리
html = html.replace("$$('.nametag, .walker')", "$$('.nametag')")

# 4-5b 모바일 보정 CSS를 스타일 맨 끝에 삽입
html = sub1(r'\n</style>', "\n" + RESP_CSS + "</style>", html, label="responsive css")

# 4-5c 스포트라이트 강도
html = html.replace("rgba(64,44,30,.14) 38%, rgba(64,44,30,.42) 72%, rgba(64,44,30,.55) 100%",
                    "rgba(64,44,30,.20) 36%, rgba(64,44,30,.50) 72%, rgba(64,44,30,.62) 100%")

# 4-6 구역 핀 좌표 / 스포트라이트 중심
html = html.replace(".office-stage.focus-meeting{--fx:25%; --fy:59%}", ".office-stage.focus-meeting{--fx:28%; --fy:49%}")
html = html.replace(".office-stage.focus-command{--fx:52%; --fy:24%}", ".office-stage.focus-command{--fx:48%; --fy:28%}")
html = html.replace(".office-stage.focus-lounge{--fx:79%; --fy:52%}", ".office-stage.focus-lounge{--fx:74%; --fy:46%}")
html = html.replace(".pin-meeting{left:24%; top:67%;", ".pin-meeting{left:33%; top:54.5%;")
html = html.replace(".pin-command{left:50%; top:9%;", ".pin-command{left:49%; top:36%;")
html = html.replace(".pin-lounge{left:89%; top:31%;", ".pin-lounge{left:67%; top:48%;")

# 4-6b 소개 문구
html = html.replace("세 공간에서 열 명의 비서가 움직입니다", "세 공간에 열 명의 비서가 자리 잡고 있습니다")

# 4-7 안내 문구(정지 이미지에 맞게)
html = html.replace("캐릭터를 누르면 비서 상세로, 공간 이름을 누르면 모드가 바뀝니다 (몇 초마다 자리를 옮겨요)",
                    "이름표를 누르면 비서 상세로, 공간 이름을 누르면 그 구역으로 스포트라이트가 옮겨갑니다")
html = html.replace("클레이 3D 오피스 · 캐릭터를 누르면 비서 상세로, 공간 이름을 누르면 모드가 바뀝니다 (몇 초마다 자리를 옮겨요)",
                    "클레이 3D 오피스 · 이름표를 누르면 비서 상세로, 공간 이름을 누르면 그 구역으로 스포트라이트가 옮겨갑니다")

OUT.write_text(html, encoding="utf-8")
print(f"index.html {orig_len} → {len(html)} bytes")

# 4-8 downloads/나은-비서실.html 동일 사본
shutil.copyfile(OUT, ROOT / "downloads" / "나은-비서실.html")
print("copied → downloads/나은-비서실.html")
