#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""나은 비서실 — 오피스 맵을 '걸어 다니는 10명'으로 재구성한다.

배경  : assets/office-room.jpg (빈 클레이 3D 오피스, 1200×1200) → Base64 인라인
캐릭터: sprites/*.png 10장 → Base64 인라인
움직임: 방 바닥의 '통로 노드 그래프' 위에서만 걷는다(BFS 경로).
        - 발밑 타원 그림자(접지) + 깊이 스케일 + y좌표 z-index 정렬
        - 걷기 바운스 + 좌우 방향 전환 + 도착 후 대기 + 가끔 말풍선
        - prefers-reduced-motion 이면 제자리에 정지

여러 번 실행해도 같은 결과가 나온다(마커 사이만 교체).
실행: python3 build-walkers.py
"""

import base64
import io
import os

from PIL import Image

BASE = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.join(BASE, "index.html")
ROOM = os.path.join(BASE, "assets", "office-room.jpg")
SPRITEDIR = os.path.join(BASE, "sprites")

# ── 방 바닥 통로 노드 (%, %, 발밑 기준) — 가구를 피해 이어진 복도 ────────────
NODES = [
    (8, 61),    # 0  왼쪽 벽 아래
    (15, 68),   # 1
    (23, 76),   # 2
    (33, 82),   # 3  왼쪽 아래 모서리
    (45, 79),   # 4  아래 띠
    (47, 70),   # 5  책상 사이 통로
    (46, 56),   # 6  가운데 세로 통로
    (47, 45),   # 7  지휘실 앞 복도 왼쪽
    (53, 42),   # 8
    (60, 43),   # 9
    (65, 46),   # 10
    (54, 52),   # 11 러그 왼쪽
    (55, 58),   # 12 러그 아래
    (62, 62),   # 13 러그 오른쪽 아래
    (67, 57),   # 14 소파 앞 왼쪽
    (72, 56),   # 15
    (78, 58),   # 16
    (84, 57),   # 17 오른쪽 끝
]
EDGES = [(i, i + 1) for i in range(10)]          # 왼쪽 → 아래 → 가운데 → 지휘실
EDGES += [(9, 11)]                               # 지휘실 복도 ↔ 러그
EDGES += [(i, i + 1) for i in range(11, len(NODES) - 1)]   # 러그 → 소파 앞 → 오른쪽 끝

# 이름, 공간, 스프라이트, 이름표 보조문구, 활동 말풍선, 서 있는 자리(노드 번호)
PEOPLE = [
    ("뮤즈",     "command", "muse.png",     "",       "AI 트렌드 브리핑|경품 확인",   [7, 8]),
    ("인스팅트", "command", "instinct.png", "",       "5대 플랫폼 수집|오피넷 유가",  [9, 10, 8]),
    ("초록",     "meeting", "chorok.png",   "(메인)", "발표 명단 확인|트래커 집계",   [0, 1, 2]),
    ("노랑",     "meeting", "norang.png",   "",       "체험단 접수|설문 마감",        [1, 2, 3]),
    ("진분홍",   "meeting", "pink.png",     "",       "응모 정리|레뷰 확인",          [2, 3, 4]),
    ("막내",     "meeting", "maknae.png",   "",       "핫딜헌터|해피방 중계",         [3, 4, 5]),
    ("하크",     "lounge",  "hark.png",     "",       "해피방 감지|협업 건 처리",     [15, 17]),
    ("부이",     "lounge",  "vooy.png",     "",       "협업 건 정리|중계 확인",       [16, 14]),
    ("큐",       "lounge",  "q.png",        "",       "회의 준비|일정 확인",          [11, 13]),
    ("키링",     "lounge",  "keyring.png",  "",       "알림 정리|예약 확인",          [13, 12]),
]


def jpeg_uri(path, size, quality=84):
    im = Image.open(path).convert("RGB").resize(size, Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=quality, optimize=True, progressive=True)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode(), len(buf.getvalue())


def png_uri(path):
    im = Image.open(path).convert("RGBA")
    q = im.quantize(colors=256, method=Image.FASTOCTREE)
    buf = io.BytesIO()
    q.save(buf, "PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode(), len(buf.getvalue())


ROOM_URI, room_bytes = jpeg_uri(ROOM, (1200, 1200))
print("room  %d KB" % (room_bytes // 1024))

walkers_html = []
for name, space, sprite, sub, acts, spots in PEOPLE:
    uri, n = png_uri(os.path.join(SPRITEDIR, sprite))
    print("  %-8s %2d KB" % (name, n // 1024))
    w, h = Image.open(os.path.join(SPRITEDIR, sprite)).size
    label = "<b>%s</b>%s" % (name, ("<small>%s</small>" % sub) if sub else "")
    x, y = NODES[spots[0]]
    walkers_html.append(
        '            <button class="walker" type="button" data-member="%s" data-space="%s" '
        'data-spots="%s" data-acts="%s" style="left:%g%%; top:%g%%" '
        'title="%s 상세 보기" aria-label="%s 상세 보기">\n'
        '              <span class="walker-inner">\n'
        '                <span class="walker-shadow" aria-hidden="true"></span>\n'
        '                <span class="walker-art"><img src="%s" alt="" width="%d" height="%d" '
        'decoding="async" draggable="false"></span>\n'
        '                <span class="nametag" data-member="%s" data-space="%s">%s</span>\n'
        '                <span class="walker-bubble" aria-hidden="true"></span>\n'
        '              </span>\n'
        '            </button>'
        % (name, space, ",".join(str(s) for s in spots), acts, x, y, name, name,
           uri, w, h, name, space, label)
    )

STAGE = """<div class="office-stage" id="officeStage">
        <div class="office-zoom" id="officeZoom">
          <img class="office-room" src="%s" alt="열 명의 비서가 지휘실·회의실·라운지 사이를 오가는 클레이 3D 오피스" decoding="async" fetchpriority="high">
          <div class="office-actors" id="officeActors">
%s
          </div>
        </div>
        <div class="office-overlay">
          <button class="pin pin-meeting" type="button" data-space="meeting" aria-pressed="true"><span class="pin-dot" aria-hidden="true"></span>대회의실</button>
          <button class="pin pin-command" type="button" data-space="command" aria-pressed="false"><span class="pin-dot" aria-hidden="true"></span>지휘실</button>
          <button class="pin pin-lounge" type="button" data-space="lounge" aria-pressed="false"><span class="pin-dot" aria-hidden="true"></span>라운지</button>
        </div>
      </div>""" % (ROOM_URI, "\n".join(walkers_html))

STAGE_TEXT = "      <!-- OFFICE-STAGE:START -->\n" + STAGE + "\n      <!-- OFFICE-STAGE:END -->"

CSS_TEXT = """  .office-stage{--chH:14.8cqw; container-type:inline-size}
  .office-zoom{overflow:hidden}
  .office-room{display:block; width:100%; height:100%; object-fit:cover; user-select:none; -webkit-user-drag:none}
  .office-actors{position:absolute; inset:0; z-index:1}
  .walker{
    position:absolute; z-index:40; margin:0; padding:0; border:0; background:none; width:2px; height:2px;
    transform:translate(-50%,-50%); cursor:pointer; -webkit-tap-highlight-color:transparent;
    transition:left var(--dur,2.4s) cubic-bezier(.35,.02,.3,1), top var(--dur,2.4s) cubic-bezier(.35,.02,.3,1), opacity .38s ease;
  }
  .walker-inner{
    position:absolute; left:50%; bottom:0; display:flex; flex-direction:column-reverse; align-items:center;
    transform:translateX(-50%) scale(var(--ds,1)); transform-origin:50% 100%;
    transition:transform var(--dur,2.4s) cubic-bezier(.35,.02,.3,1);
  }
  /* 발밑 접지 그림자 — 빛은 위쪽 램프에서 오므로 살짝 아래로 */
  .walker-shadow{
    position:absolute; left:50%; bottom:-1px; width:calc(var(--chH) * .60); height:calc(var(--chH) * .155);
    transform:translate(-50%,42%); border-radius:50%; pointer-events:none;
    background:radial-gradient(closest-side, rgba(60,42,28,.46), rgba(60,42,28,.24) 52%, rgba(60,42,28,.06) 78%, rgba(60,42,28,0) 100%);
    filter:blur(.6px);
  }
  .walker-art{display:block; transform-origin:50% 92%; transition:transform .22s ease}
  .walker-art img{
    display:block; height:var(--chH); width:auto; max-width:none; user-select:none; -webkit-user-drag:none;
    filter:drop-shadow(0 1px 1px rgba(70,50,34,.14));
  }
  .walker.flip .walker-art{transform:scaleX(-1)}
  .walker.walking .walker-art img{animation:walkStep var(--step,.6s) ease-in-out infinite}
  .walker.walking .walker-shadow{animation:walkShadow var(--step,.6s) ease-in-out infinite}
  .walker:not(.walking) .walker-art img{animation:walkBreath 6s ease-in-out infinite}
  @keyframes walkStep{
    0%{transform:translateY(0) rotate(-1.1deg)}
    50%{transform:translateY(-4.5%) rotate(1.1deg)}
    100%{transform:translateY(0) rotate(-1.1deg)}
  }
  @keyframes walkShadow{0%,100%{transform:translate(-50%,42%) scale(1)}50%{transform:translate(-50%,42%) scale(.9)}}
  @keyframes walkBreath{0%,100%{transform:translateY(0)}50%{transform:translateY(-1.4%)}}
  /* 이름표는 캐릭터 머리 위로 */
  .walker .nametag{
    position:relative; left:auto; top:auto; transform:none; animation:none; z-index:auto;
    max-width:none; white-space:nowrap; margin-bottom:1px; font-size:var(--tagF);
    padding:.3em .68em .3em .55em; gap:.38em; box-shadow:0 2px 8px rgba(90,65,45,.20);
  }
  .walker .nametag::after{width:.5em; height:.5em; bottom:-.26em}
  .walker:hover .nametag, .walker:focus-visible .nametag{background:#fff; box-shadow:0 5px 14px rgba(90,65,45,.26)}
  .walker-bubble{
    position:absolute; left:50%; bottom:100%; margin-bottom:2px; padding:3px 8px; border-radius:12px;
    background:rgba(255,255,255,.97); color:#5A4839; font-size:calc(var(--tagF) * .92); font-weight:700;
    letter-spacing:-.2px; white-space:nowrap; pointer-events:none; opacity:0;
    transform:translate(-50%,2px) scale(.94); transition:opacity .3s ease, transform .3s ease;
    box-shadow:0 5px 14px rgba(90,65,45,.20);
  }
  .walker-bubble.show{opacity:1; transform:translate(-50%,-4px) scale(1)}
  /* 구역 핀은 벽 쪽으로 (캐릭터·이름표와 겹치지 않게) */
  .pin-meeting{left:13%; top:36%}
  .pin-command{left:50%; top:20%}
  .pin-lounge{left:87%; top:40%}
  /* 구역 스포트라이트 — 다른 구역 캐릭터는 물러난다 */
  .office-stage.focus-meeting .walker:not([data-space="meeting"]),
  .office-stage.focus-command .walker:not([data-space="command"]),
  .office-stage.focus-lounge .walker:not([data-space="lounge"]){opacity:.46}
  .office-stage.focus-meeting .walker:not([data-space="meeting"]) .nametag,
  .office-stage.focus-command .walker:not([data-space="command"]) .nametag,
  .office-stage.focus-lounge .walker:not([data-space="lounge"]) .nametag{opacity:.55}
  @media (max-width:720px){
    .office-stage{--chH:16cqw}
    .walker-bubble{font-size:8.5px; padding:2px 6px}
    .pin{font-size:11px; padding:5px 9px; gap:4px}
  }
  @media (max-width:560px){
    .office-stage{--chH:16.8cqw}
    .walker .nametag{padding:2px 5px 2px 4px; gap:2.5px; font-size:8px; box-shadow:0 1px 4px rgba(90,65,45,.22)}
    .walker-shadow{filter:none}
    .walker-bubble{display:none}
    .pin{font-size:8.5px; padding:3.5px 7px; gap:4px}
    .pin .pin-dot{width:6px; height:6px}
    .pin-command{left:50%; top:22%}
    .pin-meeting{left:12%; top:37%}
    .pin-lounge{left:86%; top:41%}
  }
  @media (prefers-reduced-motion: reduce){
    .walker, .walker-inner{transition:none}
    .walker-art img, .walker-shadow{animation:none !important}
  }
"""

JS_TEXT = """  (function(){
    var stage = $('#officeStage'), layer = $('#officeActors');
    if (!stage || !layer) return;
    var NODES = __NODES__;
    var EDGES = __EDGES__;
    var ADJ = {};
    NODES.forEach(function(_, i){ ADJ[i] = []; });
    EDGES.forEach(function(e){ ADJ[e[0]].push(e[1]); ADJ[e[1]].push(e[0]); });
    function findPath(a, b){
      if (a === b) return [a];
      var prev = {}, seen = {}, queue = [a];
      seen[a] = true;
      while (queue.length){
        var cur = queue.shift();
        for (var i = 0; i < ADJ[cur].length; i++){
          var nx = ADJ[cur][i];
          if (seen[nx]) continue;
          seen[nx] = true; prev[nx] = cur;
          if (nx === b){
            var path = [b], p = b;
            while (p !== a){ p = prev[p]; path.unshift(p); }
            return path;
          }
          queue.push(nx);
        }
      }
      return null;
    }
    var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var walkers = $$('.walker', layer).map(function(el){
      return {
        el: el,
        bubble: el.querySelector('.walker-bubble'),
        spots: (el.getAttribute('data-spots') || '').split(',').filter(Boolean).map(Number),
        acts: (el.getAttribute('data-acts') || '').split('|').filter(Boolean),
        pos: [parseFloat(el.style.left) || 0, parseFloat(el.style.top) || 0],
        idx: -1, queue: [], busy: false, timer: null
      };
    });
    function crowded(x, y, self){
      for (var i = 0; i < walkers.length; i++){
        var o = walkers[i];
        if (o === self) continue;
        if (Math.abs(o.pos[0] - x) < 3.3 && Math.abs(o.pos[1] - y) < 4.4) return true;
      }
      return false;
    }
    function apply(w, x, y, dur){
      w.pos = [x, y];
      w.el.style.setProperty('--ds', (0.865 + (y - 40) * 0.0062).toFixed(3));
      w.el.style.zIndex = String(10 + Math.round(y));
      if (dur){ w.el.style.setProperty('--dur', dur + 'ms'); }
      w.el.style.left = x + '%';
      w.el.style.top = y + '%';
    }
    function live(w){ return !document.hidden && stage.offsetParent !== null; }
    function step(w){
      if (!w.queue.length){
        w.el.classList.remove('walking'); w.busy = false; schedule(w); return;
      }
      var n = w.queue.shift(), p = NODES[n], cur = w.pos;
      var dist = Math.sqrt(Math.pow(p[0] - cur[0], 2) + Math.pow(p[1] - cur[1], 2));
      var dur = Math.round(Math.min(6000, Math.max(950, dist * 265)));
      if (p[0] < cur[0] - 0.4) w.el.classList.add('flip');
      else if (p[0] > cur[0] + 0.4) w.el.classList.remove('flip');
      w.el.style.setProperty('--step', '560ms');
      w.el.classList.add('walking');
      apply(w, p[0], p[1], dur);
      w.timer = setTimeout(function(){ w.idx = n; step(w); }, dur + 70);
    }
    function goTo(w, nodeIdx){
      var path = findPath(w.idx, nodeIdx);
      if (!path || path.length < 2) return false;
      w.queue = path.slice(1);
      w.busy = true; step(w);
      return true;
    }
    function schedule(w){
      if (reduce) return;
      clearTimeout(w.timer);
      w.timer = setTimeout(function(){ pick(w); }, 2400 + Math.random() * 5200);
    }
    function far(cands, w){
      var best = cands[0], bestD = -1;
      cands.forEach(function(i){
        var d = Math.abs(NODES[i][0] - w.pos[0]) + Math.abs(NODES[i][1] - w.pos[1]);
        if (d > bestD){ bestD = d; best = i; }
      });
      return best;
    }
    function pick(w){
      if (!live(w)){ schedule(w); return; }
      var free = w.spots.filter(function(i){
        return i !== w.idx && !crowded(NODES[i][0], NODES[i][1], w);
      });
      if (!free.length){ schedule(w); return; }
      var target = (free.length > 1 && Math.random() < 0.34)
        ? far(free, w)
        : free[(Math.random() * free.length) | 0];
      if (!goTo(w, target)) schedule(w);
    }
    var bubbleOn = null;      // 한 번에 한 명만 말풍선
    function bubbleLoop(w){
      setTimeout(function(){
        if (!bubbleOn && live(w) && !w.busy && w.acts.length){
          bubbleOn = w;
          w.bubble.textContent = w.acts[(Math.random() * w.acts.length) | 0];
          w.bubble.classList.add('show');
          setTimeout(function(){ w.bubble.classList.remove('show'); bubbleOn = null; }, 3600);
        }
        bubbleLoop(w);
      }, 7000 + Math.random() * 15000);
    }
    walkers.forEach(function(w, i){
      var start = w.spots[0];
      for (var k = 0; k < w.spots.length; k++){
        var t = w.spots[k];
        if (!crowded(NODES[t][0], NODES[t][1], w)){ start = t; break; }
      }
      w.idx = start;
      apply(w, NODES[start][0], NODES[start][1], 0);
      w.el.classList.remove('walking');
      if (!reduce){
        w.timer = setTimeout(function(){ pick(w); }, 2200 + i * 900);
        bubbleLoop(w);
      }
    });
    document.addEventListener('visibilitychange', function(){
      if (!document.hidden) walkers.forEach(function(w){ if (!w.busy) schedule(w); });
    });
  })();
""".replace("__NODES__", "[" + ",".join("[%g,%g]" % n for n in NODES) + "]") \
   .replace("__EDGES__", "[" + ",".join("[%d,%d]" % e for e in EDGES) + "]")


def swap_between(html, start_marker, end_marker, body, fallback_anchor):
    """마커 사이를 body로 교체(마커는 남긴다). 마커가 없으면 fallback_anchor 앞에 삽입."""
    if start_marker in html and end_marker in html:
        pre, rest = html.split(start_marker, 1)
        _, post = rest.split(end_marker, 1)
        return pre + start_marker + "\n" + body + "\n" + end_marker + post
    i = html.find(fallback_anchor)
    if i < 0:
        raise SystemExit("anchor not found: %r" % fallback_anchor[:40])
    return html[:i] + start_marker + "\n" + body + "\n" + end_marker + "\n" + html[i:]


html = io.open(INDEX, encoding="utf-8").read()
orig = len(html)

# 1) 오피스 스테이지 (마커 사이 교체 / 처음이면 기존 office-stage 블록을 찾아 교체)
if "<!-- OFFICE-STAGE:START -->" in html and "<!-- OFFICE-STAGE:END -->" in html:
    pre, rest = html.split("<!-- OFFICE-STAGE:START -->", 1)
    _, post = rest.split("<!-- OFFICE-STAGE:END -->", 1)
    html = pre + "<!-- OFFICE-STAGE:START -->\n" + STAGE + "\n      <!-- OFFICE-STAGE:END -->" + post
    print("stage rebuilt (markers)")
else:
    start = html.find('<div class="office-stage" id="officeStage">')
    if start < 0:
        raise SystemExit("office-stage not found")
    # 여는 <div> 하나만 세어 대응하는 </div> 직전까지 자른다
    open_tag_end = html.find(">", start) + 1
    depth = 1
    i = open_tag_end
    while depth:
        o = html.find("<div", i)
        c = html.find("</div>", i)
        if c < 0:
            raise SystemExit("unbalanced office-stage")
        if 0 <= o < c:
            depth += 1
            i = o + 4
        else:
            depth -= 1
            i = c + 6
    line_start = html.rfind("\n", 0, start) + 1
    html = html[:line_start] + STAGE_TEXT + html[i:]
    print("stage replaced")

# 2) CSS / 3) JS
html = swap_between(html, "  /* OFFICE-WALKERS-CSS:START */", "  /* OFFICE-WALKERS-CSS:END */",
                    CSS_TEXT.strip("\n").rstrip(), "\n</style>")
print("css in")
html = swap_between(html, "  /* OFFICE-WALKERS-JS:START */", "  /* OFFICE-WALKERS-JS:END */",
                    JS_TEXT.strip("\n").rstrip(), "  /* ── 지휘실 모달 ── */")
print("js in")

# 4) 이름표 클릭 → 캐릭터 클릭
old_click = ("$$('.nametag').forEach(function(tag){\n"
             "    tag.addEventListener('click', function(){ openMember(tag.getAttribute('data-member')); });\n"
             "  });")
new_click = ("$$('.walker').forEach(function(tag){\n"
             "    tag.addEventListener('click', function(){ openMember(tag.getAttribute('data-member')); });\n"
             "  });")
if old_click in html:
    html = html.replace(old_click, new_click, 1)
    print("click -> walker")
elif new_click not in html:
    raise SystemExit("click handler not found")

# 5) 안내 문구
html = html.replace("세 공간에 열 명의 비서가 자리 잡고 있습니다", "세 공간을 열 명의 비서가 걸어 다닙니다")
html = html.replace("이름표를 누르면 비서 상세로", "캐릭터를 누르면 비서 상세로")

io.open(INDEX, "w", encoding="utf-8").write(html)
print("index.html %d → %d bytes" % (orig, len(html)))
