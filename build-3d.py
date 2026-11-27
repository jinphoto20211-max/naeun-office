#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""나은 비서실 — 오피스 맵에 three.js 3D 클레이 오피스를 붙인다.

- assets/office3d.js (모듈) 를 index.html 안에 인라인 <script type="module"> 로 주입
  (three.js 는 CDN 에서 import)
- 스테이지 안에 #office3d (canvas·이름표 레이어·아바타 바) 마크업 주입
- 3D 가 준비되면 .stage-3d 클래스로 2D 스프라이트 판을 숨긴다(WebGL/CDN 실패 시 2D 유지)
- 사물 카드(.prop-card)는 2D 쪽 로직을 window.officePropOpen / officePropClose 로 공유

여러 번 실행해도 같은 결과(마커 교체).
실행: python3 build-3d.py
"""

import io
import os

BASE = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.join(BASE, "index.html")
JS_SRC = os.path.join(BASE, "assets", "office3d.js")

MARK_START = "<!-- OFFICE3D:START -->"
MARK_END = "<!-- OFFICE3D:END -->"

MARKUP = """          <!-- OFFICE3D:START -->
          <div class="office-3d" id="office3d" hidden>
            <canvas id="office3dCanvas"></canvas>
            <div class="o3d-pills" id="office3dPills" aria-hidden="true"></div>
            <div class="o3d-bar" id="office3dBar" aria-label="비서 아바타"></div>
          </div>
          <!-- OFFICE3D:END -->"""

CSS = """  /* OFFICE3D-CSS:START */
  .office-3d{position:absolute; inset:0; z-index:3}
  .office-3d canvas{display:block; width:100%; height:100%; touch-action:pan-y; cursor:grab}
  .office-3d canvas:active{cursor:grabbing}
  .stage-3d .office-room,.stage-3d .office-props,.stage-3d .office-actors{display:none}
  .stage-3d .office-overlay{z-index:6}
  .o3d-pills{position:absolute; inset:0; pointer-events:none; overflow:hidden}
  .o3d-pill{
    position:absolute; left:0; top:0; display:inline-flex; align-items:center; gap:5px;
    padding:3px 9px 3px 7px; border-radius:999px; background:rgba(255,255,255,.95);
    border:1px solid rgba(255,255,255,.98); color:#3F342D; font-size:10.5px; font-weight:800;
    letter-spacing:-.2px; white-space:nowrap; line-height:1.25;
    box-shadow:0 3px 10px rgba(90,65,45,.20); transition:opacity .2s ease; will-change:transform;
  }
  .o3d-dot{width:6px; height:6px; border-radius:50%; background:#22c55e; box-shadow:0 0 0 2px rgba(34,197,94,.22); flex:0 0 auto}
  .o3d-prog{display:inline-block; width:26px; height:3px; border-radius:2px; background:rgba(120,96,74,.18); overflow:hidden}
  .o3d-prog > i{display:block; height:100%; width:0%; background:#7FC197; border-radius:2px; transition:width .18s linear}
  .o3d-tip{
    position:absolute; left:0; top:0; transform:translate(-50%,-150%); z-index:8; pointer-events:none;
    padding:3px 9px; border-radius:999px; background:rgba(52,40,32,.92); color:#FFF8EF;
    font-size:10.5px; font-weight:700; white-space:nowrap; box-shadow:0 6px 16px rgba(60,42,28,.3);
  }
  .o3d-bar{
    position:absolute; left:50%; bottom:10px; transform:translateX(-50%); z-index:7;
    display:flex; align-items:center; gap:6px; padding:6px 10px; border-radius:999px;
    background:rgba(255,252,247,.94); box-shadow:0 10px 24px rgba(90,62,40,.22), inset 0 0 0 1px rgba(255,255,255,.9);
    max-width:calc(100% - 20px); overflow-x:auto; scrollbar-width:none;
  }
  .o3d-bar::-webkit-scrollbar{display:none}
  .o3d-chip{
    display:inline-flex; align-items:center; gap:5px; padding:3px 10px 3px 4px; border-radius:999px;
    border:1px solid transparent; background:transparent; cursor:pointer; flex:0 0 auto;
    font-family:inherit; font-size:10.5px; font-weight:800; color:#5C4A3E; letter-spacing:-.2px;
    transition:background .18s ease, border-color .18s ease, transform .18s ease;
  }
  .o3d-chip img{width:22px; height:22px; object-fit:contain; filter:drop-shadow(0 1px 1px rgba(70,50,34,.2))}
  .o3d-chip:hover{background:rgba(240,224,206,.7); transform:translateY(-1px)}
  .o3d-chip.on{background:#FBE8E9; border-color:#E6A0AA}
  @media (max-width:720px){
    .o3d-pill{font-size:9.5px; padding:2px 7px 2px 6px}
    .o3d-chip{font-size:9.5px; padding:2px 8px 2px 3px}
    .o3d-chip img{width:19px; height:19px}
    .o3d-bar{bottom:6px; gap:4px; padding:5px 8px}
  }
  @media (max-width:560px){
    .o3d-pill{font-size:8.8px; padding:2px 6px 2px 5px; gap:4px}
    .o3d-prog{width:22px; height:2.5px}
    .o3d-chip span{display:none}
    .o3d-chip{padding:2px}
  }
  /* OFFICE3D-CSS:END */
"""

SCRIPT = """<script type="module">
%s
</script>"""


def swap_between(html, start, end, body):
    if start in html and end in html:
        pre, rest = html.split(start, 1)
        _, post = rest.split(end, 1)
        return pre + start + "\n" + body + end + post
    raise SystemExit("marker not found: %s" % start)


html = io.open(INDEX, encoding="utf-8").read()
orig = len(html)
js = io.open(JS_SRC, encoding="utf-8").read().strip()

# 1) 마크업: office-actors 레이어 뒤에 3D 레이어 삽입
if MARK_START in html:
    html = swap_between(html, MARK_START, MARK_END, MARKUP.split(MARK_START, 1)[1].rsplit(MARK_END, 1)[0].strip("\n") + "\n          ")
else:
    anchor = '          <div class="office-actors" id="officeActors">'
    if anchor not in html:
        raise SystemExit("office-actors not found")
    i = html.index(anchor)
    close = html.index("</div>", html.index("<!-- OFFICE-WALKERS" ) if False else i)
    # office-actors 블록 끝(대응 </div>) 찾기
    depth = 0
    j = i
    while True:
        o = html.find("<div", j)
        c = html.find("</div>", j)
        if c < 0:
            raise SystemExit("unbalanced actors")
        if 0 <= o < c:
            depth += 1
            j = o + 4
        else:
            depth -= 1
            j = c + 6
            if depth == 0:
                break
    html = html[:j] + "\n" + MARKUP + html[j:]
print("markup ok")

# 2) CSS
css_body = CSS.split("/* OFFICE3D-CSS:START */", 1)[1].rsplit("/* OFFICE3D-CSS:END */", 1)[0].strip("\n")
if "/* OFFICE3D-CSS:START */" in html:
    html = swap_between(html, "/* OFFICE3D-CSS:START */", "/* OFFICE3D-CSS:END */", css_body + "\n  ")
else:
    html = html.replace("\n</style>", "  /* OFFICE3D-CSS:START */\n" + css_body + "\n  /* OFFICE3D-CSS:END */\n</style>", 1)
print("css ok")

# 3) 스크립트
script = "<script type=\"module\">\n" + js + "\n</script>"
if "<!-- OFFICE3D-SCRIPT:START -->" in html:
    html = swap_between(html, "<!-- OFFICE3D-SCRIPT:START -->", "<!-- OFFICE3D-SCRIPT:END -->", script + "\n")
else:
    pos = html.rindex("</body>")
    html = html[:pos] + "<!-- OFFICE3D-SCRIPT:START -->\n" + script + "\n<!-- OFFICE3D-SCRIPT:END -->\n" + html[pos:]
print("script ok")

io.open(INDEX, "w", encoding="utf-8").write(html)
print("index.html %d → %d bytes" % (orig, len(html)))
