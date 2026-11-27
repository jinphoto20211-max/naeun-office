#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""나은 비서실 — 오피스 맵 개조 스크립트.

1) 빈 방 배경(downloads/naeun-office-empty.png) + 10명 스프라이트를 Base64로 인라인
2) 이름표 대신 '걸어 다니는 캐릭터'(머리 위 이름표 + 스프라이트) 10명 배치
3) AI한도 탭 제거 (탭·본문·전용 JS)
4) 오이 표기 정리 (비서 10명 + 막내 분신·텔레그램 중계)

여러 번 실행해도 같은 결과가 나오도록 마커/존재 확인을 거친다.
실행: python3 work/naeun-office/build-people.py work/naeun-office/index.html
"""

import base64, io, os, re, sys
from PIL import Image

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(BASE))
ROOM_SRC = os.path.join(ROOT, "downloads", "naeun-office-empty.png")
SPRITES = os.path.join(BASE, "sprites")

# 이름, 파일, 이동 좌표(%), 공간
PEOPLE = [
    ("초록", "chorok.png", "meeting", [[43, 47], [45, 52], [35, 38], [48, 74], [47, 58]]),
    ("노랑", "norang.png", "meeting", [[11, 63], [22, 72], [48, 74], [45, 52], [43, 47]]),
    ("진분홍", "pink.png", "meeting", [[62, 58], [66, 60], [77, 58], [45, 52], [47, 58]]),
    ("막내", "maknae.png", "meeting", [[30, 86], [48, 74], [45, 52], [22, 72], [36, 88]]),
    ("뮤즈", "muse.png", "command", [[55, 38], [45, 39], [62, 58], [45, 52], [43, 47]]),
    ("인스팅트", "instinct.png", "command", [[56, 86], [45, 52], [55, 38], [48, 74], [45, 39]]),
    ("하크", "hark.png", "lounge", [[77, 58], [66, 60], [62, 58], [85, 70], [77, 58]]),
    ("부이", "vooy.png", "lounge", [[85, 70], [81, 88], [66, 60], [62, 58], [77, 58]]),
    ("큐", "q.png", "lounge", [[56, 86], [81, 88], [85, 70], [45, 52], [48, 74]]),
    ("키링", "keyring.png", "lounge", [[66, 60], [77, 58], [62, 58], [30, 86], [66, 60]]),
]

TAG_LABEL = {"뮤즈": "뮤즈(하마)", "초록": "초록(메인)"}


def data_uri_room():
    im = Image.open(ROOM_SRC).convert("RGB")
    im = im.resize((1200, 1200), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=86, optimize=True, progressive=True)
    raw = buf.getvalue()
    print("room jpeg %d KB" % (len(raw) // 1024))
    return "data:image/jpeg;base64," + base64.b64encode(raw).decode()


def data_uri_sprite(name):
    im = Image.open(os.path.join(SPRITES, name)).convert("RGBA")
    # 180px 높이 그대로, 알파 유지한 채 팔레트 최적화
    q = im.quantize(colors=256, method=Image.FASTOCTREE)
    buf = io.BytesIO()
    q.save(buf, "PNG", optimize=True)
    raw = buf.getvalue()
    return "data:image/png;base64," + base64.b64encode(raw).decode(), len(raw)


WALKERS_CSS = """
  /* WALKERS-CSS:START */
  .office-stage{--walkH:70px}
  .pin{z-index:900}
  .walker{position:absolute; transform:translate(-50%,-100%); z-index:40; border:0; background:none;
    padding:0; cursor:pointer; -webkit-tap-highlight-color:transparent;
    transition:left 3.8s ease-in-out, top 3.8s ease-in-out, opacity .25s ease}
  .walker-art{display:block; transform-origin:50% 88%; transition:transform .3s ease}
  .walker.flip .walker-art{transform:scaleX(-1)}
  .walker-art img{display:block; height:var(--walkH); width:auto; max-width:none;
    filter:drop-shadow(0 7px 9px rgba(74,52,36,.22)); animation:walkBob 1.15s ease-in-out infinite}
  @keyframes walkBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3.5px)}}
  .walker-tag{position:absolute; left:50%; bottom:calc(100% - 3px); transform:translateX(-50%);
    display:inline-flex; align-items:center; gap:5px; padding:3px 8px 3px 7px; border-radius:999px;
    background:rgba(255,255,255,.94); border:1px solid rgba(255,255,255,.95); color:#3F342D;
    font-size:11px; font-weight:800; letter-spacing:-.2px; white-space:nowrap; line-height:1.2;
    box-shadow:0 3px 9px rgba(90,65,45,.18); transition:background .2s, box-shadow .2s}
  .walker-tag::before{content:""; width:6px; height:6px; border-radius:50%; background:#22c55e;
    box-shadow:0 0 0 2px rgba(34,197,94,.2); flex:0 0 auto}
  .walker[data-status="idle"] .walker-tag::before{background:#f59e0b; box-shadow:0 0 0 2px rgba(245,158,11,.22)}
  .walker[data-status="offline"] .walker-tag::before{background:#9ca3af; box-shadow:0 0 0 2px rgba(156,163,175,.24)}
  .walker[data-status="offline"] .walker-art{opacity:.72}
  .walker:hover .walker-tag{background:#fff; box-shadow:0 6px 16px rgba(90,65,45,.24)}
  .walker:focus-visible{outline:2px solid var(--pink-deep); outline-offset:4px; border-radius:14px}
  .office-stage.focus-meeting .walker:not([data-space="meeting"]),
  .office-stage.focus-command .walker:not([data-space="command"]),
  .office-stage.focus-lounge .walker:not([data-space="lounge"]){opacity:.62}
  @media (max-width:720px){ .walker-tag{font-size:9.5px; padding:2px 7px 2px 6px; gap:4px} }
  /* WALKERS-CSS:END */
"""

WALKERS_JS = """
  /* WALKERS-JS:START */
  (function(){
    var stageEl = $('#officeStage');
    if (!stageEl) return;
    var WALKERS = $$('.walker');
    function sizeWalkers(){
      stageEl.style.setProperty('--walkH', Math.round(stageEl.clientWidth * 0.121) + 'px');
    }
    sizeWalkers();
    window.addEventListener('resize', sizeWalkers);
    var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var occupy = {};
    WALKERS.forEach(function(el, i){
      var pts = (el.getAttribute('data-route') || '').split(';').filter(Boolean).map(function(p){
        var xy = p.split(','); return [+xy[0], +xy[1]];
      });
      if (!pts.length) return;
      var idx = (i * 2) % pts.length;
      var name = el.getAttribute('data-member');
      var clear = function(p){
        var ok = true;
        Object.keys(occupy).forEach(function(k){
          if (k === name) return;
          var o = occupy[k], dx = o[0] - p[0], dy = (o[1] - p[1]) * 1.1;
          if (Math.sqrt(dx * dx + dy * dy) < 11) ok = false;
        });
        return ok;
      };
      var place = function(p){
        el.style.left = p[0] + '%';
        el.style.top = p[1] + '%';
        el.style.zIndex = String(Math.round(p[1]));
        occupy[name] = p;
      };
      var first = pts[idx];
      for (var t = 0; t < pts.length && !clear(first); t++) first = pts[(idx + t) % pts.length];
      place(first);
      if (reduce) return;
      var tick = function(){
        if (document.hidden) { setTimeout(tick, 5000); return; }
        var n = (idx + 1 + (Math.random() < 0.35 ? 1 : 0)) % pts.length;
        for (var k = 0; k < pts.length && !clear(pts[n]); k++) n = (n + 1) % pts.length;
        var from = pts[idx], to = pts[n];
        if (to[0] < from[0] - 0.5) el.classList.add('flip');
        else if (to[0] > from[0] + 0.5) el.classList.remove('flip');
        place(to);
        idx = n;
        setTimeout(tick, 4200 + Math.random() * 2400);
      };
      setTimeout(tick, 1200 + i * 560);
    });
  })();
  /* WALKERS-JS:END */
"""


def walkers_html():
    out = ['<!-- WALKERS:START -->']
    for name, sprite, space, pts in PEOPLE:
        uri, n = data_uri_sprite(sprite)
        print("  sprite %-8s %d KB" % (name, n // 1024))
        route = ";".join("%g,%g" % (p[0], p[1]) for p in pts)
        label = TAG_LABEL.get(name, name)
        out.append('<button class="walker" type="button" data-member="%s" data-space="%s" '
                   'data-route="%s" style="left:%g%%;top:%g%%" title="%s 상세 보기" '
                   'aria-label="%s 상세 보기">'
                   % (name, space, route, pts[0][0], pts[0][1], name, name))
        out.append('<span class="walker-art"><img src="%s" alt="" width="90" height="180" '
                   'decoding="async"></span>' % uri)
        out.append('<span class="walker-tag" aria-hidden="true">%s</span>' % label)
        out.append('</button>')
    out.append('<!-- WALKERS:END -->')
    return "\n          ".join(out)


def strip_between(html, start, end):
    """마커 사이(마커 포함)를 지운다. 없으면 그대로."""
    if start not in html:
        return html
    pre, rest = html.split(start, 1)
    _, post = rest.split(end, 1)
    return pre + post


def main(path):
    html = io.open(path, encoding="utf-8").read()

    # ── 1) 배경 이미지 교체 ──────────────────────────────────────────
    if "data:image/jpeg;base64" not in html.split('class="office-zoom"')[1][:200]:
        room = data_uri_room()
        m = re.search(r'<img src="data:image/[^"]*" alt="[^"]*">', html)
        if not m:
            raise SystemExit("room img not found")
        new = ('<img src="%s" alt="텐 명의 비서가 각자 자리에서 일하는 클레이 3D 오피스 — '
               '둥근 회의 테이블, 모니터 지휘 책상, 소파 라운지, 개별 책상이 있는 빈 방">' % room)
        html = html[:m.start()] + new + html[m.end():]
        print("room image replaced")

    # ── 2) 이름표 → 걷는 캐릭터 ─────────────────────────────────────
    door = 'data-member="오이" title="오이 상세 보기">오이</button>'
    if door in html:
        start = html.index('<button class="nametag nt-1"')
        end = html.index('</button>', html.index('<button class="nametag nt-11"')) + len('</button>')
        html = html[:start] + walkers_html() + html[end:]
        print("nametags -> walkers")
    elif "<!-- WALKERS:START -->" in html:
        pre, rest = html.split("<!-- WALKERS:START -->", 1)
        _, post = rest.split("<!-- WALKERS:END -->", 1)
        html = pre + walkers_html() + post
        print("walkers rebuilt")
    else:
        raise SystemExit("nametag block not found")

    # ── 3) CSS / JS 삽입 ───────────────────────────────────────────
    if "WALKERS-CSS:START" in html:
        pre, rest = html.split("/* WALKERS-CSS:START */", 1)
        _, post = rest.split("/* WALKERS-CSS:END */", 1)
        html = pre + WALKERS_CSS.strip("\n") + post
    else:
        anchor = "  .nt-1{left:41%; top:17%;"
        i = html.index(anchor)
        html = html[:i] + WALKERS_CSS.strip("\n") + "\n" + html[i:]
    # .office-stage img 규칙을 배경 이미지에만 적용 (스프라이트 보호)
    html = html.replace(".office-stage img{display:block; width:100%; height:100%; object-fit:cover; user-select:none; -webkit-user-drag:none}",
                        ".office-zoom > img{display:block; width:100%; height:100%; object-fit:cover; user-select:none; -webkit-user-drag:none}")
    if "WALKERS-JS:START" in html:
        pre, rest = html.split("/* WALKERS-JS:START */", 1)
        _, post = rest.split("/* WALKERS-JS:END */", 1)
        html = pre + WALKERS_JS.strip("\n") + post
    else:
        anchor = "  /* ── 지휘실 모달 ── */"
        if anchor not in html:
            raise SystemExit("js anchor not found")
        html = html.replace(anchor, WALKERS_JS.strip("\n") + "\n\n" + anchor, 1)

    # 클릭·상태 갱신 대상에 .walker 포함
    html = html.replace("$$('.nametag').forEach(function(tag){\n    tag.addEventListener('click'",
                        "$$('.nametag, .walker').forEach(function(tag){\n    tag.addEventListener('click'")
    html = html.replace("$$('.nametag').forEach(function(t){ t.setAttribute('data-status'",
                        "$$('.nametag, .walker').forEach(function(t){ t.setAttribute('data-status'")
    html = html.replace("office-stage.focus-meeting .nametag:not([data-space=\"meeting\"]),",
                        "office-stage.focus-meeting .nametag:not([data-space=\"meeting\"]),")

    # ── 4) AI한도 탭 제거 ─────────────────────────────────────────
    html = html.replace('    <button class="tab" role="tab" id="tab-credit" aria-controls="panel-credit" '
                        'aria-selected="false" tabindex="-1" data-tab="credit">AI한도</button>\n', "")
    if '<!-- ═══ AI한도 ═══ -->' in html:
        pre, rest = html.split("  <!-- ═══ AI한도 ═══ -->", 1)
        _, post = rest.split("  <!-- ═══ 메모 ═══ -->", 1)
        html = pre + "  <!-- ═══ 메모 ═══ -->" + post
        print("AI한도 panel removed")
    if "/* ── AI한도 ── */" in html:
        pre, rest = html.split("  /* ── AI한도 ── */", 1)
        _, post = rest.split("  /* ── 메모 ── */", 1)
        html = pre + "  /* ── 메모 ── */" + post
        print("AI한도 js removed")

    # 탭 8 → 7칸 (트래커 추가, AI한도 제거)
    html = html.replace("grid-template-columns:repeat(8,minmax(0,1fr))",
                        "grid-template-columns:repeat(7,minmax(0,1fr))", 1)

    # ── 5) 오이 표기 정리 ─────────────────────────────────────────
    html = html.replace('<span id="statusChipText">비서 11명 · 온라인 7 · 대기 4</span>',
                        '<span id="statusChipText">비서 10명 · 온라인 6 · 대기 4</span>')
    if 'id="oiChip"' not in html:
        html = html.replace('<span class="chip clock-chip" id="clockChip" aria-live="off">오늘</span>',
                            '<span class="chip clock-chip" id="clockChip" aria-live="off">오늘</span>\n'
                            '      <span class="chip" id="oiChip" title="막내의 분신 — 별도 인원이 아니라 텔레그램 중계 창구입니다">'
                            '🥒 오이 · 막내 분신 · 텔레그램 중계</span>')
    html = html.replace("대회의실 · 지휘실 · 라운지, 세 공간에서 열한 명의 비서가 움직입니다.",
                        "대회의실 · 지휘실 · 라운지, 세 공간에서 열 명의 비서가 움직입니다. (막내 분신 오이는 텔레그램에서 중계)")
    html = html.replace('<div class="bubble-meta"><b>오이</b><span>텔레그램 봇</span></div>',
                        '<div class="bubble-meta"><b>오이</b><span>막내 분신 · 중계</span></div>')
    html = html.replace("<p>피클즈 4인과 해피방 7총사, 열한 명의 담당 영역입니다.</p>",
                        "<p>피클즈 4인 + 해피방 6인, 열 명의 비서 담당 영역입니다. 오이는 막내의 분신으로 텔레그램 중계를 맡아 별도 인원에 넣지 않았습니다.</p>")
    html = html.replace('data-filter="all" aria-pressed="true">전체 11</button>',
                        'data-filter="all" aria-pressed="true">전체 10</button>')
    html = html.replace("<span class=\"e\">🥒</span>오이 <small>텔레그램 봇</small>",
                        "<span class=\"e\">🥒</span>오이 <small>막내 분신 · 중계</small>")

    # 오이 카드는 '막내 분신' 각주로 남긴다 (별도 인원 아님을 카드 자체에 표기)
    html = html.replace('<div class="agent-name"><b>오이</b><span class="handle">텔레그램 봇</span></div>',
                        '<div class="agent-name"><b>오이</b><span class="handle">막내 분신 · 텔레그램 중계</span></div>')
    html = html.replace('<p class="agent-role">해피방 메시지 중계 · 감지</p>',
                        '<p class="agent-role">막내의 분신 — 해피방 메시지 중계·감지 (인원에 미포함)</p>')
    html = html.replace("{ name:'오이', emoji:'🥒', handle:'텔레그램 봇', role:'해피방 메시지 중계 · 감지', status:'online',",
                        "{ name:'오이', emoji:'🥒', handle:'막내 분신 · 텔레그램 중계', role:'막내의 분신 — 해피방 메시지 중계·감지 (인원에 미포함)', status:'online',")

    # 비서 수 계산에서 오이 제외
    old_calc = """    var counts = { online:0, idle:0, offline:0 };
    MEMBERS.forEach(function(m){ counts[statusOf(m.name)]++; });
    var text = $('#statusChipText');
    if (text) {
      var parts = ['비서 ' + MEMBERS.length + '명'];
      if (counts.online) parts.push('온라인 ' + counts.online);
      if (counts.idle) parts.push('대기 ' + counts.idle);
      if (counts.offline) parts.push('오프라인 ' + counts.offline);
      text.textContent = parts.join(' · ');
    }"""
    new_calc = """    var counts = { online:0, idle:0, offline:0 };
    var staffCounts = { online:0, idle:0, offline:0 };
    MEMBERS.forEach(function(m){
      counts[statusOf(m.name)]++;
      if (!m.support) staffCounts[statusOf(m.name)]++;
    });
    var staff = MEMBERS.filter(function(m){ return !m.support; });
    var text = $('#statusChipText');
    if (text) {
      var parts = ['비서 ' + staff.length + '명'];
      if (staffCounts.online) parts.push('온라인 ' + staffCounts.online);
      if (staffCounts.idle) parts.push('대기 ' + staffCounts.idle);
      if (staffCounts.offline) parts.push('오프라인 ' + staffCounts.offline);
      text.textContent = parts.join(' · ');
    }
    var oiChip = $('#oiChip');
    if (oiChip) {
      var oi = findMember('오이');
      oiChip.textContent = '🥒 오이 · 막내 분신 · 텔레그램 중계' + (oi ? ' (' + STATUS_LABEL[statusOf('오이')] + ')' : '');
    }"""
    if old_calc in html:
        html = html.replace(old_calc, new_calc)
        print("status chip calc updated")
    # 오이 MEMBERS 항목에 support 표시
    html = html.replace("role:'막내의 분신 — 해피방 메시지 중계·감지 (인원에 미포함)', status:'online',",
                        "role:'막내의 분신 — 해피방 메시지 중계·감지 (인원에 미포함)', status:'online', support:true,")


    # 비서현황에서 오이 카드는 '막내 분신' 한 줄로 접는다 (별도 인원 아님)
    if 'data-member="오이" data-areas' in html:
        start = html.index('<article class="agent" data-member="오이"')
        end = html.index('</article>', start) + len('</article>')
        html = html[:start] + html[end:]
        html = html.replace('          <li>동행복권 · 패널나우 · 에펨코리아 핫딜</li>',
                            '          <li>동행복권 · 패널나우 · 에펨코리아 핫딜</li>\n'
                            '          <li>막내 분신 오이 — 텔레그램 중계·감지</li>', 1)
        print("oi agent card folded into maknae")

    io.open(path, "w", encoding="utf-8").write(html)
    print("wrote %s (%.0f KB)" % (path, len(html.encode("utf-8")) / 1024))


if __name__ == "__main__":
    for t in (sys.argv[1:] or [os.path.join(BASE, "index.html")]):
        main(t)
