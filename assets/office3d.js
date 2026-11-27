/* 나은 비서실 — 3D 클레이 오피스 (three.js, 인라인 주입용 모듈)
   - 아이소메트릭 카메라 · 부드러운 그림자 · 깊이 정렬(occlusion) 자동
   - 실제 캐릭터 사진대로 다시 지은 11명 캐릭터(걷기·방향 회전·바운스)
   - 책상·테이블·소파·책장·창문 등 사물 클릭 → 정보 카드
   - 드래그 회전 / 핀치·휠 줌 / 탭 선택 (모바일 대응)
   - 질감: 보송한 폴리머 클레이(MeshPhysicalMaterial + sheen + 노이즈 범프)
*/
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

(function () {
  const stage = document.getElementById('officeStage');
  const host = document.getElementById('office3d');
  const canvas = document.getElementById('office3dCanvas');
  const pillLayer = document.getElementById('office3dPills');
  const bar = document.getElementById('office3dBar');
  if (!stage || !host || !canvas || !pillLayer || !bar) return;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { return; }
  if (!renderer || !renderer.getContext()) return;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 200);

  /* ── 팔레트 (레퍼런스: 크림 벽 + 허니 우드 + 세이지) ───────── */
  const C = {
    wall: 0xEDDEC6, wallTrim: 0xDCC7A6, wallBase: 0xE3CFB0,
    floor: 0xC89B68, floorDark: 0xB0854F, floorLight: 0xD6AE7C,
    stone: 0xC2BAAC, stoneDark: 0xB0A89A,
    wood: 0xB9825A, woodDark: 0x94633F, woodLight: 0xD0A374,
    dark: 0x4B3A31, white: 0xFFF9F0, cream: 0xF8EEDE,
    sage: 0xA9BFA6, sageDark: 0x8FA98C, pink: 0xE9AEB2, coral: 0xE9A78F,
    blue: 0x9DC0DC, screen: 0x2B313B, screenOn: 0x7FA6C9,
    leaf: 0x6E9A63, leaf2: 0x86AE74, pot: 0xC08A62,
    rug: 0xF1E5CF, metal: 0x9C9A94, glow: 0xFFE2AE
  };

  /* ── 절차적 텍스처 ─────────────────────────────────────── */
  function noiseTex(size, base, spread, repeat) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const x = c.getContext('2d');
    x.fillStyle = base; x.fillRect(0, 0, size, size);
    const img = x.getImageData(0, 0, size, size);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * spread;
      d[i] = Math.min(255, Math.max(0, d[i] + n));
      d[i + 1] = Math.min(255, Math.max(0, d[i + 1] + n));
      d[i + 2] = Math.min(255, Math.max(0, d[i + 2] + n));
    }
    x.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
    return t;
  }
  const clayBump = noiseTex(128, '#808080', 60, 5);         // 클레이 결
  const fabricBump = noiseTex(128, '#808080', 90, 6);       // 패브릭 결

  function woodFloorTex() {
    const s = 512;
    const c = document.createElement('canvas');
    c.width = c.height = s;
    const x = c.getContext('2d');
    x.fillStyle = '#C99C6A'; x.fillRect(0, 0, s, s);
    const rows = 8, h = s / rows;
    for (let r = 0; r < rows; r++) {
      const y = r * h;
      const tone = 0.93 + Math.random() * 0.13;
      x.fillStyle = 'rgb(' + Math.round(201 * tone) + ',' + Math.round(156 * tone) + ',' + Math.round(106 * tone) + ')';
      x.fillRect(0, y, s, h - 2);
      for (let i = 0; i < 30; i++) {
        x.strokeStyle = 'rgba(146,106,66,' + (0.04 + Math.random() * 0.08).toFixed(3) + ')';
        x.lineWidth = 0.6 + Math.random() * 1.3;
        x.beginPath();
        const yy = y + Math.random() * (h - 4);
        x.moveTo(0, yy);
        x.bezierCurveTo(s * 0.33, yy + (Math.random() - 0.5) * 7, s * 0.66, yy + (Math.random() - 0.5) * 7, s, yy);
        x.stroke();
      }
      x.fillStyle = 'rgba(122,86,54,0.30)';
      x.fillRect(0, y + h - 2, s, 2);
      const jx = (r * 173) % s;
      x.fillStyle = 'rgba(122,86,54,0.16)';
      x.fillRect(jx, y, 2, h - 2);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3.6, 3.6);
    t.anisotropy = 4;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  const floorTex = woodFloorTex();

  function screenTex(seed) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 160;
    const x = c.getContext('2d');
    x.fillStyle = '#232A34'; x.fillRect(0, 0, 256, 160);
    const cols = ['#5E87B8', '#7FB08A', '#D9A574', '#C98BA8', '#8FA9CB'];
    let rnd = seed * 9301 + 49297;
    const rand = () => { rnd = (rnd * 9301 + 49297) % 233280; return rnd / 233280; };
    x.fillStyle = 'rgba(255,255,255,0.08)';
    x.fillRect(8, 8, 240, 18);
    for (let i = 0; i < 4; i++) {
      x.fillStyle = cols[i % cols.length];
      x.globalAlpha = 0.85;
      x.fillRect(10 + i * 60, 34, 50, 30);
    }
    x.globalAlpha = 1;
    for (let i = 0; i < 14; i++) {
      const bh = 8 + rand() * 46;
      x.fillStyle = cols[(i + seed) % cols.length];
      x.globalAlpha = 0.8;
      x.fillRect(12 + i * 16, 150 - bh, 9, bh);
    }
    x.globalAlpha = 1;
    for (let i = 0; i < 3; i++) {
      x.fillStyle = 'rgba(255,255,255,' + (0.10 + i * 0.05) + ')';
      x.fillRect(10, 96 + i * 10, 100 + ((seed * (i + 3)) % 90), 5);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  const screenTexA = screenTex(1), screenTexB = screenTex(2), screenTexC = screenTex(3);

  /* ── 재질: 보송한 클레이 ────────────────────────────────── */
  const clayMat = (color, o) => new THREE.MeshPhysicalMaterial(Object.assign({
    color, roughness: 0.88, metalness: 0,
    sheen: 0.38, sheenRoughness: 0.72, sheenColor: new THREE.Color(0xFFF4E4),
    bumpMap: clayBump, bumpScale: 0.009
  }, o || {}));
  const fabricMat = (color, o) => new THREE.MeshPhysicalMaterial(Object.assign({
    color, roughness: 0.94, metalness: 0,
    sheen: 0.55, sheenRoughness: 0.85, sheenColor: new THREE.Color(0xFFF2E0),
    bumpMap: fabricBump, bumpScale: 0.012
  }, o || {}));
  const softMat = (color, o) => new THREE.MeshStandardMaterial(Object.assign({
    color, roughness: 0.55, metalness: 0
  }, o || {}));

  /* 공용 재질 (셰이더 재사용) */
  const M = {
    wall: clayMat(C.wall),
    wallTrim: clayMat(C.wallTrim),
    wallBase: clayMat(C.wallBase),
    wood: clayMat(C.wood),
    woodDark: clayMat(C.woodDark),
    woodLight: clayMat(C.woodLight),
    stone: clayMat(C.stone, { roughness: 0.92 }),
    stoneDark: clayMat(C.stoneDark, { roughness: 0.92 }),
    cream: clayMat(C.cream),
    sage: fabricMat(C.sage),
    sageDark: fabricMat(C.sageDark),
    pink: fabricMat(C.pink),
    coral: fabricMat(C.coral),
    dark: clayMat(C.dark, { roughness: 0.82 }),
    metal: softMat(C.metal, { roughness: 0.45 }),
    leaf: clayMat(C.leaf, { roughness: 0.92 }),
    leaf2: clayMat(C.leaf2, { roughness: 0.92 }),
    pot: clayMat(C.pot),
    rug: fabricMat(C.rug, { bumpScale: 0.02 }),
    glow: new THREE.MeshStandardMaterial({ color: 0xFFE9C4, emissive: 0xFFCF8A, emissiveIntensity: 0.85, roughness: 0.6 })
  };

  const add = (parent, geo, material, x = 0, y = 0, z = 0, shadow = true) => {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    if (shadow) { m.castShadow = true; m.receiveShadow = true; }
    parent.add(m);
    return m;
  };

  /* ── 클레이 지오메트리 ──────────────────────────────────── */
  // 초타원체(superellipsoid) 둥근 상자 — n이 작을수록 말랑한 곰젤리 모서리
  function clayBox(w, h, d, n, seg) {
    n = n || 3.2; seg = seg || 18;
    const g = new THREE.SphereGeometry(1, seg, Math.max(10, Math.round(seg * 0.65)));
    const p = g.attributes.position;
    const sx = w / 2, sy = h / 2, sz = d / 2;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const k = Math.pow(Math.pow(Math.abs(x), n) + Math.pow(Math.abs(y), n) + Math.pow(Math.abs(z), n), -1 / n);
      p.setXYZ(i, x * k * sx, y * k * sy, z * k * sz);
    }
    p.needsUpdate = true;
    g.computeVertexNormals();
    return g;
  }
  const box = (w, h, d) => clayBox(w, h, d);

  // 모서리가 둥근 원기둥(라테)
  function cyl(rt, rb, h, seg) {
    seg = seg || 24;
    const r = Math.max(0.0008, Math.min(Math.min(rt, rb) * 0.35, h * 0.45));
    const pts = [new THREE.Vector2(0, 0), new THREE.Vector2(Math.max(0.0008, rb - r), 0)];
    for (let i = 1; i <= 4; i++) {
      const a = -Math.PI / 2 + (Math.PI / 2) * (i / 4);
      pts.push(new THREE.Vector2(rb - r + Math.cos(a) * r, r + Math.sin(a) * r));
    }
    for (let i = 1; i <= 4; i++) {
      const a = (Math.PI / 2) * (i / 4);
      pts.push(new THREE.Vector2(rt - r + Math.cos(a) * r, h - r + Math.sin(a) * r));
    }
    pts.push(new THREE.Vector2(0, h));
    const g = new THREE.LatheGeometry(pts, seg);
    g.translate(0, -h / 2, 0);
    return g;
  }

  const sph = (r, s) => {
    s = s || 16;
    return new THREE.SphereGeometry(r, s, Math.max(10, Math.round(s * 0.72)));
  };

  // 둥근 다각형(삼각·스퀘클) 단면
  function roundShape(pts, r) {
    const P = pts.map(p => new THREE.Vector2(p[0], p[1]));
    const n = P.length, s = new THREE.Shape();
    const a = [], b = [];
    for (let i = 0; i < n; i++) {
      const prev = P[(i - 1 + n) % n], cur = P[i], next = P[(i + 1) % n];
      a.push(prev.clone().sub(cur).normalize().multiplyScalar(r).add(cur));
      b.push(next.clone().sub(cur).normalize().multiplyScalar(r).add(cur));
    }
    s.moveTo(b[0].x, b[0].y);
    for (let i = 1; i < n; i++) {
      s.lineTo(a[i].x, a[i].y);
      s.quadraticCurveTo(P[i].x, P[i].y, b[i].x, b[i].y);
    }
    s.lineTo(a[0].x, a[0].y);
    s.quadraticCurveTo(P[0].x, P[0].y, b[0].x, b[0].y);
    s.closePath();
    return s;
  }
  function claySlab(shape, depth, bevel, bevelSeg, curveSeg) {
    const g = new THREE.ExtrudeGeometry(shape, {
      depth, bevelEnabled: true,
      bevelThickness: bevel, bevelSize: bevel,
      bevelSegments: bevelSeg || 6, curveSegments: curveSeg || 24
    });
    g.center();
    return g;
  }
  // 앞뒤 면을 살짝 부풀려 쿠션처럼
  function pillow(geo, w, h, amt) {
    const p = geo.attributes.position;
    const hw = w / 2, hh = h / 2;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const d = Math.min(1, Math.hypot(x / hw, y / hh));
      const k = Math.max(0, 1 - d * d * 0.9);
      p.setZ(i, z + Math.sign(z) * amt * k);
    }
    p.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }
  // 4개 원의 합집합 = 4엽 클로버 실루엣
  function cloverShape(R, d) {
    const s = new THREE.Shape();
    const centers = [[-d, d], [d, d], [-d, -d], [d, -d]];
    const N = 168;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const dx = Math.cos(a), dy = Math.sin(a);
      let t = 0;
      for (let c = 0; c < 4; c++) {
        const [cx, cy] = centers[c];
        const bb = dx * cx + dy * cy;
        const cc = cx * cx + cy * cy - R * R;
        const disc = bb * bb - cc;
        if (disc < 0) continue;
        const tt = bb + Math.sqrt(disc);
        if (tt > t) t = tt;
      }
      const x = dx * t, y = dy * t;
      if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
    }
    s.closePath();
    return s;
  }

  /* ── 조명: 따뜻한 스튜디오 바운스 ───────────────────────── */
  scene.add(new THREE.HemisphereLight(0xFFF6E9, 0xD6BF9F, 0.92));
  const sun = new THREE.DirectionalLight(0xFFE8CE, 1.45);
  sun.position.set(-6.2, 11.5, 8.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -11; sun.shadow.camera.right = 11;
  sun.shadow.camera.top = 11; sun.shadow.camera.bottom = -11;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 40;
  sun.shadow.bias = -0.0011;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 3.5;
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0xEAF1FF, 0.34);   // 차가운 반사광(톤 분리)
  fill.position.set(8.5, 5.5, 7);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xFFE2BC, 0.5);      // 뒤쪽 림광
  rim.position.set(1.5, 6, -10);
  scene.add(rim);
  const lampLight = new THREE.PointLight(0xFFD9A0, 12, 11, 2);
  lampLight.position.set(2.6, 2.6, -5.4);
  scene.add(lampLight);

  /* ── 방: 두툼한 클레이 디오라마 ─────────────────────────── */
  const room = new THREE.Group();
  scene.add(room);
  const R = 7;                        // 바닥 반폭
  const FLOOR_Y = 0.1;                // 캐릭터가 서는 바닥 높이

  // 바닥 슬라브(스톤 받침) + 우드 상판
  const slab = add(room, clayBox(R * 2 + 0.7, 0.9, R * 2 + 0.7, 5.0, 26), M.stone, 0, -0.38, 0);
  slab.castShadow = true;
  const floorPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(R * 2 + 0.66, R * 2 + 0.66),
    new THREE.MeshPhysicalMaterial({
      map: floorTex, roughness: 0.82, metalness: 0,
      sheen: 0.25, sheenRoughness: 0.8, sheenColor: new THREE.Color(0xFFF0DC),
      bumpMap: clayBump, bumpScale: 0.006
    })
  );
  floorPlane.rotation.x = -Math.PI / 2;
  floorPlane.position.y = FLOOR_Y;
  floorPlane.receiveShadow = true;
  room.add(floorPlane);

  // 벽 (뒤·왼쪽): 두껍고 모서리 둥근 크림 벽 + 상단 캡 + 하단 몰딩
  const WALL_H = 3.5, WALL_T = 0.62;
  const wallZ = add(room, clayBox(R * 2 + 1.3, WALL_H, WALL_T, 5.6, 26), M.wall, 0, WALL_H / 2, -R - WALL_T / 2 + 0.06);
  const wallX = add(room, clayBox(WALL_T, WALL_H, R * 2 + 1.3, 5.6, 26), M.wall, -R - WALL_T / 2 + 0.06, WALL_H / 2, 0);
  wallZ.receiveShadow = wallX.receiveShadow = true;
  [wallZ, wallX].forEach((w, i) => {
    const capW = i === 0 ? R * 2 + 1.5 : WALL_T + 0.24;
    const capD = i === 0 ? WALL_T + 0.24 : R * 2 + 0.7;
    const x = i === 0 ? 0 : -R - WALL_T / 2 + 0.06;
    const z = i === 0 ? -R - WALL_T / 2 + 0.06 : 0.4;
    add(room, clayBox(capW, 0.2, capD, 4.4, 20), M.wallTrim, x, WALL_H + 0.02, z);
    add(room, clayBox(capW - 0.06, 0.46, capD - 0.06, 4.4, 20), M.wallBase, x, 0.28, z);
  });

  /* ── 벽면 연출: 액자 · 아치 문 · 네온 사인 · 이젤 · TV · 블라인드 ── */
  function wallFrame(x, y, z, w, h, ry, art) {
    const g = new THREE.Group();
    g.position.set(x, y, z); g.rotation.y = ry || 0;
    add(g, clayBox(w, h, 0.09, 3.2, 16), M.cream, 0, 0, 0);
    add(g, clayBox(w - 0.16, h - 0.16, 0.05, 3.2, 16), clayMat(art, { roughness: 0.9 }), 0, 0, 0.05, false);
    room.add(g);
    return g;
  }
  // 왼쪽 벽 액자 (문과 책장 사이)
  wallFrame(-R + 0.05, 2.30, -0.95, 0.94, 0.74, Math.PI / 2, 0xBFD3D8);
  wallFrame(-R + 0.05, 2.46, 0.00, 0.60, 0.82, Math.PI / 2, 0xE2CBA8);

  // 아치형 나무 문 (왼쪽 벽 앞쪽)
  (function archDoor() {
    const g = new THREE.Group();
    g.position.set(-R + 0.10, 0, 5.20); g.rotation.y = Math.PI / 2;
    const DW = 1.62, DH = 2.46, IW = DW - 0.34, IH = DH - 0.20;
    const shape = new THREE.Shape();
    shape.moveTo(-DW / 2, -DH / 2);
    shape.lineTo(-DW / 2, DH / 2 - DW / 2);
    shape.absarc(0, DH / 2 - DW / 2, DW / 2, Math.PI, 0, true);
    shape.lineTo(DW / 2, -DH / 2);
    shape.closePath();
    const hole = new THREE.Path();
    hole.moveTo(-IW / 2, -DH / 2 + 0.10);
    hole.lineTo(-IW / 2, DH / 2 - DW / 2);
    hole.absarc(0, DH / 2 - DW / 2, IW / 2, Math.PI, 0, true);
    hole.lineTo(IW / 2, -DH / 2 + 0.10);
    hole.closePath();
    shape.holes.push(hole);
    const frame = add(g, claySlab(shape, 0.20, 0.035, 4, 30), M.wood, 0, 0, 0);
    frame.position.y = DH / 2;
    // 문짝
    const leafShape = new THREE.Shape();
    leafShape.moveTo(-IW / 2 + 0.04, -DH / 2 + 0.10);
    leafShape.lineTo(-IW / 2 + 0.04, DH / 2 - DW / 2);
    leafShape.absarc(0, DH / 2 - DW / 2, IW / 2 - 0.04, Math.PI, 0, true);
    leafShape.lineTo(IW / 2 - 0.04, -DH / 2 + 0.10);
    leafShape.closePath();
    const leaf = add(g, claySlab(leafShape, 0.09, 0.03, 4, 26), M.woodLight, 0, 0, 0.06, false);
    leaf.position.y = DH / 2;
    // 판자 홈
    [-0.34, 0, 0.34].forEach(dx => add(g, clayBox(0.035, DH - 0.7, 0.02, 3, 8), M.wood, dx, DH / 2 - 0.12, 0.115, false));
    // 손잡이 + 로봇 명판
    add(g, sph(0.075, 12), clayMat(0xE8CB84, { metalness: 0.3, roughness: 0.38 }), 0.48, 1.02, 0.14, false);
    add(g, clayBox(0.34, 0.24, 0.03, 3.4, 12), M.cream, 0, 1.72, 0.13, false);
    add(g, clayBox(0.20, 0.13, 0.03, 3.0, 10), clayMat(0xC9A279), 0, 1.72, 0.15, false);
    [-0.05, 0.05].forEach(dx => add(g, sph(0.017, 8), M.dark, dx, 1.73, 0.17, false));
    room.add(g);
  })();

  // 벽등 (따뜻한 스콘)
  function wallSconce(x, y, z, ry) {
    const g = new THREE.Group();
    g.position.set(x, y, z); g.rotation.y = ry || 0;
    add(g, clayBox(0.24, 0.30, 0.14, 3, 14), M.woodDark, 0, 0, 0);
    add(g, sph(0.155, 16), M.glow, 0, 0.02, 0.13, false).scale.set(1, 1.1, 1);
    const pl = new THREE.PointLight(0xFFDCA8, 3.6, 4.6, 2);
    pl.position.set(0, 0.05, 0.26);
    g.add(pl);
    room.add(g);
    return g;
  }
  wallSconce(-R + 0.16, 2.62, 0.62, Math.PI / 2);
  wallSconce(2.98, 2.74, -R + 0.16, 0);

  // 네온 아치 사인 — '나은 비서실'
  (function neonSign() {
    const W = 900, H = 900;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.clearRect(0, 0, W, H);
    const ax = W / 2, halfW = 322, topY = 520, botY = 866, rad = halfW;

    // 아치 테두리 (이중 네온)
    const arch = () => {
      x.beginPath();
      x.moveTo(ax - halfW, botY);
      x.lineTo(ax - halfW, topY);
      x.arc(ax, topY, rad, Math.PI, 0);
      x.lineTo(ax + halfW, botY);
      x.stroke();
    };
    x.lineCap = 'round';
    x.strokeStyle = 'rgba(255,205,132,0.95)';
    x.lineWidth = 12; x.shadowColor = 'rgba(255,196,112,1)'; x.shadowBlur = 46; arch();
    x.shadowBlur = 20; x.strokeStyle = 'rgba(255,242,210,1)'; x.lineWidth = 6; arch();
    x.shadowBlur = 0;

    // 로봇 얼굴 아이콘 (아치 안쪽 위)
    x.save();
    x.translate(ax, 322);
    x.shadowColor = 'rgba(255,204,128,1)'; x.shadowBlur = 26;
    x.fillStyle = 'rgba(255,232,190,1)';
    const rw = 96, rh = 74, rr = 24;
    x.beginPath();
    x.moveTo(-rw + rr, -rh); x.lineTo(rw - rr, -rh); x.quadraticCurveTo(rw, -rh, rw, -rh + rr);
    x.lineTo(rw, rh - rr); x.quadraticCurveTo(rw, rh, rw - rr, rh);
    x.lineTo(-rw + rr, rh); x.quadraticCurveTo(-rw, rh, -rw, rh - rr);
    x.lineTo(-rw, -rh + rr); x.quadraticCurveTo(-rw, -rh, -rw + rr, -rh);
    x.fill();
    x.shadowBlur = 0;
    x.fillStyle = 'rgba(255,247,232,1)';
    x.fillRect(-5, -rh - 30, 10, 30);
    x.beginPath(); x.arc(0, -rh - 36, 13, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#3B2E24';
    x.beginPath(); x.arc(-30, 2, 13, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.arc(30, 2, 13, 0, Math.PI * 2); x.fill();
    x.restore();

    // 사인 텍스트
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.font = '800 118px "Pretendard","Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR",sans-serif';
    x.shadowColor = 'rgba(255,198,116,1)'; x.shadowBlur = 38;
    x.fillStyle = 'rgba(255,214,150,1)';
    x.fillText('나은 비서실', ax, 600);
    x.shadowBlur = 10;
    x.fillStyle = 'rgba(255,248,232,1)';
    x.fillText('나은 비서실', ax, 600);
    x.shadowBlur = 0;
    x.font = '600 38px "Pretendard","Malgun Gothic",sans-serif';
    x.fillStyle = 'rgba(255,235,198,0.92)';
    x.fillText('AI  ASSISTANT  OFFICE', ax, 690);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(2.38, 2.38),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false })
    );
    plane.position.set(1.45, 2.30, -R + 0.115);
    room.add(plane);

    // 사인 앞 은은한 확산광
    const halo = new THREE.PointLight(0xFFC98C, 7.5, 6.4, 2);
    halo.position.set(1.45, 2.55, -R + 1.0);
    room.add(halo);
  })();

  // 체크리스트 이젤 보드 (뒤 벽 오른쪽)
  (function checklistEasel() {
    const g = new THREE.Group();
    g.position.set(3.72, FLOOR_Y, -R + 0.52);
    g.rotation.x = -0.10;
    [-1, 1].forEach(s => {
      const leg = add(g, clayBox(0.075, 1.30, 0.075, 3, 8), M.woodLight, s * 0.36, 0.62, -0.10);
      leg.rotation.z = s * 0.07;
    });
    add(g, clayBox(0.96, 1.24, 0.07, 4.4, 16), M.cream, 0, 1.06, 0);
    add(g, clayBox(0.84, 1.10, 0.02, 4.2, 14), clayMat(0xFFFDF7, { roughness: 0.9 }), 0, 1.08, 0.05, false);
    add(g, clayBox(0.50, 0.07, 0.03, 3, 8), clayMat(0xE8899A), 0, 1.53, 0.065, false);
    for (let i = 0; i < 5; i++) {
      const y = 1.36 - i * 0.17;
      add(g, clayBox(0.10, 0.10, 0.02, 2.2, 8), clayMat(0xF6E2B6), -0.28, y, 0.067, false);
      if (i < 3) {
        const t1 = add(g, clayBox(0.075, 0.018, 0.01, 2, 6), clayMat(0xE2727F), -0.30, y - 0.01, 0.075, false);
        t1.rotation.z = 0.7;
        const t2 = add(g, clayBox(0.055, 0.018, 0.01, 2, 6), clayMat(0xE2727F), -0.255, y + 0.012, 0.075, false);
        t2.rotation.z = -0.7;
      }
      add(g, clayBox(0.44, 0.045, 0.012, 3, 8), clayMat(i < 3 ? 0xD8C4AA : 0xEADFCE), 0.06, y, 0.066, false);
    }
    add(g, clayBox(0.52, 0.06, 0.13, 3, 10), M.woodLight, 0, 0.40, 0.10);
    room.add(g);
  })();

  // 벽걸이 TV (로봇 로고 화면)
  (function wallTV() {
    const W = 512, H = 320;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    const grad = x.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#2E4E7A'); grad.addColorStop(1, '#42699A');
    x.fillStyle = grad; x.fillRect(0, 0, W, H);
    x.fillStyle = 'rgba(255,255,255,0.10)';
    x.fillRect(0, 0, W, 26);
    x.strokeStyle = 'rgba(180,215,255,0.9)'; x.lineWidth = 5;
    x.strokeRect(196, 108, 120, 96);
    x.beginPath(); x.arc(232, 152, 9, 0, Math.PI * 2); x.arc(280, 152, 9, 0, Math.PI * 2); x.fillStyle = 'rgba(190,222,255,1)'; x.fill();
    x.fillRect(250, 84, 14, 26);
    x.beginPath(); x.arc(257, 78, 10, 0, Math.PI * 2); x.fill();
    x.fillStyle = 'rgba(200,226,255,0.85)';
    x.fillRect(40, 250, 150, 8); x.fillRect(40, 272, 96, 8); x.fillRect(360, 250, 112, 8);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;

    const g = new THREE.Group();
    g.position.set(5.05, 2.56, -R + 0.12);
    add(g, clayBox(1.66, 1.04, 0.10, 4.6, 18), M.dark, 0, 0, 0);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.50, 0.88),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.42, metalness: 0, emissive: 0x6FA0D8, emissiveIntensity: 0.42, emissiveMap: tex }));
    scr.position.z = 0.056;
    g.add(scr);
    room.add(g);
  })();

  // 블라인드 창 (뒤 벽 오른쪽) — 클릭 소품 'window'
  const win = (function blindsWindow() {
    const g = new THREE.Group();
    g.position.set(6.45, FLOOR_Y, -R + 0.10);
    g.userData.prop = 'window';
    add(g, clayBox(1.16, 1.66, 0.12, 4.8, 18), M.cream, 0, 2.02, 0);
    add(g, clayBox(0.98, 1.44, 0.05, 4.8, 14), new THREE.MeshStandardMaterial({
      color: 0xFFE7C2, emissive: 0xFFCE94, emissiveIntensity: 0.55, roughness: 0.4
    }), 0, 2.02, 0.07, false);
    for (let i = 0; i < 9; i++) {
      const sl = add(g, clayBox(0.98, 0.10, 0.035, 3, 10), M.woodLight, 0, 1.40 + i * 0.155, 0.11, false);
      sl.rotation.x = -0.32;
    }
    add(g, clayBox(1.30, 0.12, 0.26, 3, 12), M.woodLight, 0, 1.16, 0.06);
    const sp = plant(g, 0.46, 0.02, 0.30); sp.position.y = 1.24;
    const pl = new THREE.PointLight(0xFFDFB4, 4.2, 5.2, 2);
    pl.position.set(0, 1.9, 0.55);
    g.add(pl);
    room.add(g);
    return g;
  })();

  // 화이트보드 (왼쪽 벽 · 클릭 소품 'board')
  (function wallBoard() {
    const g = new THREE.Group();
    g.position.set(-R + 0.12, FLOOR_Y, 2.15); g.rotation.y = Math.PI / 2;
    g.userData.prop = 'board';
    add(g, clayBox(1.94, 1.24, 0.10, 4.8, 18), M.cream, 0, 1.86, 0);
    add(g, clayBox(1.76, 1.06, 0.05, 4.8, 16), clayMat(0xFDFAF3, { roughness: 0.72 }), 0, 1.86, 0.06, false);
    add(g, clayBox(0.56, 0.05, 0.03, 3, 8), clayMat(0xE8899A), -0.42, 2.16, 0.09, false);
    add(g, clayBox(0.86, 0.045, 0.03, 3, 8), clayMat(0x8FB8DE), -0.2, 2.00, 0.09, false);
    add(g, clayBox(0.66, 0.045, 0.03, 3, 8), clayMat(0x7FC197), 0.14, 1.84, 0.09, false);
    add(g, clayBox(0.4, 0.045, 0.03, 3, 8), clayMat(0xE8B27A), -0.30, 1.68, 0.09, false);
    postit(g, 0.66, 2.10, 0.10, 0.08, 0xF9C9D2, 0.13);
    postit(g, 0.64, 1.88, 0.10, -0.06, 0xFFE9A8, 0.13);
    add(g, clayBox(1.10, 0.07, 0.16, 3, 12), M.woodLight, 0, 1.19, 0.04);
    [[-0.2, 0xE8899A], [0.02, 0x8FB8DE], [0.24, 0x7FC197]].forEach(([bx, col]) => {
      const mk = add(g, cyl(0.018, 0.018, 0.18, 8), clayMat(col, { roughness: 0.6 }), bx, 1.23, 0.02, false);
      mk.rotation.z = Math.PI / 2;
    });
    room.add(g);
  })();

  // 뒤 벽 소품 선반 (왼쪽) — 화분 · 보관함
  (function backShelf() {
    const g = new THREE.Group();
    g.position.set(-1.55, 2.02, -R + 0.22);
    add(g, clayBox(2.30, 0.07, 0.30, 3.2, 16), M.woodLight, 0, 0, 0);
    const p1 = plant(g, -0.86, 0.06, 0.36); p1.position.y = 0.02;
    const p2 = plant(g, 0.72, 0.06, 0.28); p2.position.y = 0.02;
    add(g, clayBox(0.26, 0.22, 0.22, 3.4, 10), clayMat(0xF0E2CC), -0.28, 0.14, 0.02, false);
    add(g, clayBox(0.22, 0.18, 0.20, 3.4, 10), clayMat(0xE9AEB2), -0.28, 0.34, 0.02, false);
    budVase(g, 0.24, 0.02, 0.0);
    room.add(g);
  })();

  // 바깥 돌 테두리(플린스) + 덤불 + 계단
  const plinthY = -0.16;
  add(room, clayBox(R * 2 + 2.5, 0.5, 1.1, 4.6, 22), M.stoneDark, 0, plinthY, R + 1.0);
  add(room, clayBox(1.1, 0.5, R * 2 + 2.5, 4.6, 22), M.stoneDark, R + 1.0, plinthY, 0);
  add(room, clayBox(2.6, 0.22, 0.62, 3.4, 18), M.woodLight, 0, -0.2, R + 1.75);
  add(room, clayBox(2.0, 0.22, 0.5, 3.4, 18), M.woodLight, 0, -0.02, R + 1.35, false);

  // 앞 테두리 덤불
  for (let i = 0; i < 9; i++) {
    const x = -6.0 + i * 1.42;
    if (x > -0.9 && x < 1.2) continue;              // 계단 자리 비우기
    const s = 0.16 + Math.random() * 0.07;
    add(room, sph(s, 12), i % 2 ? M.leaf : M.leaf2, x, 0.26, R + 1.0, false);
    add(room, sph(s * 0.8, 10), M.leaf2, x + 0.24, 0.24, R + 1.12, false);
    flowerBuds(room, x + 0.04, 0.32, R + 1.0, [0xE9AEB2, 0xF9E3B8, 0xEBCBD8][i % 3]);
  }
  for (let i = 0; i < 7; i++) {
    const z = -4.4 + i * 1.5;
    const s = 0.15 + Math.random() * 0.06;
    add(room, sph(s, 12), i % 2 ? M.leaf2 : M.leaf, R + 1.0, 0.26, z, false);
    if (i % 2 === 0) flowerBuds(room, R + 1.0, 0.32, z + 0.03, [0xF9E3B8, 0xCFE0C9, 0xE9AEB2][i % 3]);
  }

  /* ── 가구 헬퍼 ──────────────────────────────────────────── */
  function group(x, z, ry) {
    const g = new THREE.Group();
    g.position.set(x, FLOOR_Y, z);
    g.rotation.y = ry || 0;
    room.add(g);
    return g;
  }
  function chair(g, x, z, ry, cushion) {
    const ch = new THREE.Group();
    ch.position.set(x, 0, z); ch.rotation.y = ry;
    add(ch, cyl(0.36, 0.36, 0.1, 22), M.sageDark, 0, 0.46, 0);
    add(ch, clayBox(0.72, 0.16, 0.72, 3.6, 18), M.sage, 0, 0.56, 0);
    add(ch, clayBox(0.16, 0.78, 0.66, 2.6, 16), M.sage, 0, 0.94, -0.3);
    // 방석 + 등받이 쿠션 + 리본 (아기자기 디테일)
    add(ch, clayBox(0.58, 0.1, 0.56, 2.4, 14), fabricMat(cushion || 0xF7E6DC, { bumpScale: 0.02 }), 0, 0.65, 0.02);
    add(ch, clayBox(0.53, 0.42, 0.1, 2.4, 14), fabricMat(cushion || 0xF7E6DC, { bumpScale: 0.02 }), 0, 0.96, -0.2);
    const top = add(ch, clayBox(0.19, 0.11, 0.68, 2.2, 14), M.sageDark, 0, 1.33, -0.3, false);
    top.rotation.x = 0.04;
    add(ch, sph(0.04, 10), clayMat(0xE9AEB2), 0, 1.2, -0.36, false);
    add(ch, cyl(0.07, 0.07, 0.42, 12), M.metal, 0, 0.24, 0);
    add(ch, cyl(0.32, 0.32, 0.08, 18), M.metal, 0, 0.05, 0);
    g.add(ch);
    return ch;
  }
  function monitor(g, x, y, z, ry, w, h, tex) {
    w = w || 1.05; h = h || 0.62;
    const m = new THREE.Group();
    m.position.set(x, y, z); m.rotation.y = ry || 0;
    add(m, clayBox(0.12, 0.3, 0.12, 3, 12), M.metal, 0, 0.15, 0);
    add(m, clayBox(w, h, 0.09, 4.6, 18), M.dark, 0, 0.3 + h / 2, 0);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.9, h * 0.84),
      new THREE.MeshStandardMaterial({
        map: tex || screenTexA, roughness: 0.42, metalness: 0,
        emissive: 0x8FB6D8, emissiveIntensity: 0.42, emissiveMap: tex || screenTexA
      }));
    scr.position.set(0, 0.3 + h / 2, 0.052);
    m.add(scr);
    g.add(m);
    return m;
  }
  function plant(g, x, z, scale) {
    scale = scale || 1;
    const p = new THREE.Group();
    p.position.set(x, 0, z); p.scale.setScalar(scale);
    add(p, cyl(0.31, 0.25, 0.42, 18), M.pot, 0, 0.21, 0);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const leaf = add(p, sph(0.24, 14), i % 2 ? M.leaf : M.leaf2, Math.cos(a) * 0.16, 0.6 + (i % 3) * 0.17, Math.sin(a) * 0.16);
      leaf.scale.set(0.82, 1.5, 0.82);
    }
    g.add(p);
    return p;
  }
  function book(g, x, y, z, w, h, d, color) {
    return add(g, clayBox(w, h, d, 5.0, 10), clayMat(color, { roughness: 0.9 }), x, y, z);
  }

  /* ── 미니어처 소품 (아기자기 디테일) ─────────────────────── */
  const PASTEL = [0xE9AEB2, 0xF9E3B8, 0xCFE0C9, 0xC9DBEA, 0xEBCBD8, 0xF3DCC4];

  function mug(g, x, y, z, color, sc) {                 // 머그컵 + 받침 + 커피
    const m = new THREE.Group();
    m.position.set(x, y, z); m.scale.setScalar(sc || 1);
    add(m, cyl(0.148, 0.143, 0.024, 18), M.cream, 0, 0.012, 0, false);
    add(m, cyl(0.09, 0.08, 0.17, 16), clayMat(color || 0xFFF6E8), 0, 0.1, 0);
    add(m, cyl(0.075, 0.075, 0.018, 16), clayMat(0x7A4F33, { roughness: 0.5 }), 0, 0.185, 0, false);
    add(m, new THREE.TorusGeometry(0.05, 0.016, 8, 14), clayMat(color || 0xFFF6E8), 0.095, 0.1, 0, false);
    g.add(m); return m;
  }
  function plate(g, x, y, z, r, color) {
    return add(g, cyl(r, r * 0.88, 0.03, 22), clayMat(color || 0xFFFBF2), x, y + 0.015, z, false);
  }
  function macaron(g, x, y, z, color) {
    add(g, cyl(0.05, 0.046, 0.024, 16), clayMat(color, { roughness: 0.86 }), x, y + 0.012, z, false);
    add(g, cyl(0.054, 0.05, 0.018, 16), clayMat(color, { roughness: 0.86 }), x, y + 0.043, z, false);
    add(g, cyl(0.046, 0.046, 0.01, 16), clayMat(0xFFF7E8), x, y + 0.028, z, false);
  }
  function paperSheet(g, x, y, z, ry, w, d, color) {
    const p = add(g, clayBox(w, 0.012, d, 4.2, 8), clayMat(color || 0xFFFCF4, { roughness: 0.94 }), x, y, z, false);
    p.rotation.y = ry || 0;
    return p;
  }
  function pen(g, x, y, z, ry, color) {
    const p = add(g, cyl(0.014, 0.014, 0.26, 8), clayMat(color || 0x6E8FA8, { roughness: 0.55 }), x, y, z, false);
    p.rotation.z = Math.PI / 2; p.rotation.y = ry || 0;
    return p;
  }
  function postit(g, x, y, z, rz, color, size) {
    const s = size || 0.15;
    const p = add(g, clayBox(s, s, 0.012, 4.6, 8), clayMat(color || 0xFFE9A8, { roughness: 0.92 }), x, y, z, false);
    p.rotation.z = rz || 0;
    return p;
  }
  function laptopMini(g, x, y, z, ry) {
    const l = new THREE.Group();
    l.position.set(x, y, z); l.rotation.y = ry || 0;
    add(l, clayBox(0.44, 0.026, 0.3, 3.2, 10), M.metal, 0, 0.013, 0, false);
    add(l, clayBox(0.4, 0.014, 0.22, 3.2, 8), M.dark, 0, 0.03, 0.02, false);
    const lid = add(l, clayBox(0.44, 0.29, 0.024, 3.2, 10), clayMat(0xEDE4D4, { roughness: 0.6 }), 0, 0.15, -0.16, false);
    lid.rotation.x = -0.3;
    const scr = add(l, clayBox(0.38, 0.23, 0.01, 3.2, 8), softMat(0x9DC0DC, { emissive: 0x8FB6D8, emissiveIntensity: 0.38, roughness: 0.4 }), 0, 0.152, -0.145, false);
    scr.rotation.x = -0.3;
    g.add(l); return l;
  }
  function penCup(g, x, y, z, color) {
    add(g, cyl(0.075, 0.065, 0.13, 14), clayMat(color || 0xEDE0C8), x, y + 0.065, z);
    [[0.018, 0.012, 0xE8899A], [-0.028, 0.02, 0x8FB8DE], [0.0, -0.032, 0x7FC197]].forEach(([dx, dz, c]) => {
      const p = add(g, cyl(0.011, 0.011, 0.24, 6), clayMat(c, { roughness: 0.6 }), x + dx, y + 0.19, z + dz, false);
      p.rotation.z = dx * 4; p.rotation.x = -dz * 4;
    });
  }
  function deskLamp(g, x, y, z) {                        // 미니 데스크 램프
    const l = new THREE.Group(); l.position.set(x, y, z);
    add(l, cyl(0.1, 0.12, 0.03, 16), M.woodDark, 0, 0.015, 0);
    const arm = add(l, cyl(0.016, 0.016, 0.4, 8), M.metal, 0.02, 0.22, 0);
    arm.rotation.z = 0.2;
    const shade = add(l, cyl(0.14, 0.08, 0.14, 16), clayMat(0xE9A78F), 0.09, 0.42, 0);
    shade.rotation.z = -0.3;
    add(l, sph(0.045, 10), M.glow, 0.11, 0.37, 0, false);
    const pl = new THREE.PointLight(0xFFD9A0, 1.8, 2.2, 2);
    pl.position.set(0.14, 0.36, 0);
    l.add(pl);
    g.add(l); return l;
  }
  function budVase(g, x, y, z) {
    add(g, cyl(0.072, 0.052, 0.15, 14), clayMat(0xC9DBEA), x, y + 0.075, z);
    [[-0.03, 0.02, 0xE9AEB2, 0.17], [0.025, -0.015, 0xF9E3B8, 0.21], [0.005, 0.03, 0xEBCBD8, 0.19]].forEach(([dx, dz, c, h]) => {
      add(g, cyl(0.007, 0.007, h, 6), M.leaf2, x + dx * 0.5, y + 0.12 + h / 2, z + dz * 0.5, false);
      add(g, sph(0.03, 10), clayMat(c, { roughness: 0.82 }), x + dx, y + 0.13 + h, z + dz, false);
    });
  }
  function trophyMini(g, x, y, z) {
    add(g, cyl(0.082, 0.098, 0.028, 14), M.woodDark, x, y + 0.014, z, false);
    add(g, cyl(0.017, 0.017, 0.1, 8), clayMat(0xE8CB84, { metalness: 0.22, roughness: 0.4 }), x, y + 0.082, z, false);
    add(g, cyl(0.1, 0.052, 0.13, 16), clayMat(0xE8CB84, { metalness: 0.22, roughness: 0.38 }), x, y + 0.19, z, false);
  }
  function dollMini(g, x, y, z, color) {                 // 곰 인형
    const d = new THREE.Group(); d.position.set(x, y, z);
    const body = clayMat(color || 0xE7C9A8);
    add(d, sph(0.082, 14), body, 0, 0.082, 0).scale.set(1, 0.95, 0.9);
    add(d, sph(0.068, 14), body, 0, 0.185, 0);
    [-1, 1].forEach(s => add(d, sph(0.028, 10), body, s * 0.05, 0.238, 0, false));
    add(d, sph(0.011, 8), softMat(0x2A2320, { roughness: 0.4 }), -0.023, 0.196, 0.06, false);
    add(d, sph(0.011, 8), softMat(0x2A2320, { roughness: 0.4 }), 0.023, 0.196, 0.06, false);
    add(d, sph(0.015, 8), clayMat(0xF2A9BE, { roughness: 0.9 }), 0, 0.178, 0.064, false).scale.set(1, 0.7, 0.5);
    g.add(d); return d;
  }
  function flowerBuds(g, x, y, z, color) {               // 덤불 위 파스텔 꽃봉오리
    for (let i = 0; i < 3; i++) {
      const a = i * 2.3;
      add(g, sph(0.038, 8), clayMat(color, { roughness: 0.82 }), x + Math.cos(a) * 0.07, y + i * 0.026, z + Math.sin(a) * 0.07, false);
    }
    add(g, sph(0.02, 8), clayMat(0xFFF3C4, { roughness: 0.8 }), x, y + 0.048, z, false);
  }
  function wallClock(g, x, y, z, r) {
    const c = new THREE.Group(); c.position.set(x, y, z);
    add(c, sph(r, 22), M.cream, 0, 0, 0).scale.set(1, 1, 0.3);
    add(c, sph(r * 0.84, 20), clayMat(0xFFFDF6, { roughness: 0.7 }), 0, 0, r * 0.11, false).scale.set(1, 1, 0.3);
    add(c, clayBox(r * 0.07, r * 0.42, 0.016, 3, 8), M.dark, 0, r * 0.15, r * 0.42, false);
    const mm = add(c, clayBox(r * 0.05, r * 0.58, 0.016, 3, 8), M.dark, r * 0.1, r * 0.18, r * 0.43, false);
    mm.rotation.z = -0.62;
    add(c, sph(r * 0.06, 8), clayMat(0xE9AEB2, { roughness: 0.7 }), 0, 0, r * 0.46, false);
    g.add(c); return c;
  }
  function wallCalendar(g, x, y, z, w, h) {
    const c = new THREE.Group(); c.position.set(x, y, z);
    add(c, clayBox(w, h, 0.06, 3.6, 12), M.cream, 0, 0, 0);
    add(c, clayBox(w * 0.82, h * 0.24, 0.016, 3.2, 10), clayMat(0xE9A78F), 0, h * 0.3, 0.04, false);
    for (let r2 = 0; r2 < 3; r2++) {
      for (let i = 0; i < 4; i++) {
        add(c, clayBox(w * 0.12, h * 0.1, 0.012, 3, 6), clayMat(r2 === 0 && i === 2 ? 0xE9AEB2 : 0xE8D8C2, { roughness: 0.9 }), -w * 0.29 + i * w * 0.19, h * 0.09 - r2 * h * 0.17, 0.038, false);
      }
    }
    g.add(c); return c;
  }

  /* ═══ 가구 배치 — 레퍼런스(따뜻한 크림 오피스) 구도 ═══════════ */

  /* 공용 가구 헬퍼 */
  function officeChair(g, x, z, ry, cushion) {
    const ch = new THREE.Group();
    ch.position.set(x, 0, z); ch.rotation.y = ry || 0;
    const fab = fabricMat(cushion || 0xEFE6D6, { bumpScale: 0.018 });
    add(ch, clayBox(0.66, 0.14, 0.64, 3.4, 20), fab, 0, 0.62, 0);
    add(ch, clayBox(0.60, 0.66, 0.15, 3.0, 18), fab, 0, 1.02, -0.27);
    add(ch, clayBox(0.66, 0.12, 0.20, 3.0, 16), fab, 0, 1.40, -0.27);
    add(ch, cyl(0.065, 0.065, 0.40, 12), M.metal, 0, 0.36, 0);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const leg = add(ch, clayBox(0.085, 0.06, 0.44, 3, 8), M.metal, Math.cos(a) * 0.20, 0.09, Math.sin(a) * 0.20, false);
      leg.rotation.y = -a;
      add(ch, sph(0.055, 10), softMat(0x585350, { roughness: 0.6 }), Math.cos(a) * 0.38, 0.055, Math.sin(a) * 0.38, false);
    }
    g.add(ch);
    return ch;
  }
  function armchair(g, x, z, ry, color) {
    const a = new THREE.Group();
    a.position.set(x, 0, z); a.rotation.y = ry || 0;
    const mat = fabricMat(color || 0xF7ECD9, { bumpScale: 0.022 });
    add(a, clayBox(0.98, 0.36, 0.94, 3.0, 22), mat, 0, 0.42, 0);
    add(a, clayBox(0.86, 0.17, 0.82, 2.6, 18), mat, 0, 0.60, 0.03);
    add(a, clayBox(1.00, 0.80, 0.26, 2.6, 20), mat, 0, 0.74, -0.35);
    add(a, clayBox(0.22, 0.46, 0.88, 2.6, 18), mat, -0.42, 0.52, 0.01);
    add(a, clayBox(0.22, 0.46, 0.88, 2.6, 18), mat, 0.42, 0.52, 0.01);
    [[-0.36, -0.32], [0.36, -0.32], [-0.36, 0.32], [0.36, 0.32]].forEach(([lx, lz]) =>
      add(a, cyl(0.05, 0.04, 0.24, 8), M.woodDark, lx, 0.12, lz, false));
    g.add(a);
    return a;
  }
  function stool(g, x, z) {
    const st = new THREE.Group();
    st.position.set(x, 0, z);
    add(st, cyl(0.30, 0.30, 0.09, 22), M.woodLight, 0, 0.58, 0);
    add(st, cyl(0.27, 0.27, 0.05, 20), fabricMat(0xF3E3C9), 0, 0.64, 0);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.4;
      const leg = add(st, cyl(0.028, 0.028, 0.56, 8), M.woodDark, Math.cos(a) * 0.17, 0.28, Math.sin(a) * 0.17, false);
      leg.rotation.z = Math.cos(a) * 0.14;
      leg.rotation.x = -Math.sin(a) * 0.14;
    }
    g.add(st);
    return st;
  }

  /* ── 1. 피클즈 롱데스크 (뒤 벽) ─────────────────────────── */
  const longDesk = group(2.90, -5.55);
  longDesk.userData.prop = 'command';
  add(longDesk, clayBox(7.00, 0.15, 1.35, 4.4, 26), M.woodLight, 0, 0.78, 0);
  add(longDesk, clayBox(6.90, 0.10, 0.22, 3.4, 16), M.wood, 0, 0.70, -0.56);
  add(longDesk, clayBox(0.20, 0.78, 1.18, 4.0, 18), M.wood, -3.42, 0.39, 0);
  add(longDesk, clayBox(0.20, 0.78, 1.18, 4.0, 18), M.wood, 3.42, 0.39, 0);
  // 서랍장 3개 + 손잡이
  [-2.30, 0.15, 2.30].forEach((dx, i) => {
    add(longDesk, clayBox(0.92, 0.62, 1.00, 4.2, 18), M.cream, dx, 0.33, 0);
    [0.20, 0.44].forEach((dy, k) => {
      add(longDesk, clayBox(0.80, 0.19, 0.03, 3.4, 10), clayMat(0xFBF3E6, { roughness: 0.8 }), dx, dy, 0.51, false);
      add(longDesk, clayBox(0.22, 0.035, 0.045, 3, 8), M.woodDark, dx, dy + 0.055, 0.535, false);
    });
  });
  // 4인 자리 — 노트북(뒤에서 보이게) · 머그 · 펜꽂이 · 포스트잇
  const DESK_X = [1.15, 2.40, 3.65, 4.90];
  DESK_X.forEach((wx, i) => {
    const lx = wx - 2.90;
    laptopMini(longDesk, lx, 0.858, 0.02, Math.PI);
    mug(longDesk, lx - 0.52, 0.858, 0.10, [0xF9E3B8, 0xC9DBEA, 0xEBCBD8, 0xF7D9CE][i], 0.9);
    if (i % 2 === 0) penCup(longDesk, lx + 0.52, 0.858, 0.08, 0xEDE0C8);
    else postit(longDesk, lx + 0.50, 0.862, 0.06, 0.08, [0xFFE9A8, 0xCFE0C9][i % 2], 0.13);
    officeChair(longDesk, lx, -0.74, 0, [0xEFE6D6, 0xF6E7DA, 0xE7EFE4, 0xF7E3E6][i]);
  });
  plant(longDesk, -3.72, 0.02, 0.36).position.y = 0.88;
  plant(longDesk, 3.66, 0.02, 0.30).position.y = 0.88;
  paperSheet(longDesk, 0.95, 0.862, 0.34, 0.3, 0.34, 0.26, 0xFFFBF0);
  budVase(longDesk, 1.05, 0.858, -0.42);

  /* ── 2. 큐의 개인 책상 (왼쪽) ───────────────────────────── */
  const qDesk = group(-4.45, -1.15);
  qDesk.userData.prop = 'desk';
  add(qDesk, clayBox(1.40, 0.14, 2.60, 4.4, 24), M.woodLight, 0, 0.78, 0);
  add(qDesk, clayBox(0.22, 0.10, 2.50, 3.4, 16), M.wood, -0.58, 0.70, 0);
  add(qDesk, clayBox(1.20, 0.78, 0.20, 4.0, 18), M.wood, 0, 0.39, -1.20);
  add(qDesk, clayBox(1.20, 0.78, 0.20, 4.0, 18), M.wood, 0, 0.39, 1.20);
  add(qDesk, clayBox(0.52, 0.60, 0.86, 4.2, 18), M.cream, 0.34, 0.32, 0.72);
  add(qDesk, clayBox(0.42, 0.17, 0.03, 3.4, 10), clayMat(0xFBF3E6), 0.34, 0.44, 1.16, false);
  add(qDesk, clayBox(0.16, 0.03, 0.04, 3, 8), M.woodDark, 0.34, 0.49, 1.19, false);
  laptopMini(qDesk, -0.02, 0.858, -0.18, -Math.PI / 2);
  mug(qDesk, 0.30, 0.858, -0.72, 0xF9E3B8);
  deskLamp(qDesk, -0.26, 0.858, -1.02);
  penCup(qDesk, 0.34, 0.858, -0.30, 0xEBCBD8);
  paperSheet(qDesk, -0.10, 0.860, 0.62, 0.5, 0.36, 0.28);
  officeChair(qDesk, -0.85, 0.0, Math.PI / 2, 0xE7EFE4);

  /* ── 3. 가운데 원탁 (뮤즈 · 키링) ───────────────────────── */
  add(room, cyl(2.55, 2.55, 0.05, 64), fabricMat(0xF6EBD8, { bumpScale: 0.024 }), -1.00, FLOOR_Y + 0.03, -1.40).castShadow = false;
  add(room, cyl(2.34, 2.34, 0.02, 64), fabricMat(0xFBF2E2), -1.00, FLOOR_Y + 0.062, -1.40).castShadow = false;
  const roundTable = group(-1.00, -1.40);
  roundTable.userData.prop = 'table';
  add(roundTable, cyl(1.24, 1.24, 0.12, 48), M.woodLight, 0, 0.74, 0);
  add(roundTable, cyl(1.14, 1.14, 0.05, 46), M.wood, 0, 0.81, 0);
  add(roundTable, cyl(0.30, 0.34, 0.70, 26), M.woodLight, 0, 0.36, 0);
  add(roundTable, cyl(0.66, 0.66, 0.09, 34), M.woodDark, 0, 0.05, 0);
  laptopMini(roundTable, -0.42, 0.868, 0.10, -Math.PI / 2);
  laptopMini(roundTable, 0.44, 0.868, 0.06, Math.PI / 2);
  mug(roundTable, -0.10, 0.868, -0.52, 0xF9E3B8);
  mug(roundTable, 0.18, 0.868, 0.60, 0xEBCBD8);
  plant(roundTable, 0.02, -0.12, 0.26).position.y = 0.84;
  paperSheet(roundTable, 0.02, 0.872, 0.36, 0.3, 0.34, 0.26);
  book(roundTable, -0.62, 0.878, 0.52, 0.30, 0.05, 0.24, 0x9DC0DC);
  book(roundTable, -0.60, 0.926, 0.52, 0.28, 0.045, 0.22, 0xE9AEB2);
  macaron(roundTable, 0.55, 0.878, -0.42, 0xF7C9D0);
  plate(roundTable, 0.55, 0.872, -0.42, 0.19);
  armchair(room, -2.55, -1.35, Math.PI / 2, 0xF7ECD9);
  armchair(room, 0.55, -1.35, -Math.PI / 2, 0xF7ECD9);

  /* ── 4. 부이의 모니터 데스크 (오른쪽) ──────────────────── */
  const bDesk = group(5.30, -2.60);
  bDesk.userData.prop = 'desk';
  add(bDesk, clayBox(1.50, 0.14, 2.60, 4.4, 24), M.woodLight, 0, 0.78, 0);
  add(bDesk, clayBox(0.20, 0.78, 2.50, 3.8, 16), M.wood, 0.62, 0.39, 0);
  add(bDesk, clayBox(1.30, 0.78, 0.20, 4.0, 18), M.wood, -0.04, 0.39, -1.20);
  add(bDesk, clayBox(1.30, 0.78, 0.20, 4.0, 18), M.wood, -0.04, 0.39, 1.20);
  add(bDesk, clayBox(0.52, 0.60, 0.80, 4.2, 18), M.cream, -0.34, 0.32, 0.62);
  monitor(bDesk, 0.22, 0.85, -0.20, -Math.PI / 2, 1.30, 0.78, screenTexA);
  add(bDesk, clayBox(0.60, 0.05, 0.22, 3, 12), M.dark, -0.10, 0.862, 0.34, false);
  add(bDesk, clayBox(0.26, 0.12, 0.22, 3.2, 10), M.metal, -0.46, 0.90, 0.42, false);
  mug(bDesk, -0.42, 0.858, -0.34, 0xEBCBD8);
  plant(bDesk, -0.40, 0.02, 0.30).position.y = 0.88;
  deskLamp(bDesk, -0.20, 0.858, -0.92);
  officeChair(bDesk, -0.85, 0.0, Math.PI / 2, 0xF7E3E6);
  // 메모 파티션 (모니터 뒤)
  const part = new THREE.Group();
  part.position.set(5.30 + 0.78, FLOOR_Y, -2.60); part.rotation.y = -Math.PI / 2;
  add(part, clayBox(2.30, 1.42, 0.09, 4.4, 18), M.cream, 0, 0.86, 0);
  add(part, clayBox(2.12, 1.24, 0.04, 4.2, 16), fabricMat(0xF3E7D6, { bumpScale: 0.02 }), 0, 0.86, 0.05, false);
  [[-0.66, 0.46, 0xFFE9A8], [-0.30, 0.20, 0xCFE0C9], [0.24, 0.52, 0xF9C9D2], [0.62, 0.16, 0xC9DBEA], [0.10, -0.22, 0xFFE9A8]].forEach(([px, py, col]) => {
    postit(part, px, 1.06 + py, 0.085, px * 0.14, col, 0.15);
  });
  room.add(part);

  /* ── 5. 앞쪽 라운지 (소파 → 안락의자 3 + 낮은 원탁) ─────── */
  add(room, cyl(3.05, 3.05, 0.05, 72), fabricMat(0xF3E7D4, { bumpScale: 0.026 }), 1.00, FLOOR_Y + 0.03, 3.60).castShadow = false;
  add(room, cyl(2.80, 2.80, 0.02, 72), fabricMat(0xFBF2E2), 1.00, FLOOR_Y + 0.062, 3.60).castShadow = false;
  const sofaSeat = armchair(room, -1.15, 3.20, 1.00, 0xF7ECD9);
  sofaSeat.userData.prop = 'sofa';
  armchair(room, 1.15, 2.40, -0.05, 0xF7ECD9);
  armchair(room, 3.15, 3.35, -1.05, 0xF7ECD9);

  const lowTable = group(1.00, 4.55);
  lowTable.userData.prop = 'coffee';
  add(lowTable, cyl(0.82, 0.82, 0.10, 40), M.woodLight, 0, 0.44, 0);
  add(lowTable, cyl(0.74, 0.74, 0.04, 38), M.wood, 0, 0.50, 0);
  add(lowTable, cyl(0.16, 0.20, 0.42, 18), M.woodDark, 0, 0.22, 0);
  add(lowTable, cyl(0.44, 0.44, 0.07, 26), M.woodDark, 0, 0.04, 0);
  plant(lowTable, -0.16, 0.02, 0.34).position.y = 0.52;
  book(lowTable, 0.34, 0.535, 0.24, 0.28, 0.05, 0.22, 0xD1B49A);
  book(lowTable, 0.34, 0.585, 0.24, 0.26, 0.045, 0.20, 0xCFE0C9);
  mug(lowTable, 0.40, 0.525, -0.32, 0xF9E3B8, 0.9);
  add(lowTable, sph(0.11, 16), clayMat(0xF7E3C8), -0.30, 0.62, -0.36).scale.set(1, 1.1, 1);
  add(lowTable, cyl(0.15, 0.10, 0.13, 16), clayMat(0xFFE9C4, { emissive: 0xFFCF8A, emissiveIntensity: 0.5 }), -0.30, 0.74, -0.36, false);

  // 라운지 스탠드 · 사이드 테이블
  const floorLamp = group(-2.55, 4.85);
  add(floorLamp, cyl(0.24, 0.28, 0.08, 20), M.woodDark, 0, 0.04, 0);
  add(floorLamp, cyl(0.035, 0.035, 1.86, 10), M.woodDark, 0, 0.98, 0);
  add(floorLamp, cyl(0.33, 0.25, 0.36, 22), new THREE.MeshStandardMaterial({
    color: 0xFFE7C2, emissive: 0xFFD49A, emissiveIntensity: 0.72, roughness: 0.62
  }), 0, 1.98, 0);
  const lp2 = new THREE.PointLight(0xFFCF96, 5.5, 5.6, 2);
  lp2.position.set(0, 1.96, 0);
  floorLamp.add(lp2);

  const sideT = group(2.55, 1.35);
  add(sideT, cyl(0.34, 0.30, 0.07, 22), M.woodLight, 0, 0.52, 0);
  add(sideT, cyl(0.055, 0.055, 0.48, 10), M.woodDark, 0, 0.26, 0);
  add(sideT, cyl(0.20, 0.20, 0.05, 18), M.woodDark, 0, 0.03, 0);
  mug(sideT, 0.10, 0.555, 0.06, 0xC9DBEA, 0.85);
  book(sideT, -0.10, 0.575, -0.08, 0.24, 0.045, 0.18, 0xE9AEB2);

  /* ── 6. 미니 커피바 (앞 왼쪽 코너) ─────────────────────── */
  const coffeeBar = group(-5.55, 2.55);
  add(coffeeBar, clayBox(1.00, 0.12, 3.00, 3.8, 22), M.woodLight, 0, 0.92, 0);
  add(coffeeBar, clayBox(0.88, 0.86, 2.86, 3.4, 18), M.cream, 0, 0.44, 0);
  add(coffeeBar, clayBox(0.06, 0.055, 2.80, 2.6, 10), M.glow, 0.47, 0.83, 0, false);
  // 앞면 로봇 네온 로고
  add(coffeeBar, clayBox(0.02, 0.34, 0.44, 3.4, 12), clayMat(0xE9C9A8, { roughness: 0.9 }), 0.46, 0.52, 0.55, false);
  [-0.10, 0.10].forEach(dz => add(coffeeBar, sph(0.032, 8), M.glow, 0.48, 0.54, 0.55 + dz, false));
  add(coffeeBar, clayBox(0.02, 0.03, 0.16, 2.4, 8), M.glow, 0.48, 0.44, 0.55, false);
  // 커피머신
  add(coffeeBar, clayBox(0.46, 0.54, 0.40, 3.6, 16), clayMat(0xE7E2D8, { roughness: 0.55 }), 0.02, 1.25, -0.78);
  add(coffeeBar, clayBox(0.40, 0.10, 0.34, 3.2, 12), clayMat(0x585350), 0.02, 1.02, -0.72, false);
  add(coffeeBar, cyl(0.055, 0.055, 0.10, 12), M.metal, 0.02, 0.96, -0.62, false);
  add(coffeeBar, sph(0.03, 10), clayMat(0xE8899A, { emissive: 0xE8899A, emissiveIntensity: 0.3 }), 0.16, 1.44, -0.60, false);
  mug(coffeeBar, -0.02, 0.982, -0.52, 0xFFFBF2, 0.9);
  // 유리병 · 원두 · 컵
  [[-0.20, 0.20, 0xE9C9A8, 0.26], [0.16, 0.34, 0xC9DBEA, 0.22], [-0.06, 0.85, 0xF3DCC4, 0.30]].forEach(([dx, dz, col, h]) => {
    add(coffeeBar, cyl(0.09, 0.085, h, 14), clayMat(col, { roughness: 0.45 }), dx, 0.98 + h / 2, dz);
  });
  [-0.60, 1.42].forEach(dz => add(coffeeBar, cyl(0.038, 0.038, 0.26, 10), M.woodDark, 0.12, 1.11, dz, false));
  plant(coffeeBar, -0.10, 1.30, 0.28).position.y = 0.98;
  stool(room, -4.52, 1.95);
  stool(room, -4.52, 3.10);

  /* ── 7. 책장 (왼쪽 벽) ─────────────────────────────────── */
  const shelf = group(-6.42, -4.00, Math.PI / 2);
  shelf.userData.prop = 'shelf';
  add(shelf, clayBox(3.60, 2.74, 0.16, 5.6, 22), M.wood, 0, 1.37, -0.30);
  add(shelf, clayBox(0.16, 2.74, 0.64, 5.0, 16), M.wood, -1.80, 1.37, 0);
  add(shelf, clayBox(0.16, 2.74, 0.64, 5.0, 16), M.wood, 1.80, 1.37, 0);
  add(shelf, clayBox(3.84, 0.16, 0.70, 4.6, 18), M.woodLight, 0, 2.82, 0.02);
  add(shelf, clayBox(3.84, 0.16, 0.70, 4.6, 18), M.woodLight, 0, 0.08, 0.02);
  for (let i = 0; i < 4; i++) {
    const y = 0.52 + i * 0.62;
    add(shelf, clayBox(3.52, 0.09, 0.58, 4.6, 16), M.woodLight, 0, y, 0.02);
    // 선반 아래 간접등
    add(shelf, clayBox(3.40, 0.028, 0.045, 2.6, 8), M.glow, 0, y - 0.075, 0.28, false);
    let bx = -1.58, b = 0;
    while (bx < 1.30) {
      const bw = 0.085 + ((i + b) % 3) * 0.02;
      const bh = 0.30 + ((i * 3 + b) % 4) * 0.04;
      const kind = (i + b) % 5;
      if (kind === 0) {   // 바인더 (회색 라벨)
        book(shelf, bx, y + 0.05 + bh / 2, 0.02, bw, bh, 0.34, 0xEDE7DC);
        add(shelf, clayBox(0.022, 0.09, 0.02, 2, 6), clayMat(0xB9AE9C), bx + bw / 2, y + 0.05 + bh * 0.62, 0.20, false);
      } else if (kind === 1) {  // 수납박스
        const bwid = 0.26 + ((i + b) % 3) * 0.04;
        book(shelf, bx + bwid / 2, y + 0.05 + 0.13, 0.02, bwid, 0.26, 0.32, 0xF0E6D2);
        add(shelf, clayBox(bwid * 0.5, 0.02, 0.03, 2.4, 6), clayMat(0xD8C8AC), bx + bwid / 2, y + 0.16, 0.18, false);
      } else {
        book(shelf, bx, y + 0.05 + bh / 2, 0.02, bw, bh, 0.32,
          [0xE9AEB2, 0x9DC0DC, 0xA9BFA6, 0xE9A78F, 0xF8EEDE, 0x86AE74, 0xE3C37A][(i + b) % 7]);
      }
      bx += ((i + b) % 5 === 1 ? 0.34 : bw) + ((b % 4 === 3) ? 0.10 : 0.035);
      b++;
    }
  }
  // 상단 수납박스 · 화분
  [[-1.25, 0xF0E6D2, 0.34], [-0.85, 0xE9AEB2, 0.28], [-0.45, 0xF3DCC4, 0.30]].forEach(([dx, col, s]) => {
    add(shelf, clayBox(s, s * 0.8, 0.34, 3.6, 10), clayMat(col, { roughness: 0.85 }), dx, 3.05, 0.02, false);
  });
  plant(shelf, 0.55, 0.02, 0.62).position.y = 2.82;
  plant(shelf, 1.35, 0.02, 0.44).position.y = 2.82;
  trophyMini(shelf, -1.55, 3.02, 0.02);
  dollMini(shelf, 1.05, 3.02, 0.05, 0xE7C9A8);

  /* ── 8. 화분 · 조명 · 소품 ─────────────────────────────── */
  plant(room, -3.05, -6.35, 0.85);
  plant(room, -6.30, -6.20, 0.95);
  plant(room, 6.25, -1.10, 1.00);
  plant(room, 6.30, 1.60, 0.85);
  plant(room, -6.20, 6.10, 0.95);
  plant(room, -3.20, 6.25, 0.72);
  plant(room, 5.10, 5.40, 0.85);
  plant(room, -0.10, -6.40, 0.70);
  plant(room, 2.05, -6.40, 0.62);

  // 천장 펜던트 (롱데스크 위 · 라운지 위)
  function pendant(x, z, y, s) {
    add(room, cyl(0.012, 0.012, 1.2, 6), M.woodDark, x, y + 0.6, z, false);
    add(room, cyl(0.26 * s, 0.20 * s, 0.18 * s, 18), M.cream, x, y, z, false);
    add(room, sph(0.13 * s, 14), M.glow, x, y - 0.12 * s, z, false);
    const pl = new THREE.PointLight(0xFFD9A6, 3.0 * s, 4.4, 2);
    pl.position.set(x, y - 0.2, z);
    room.add(pl);
  }
  pendant(2.10, -5.45, 2.85, 1.0);
  pendant(4.30, -5.45, 2.85, 0.9);
  pendant(1.00, 3.60, 2.95, 1.1);

  // 롱데스크 위 스탠드 조명 위치 보정
  lampLight.position.set(2.9, 2.55, -5.3);

  /* ── 캐릭터 (나은님 실제 캐릭터 사진 기준 · 자리 배치) ───────── */
  const PEOPLE = [
    { name: '초록',     kind: 'clover',   color: 0x6ECC55, zone: 'meeting', seat: [1.15, -6.28], yaw: 0,           seatY: 0.25, stance: [1.15, -4.28], roam: false, acts: ['type', 'nod', 'type', 'talk', 'stretch'] },
    { name: '노랑',     kind: 'clover',   color: 0xF7D63F, zone: 'meeting', seat: [2.40, -6.28], yaw: 0,           seatY: 0.25, stance: [2.40, -4.28], roam: false, acts: ['type', 'nod', 'talk', 'type', 'stretch'] },
    { name: '막내',     kind: 'clover',   color: 0xFCC9DC, zone: 'meeting', seat: [3.65, -6.28], yaw: 0,           seatY: 0.25, stance: [3.65, -4.28], roam: false, acts: ['type', 'wave', 'nod', 'talk', 'stretch'], face: 'squeeze' },
    { name: '진분홍',   kind: 'clover',   color: 0xF0329A, zone: 'meeting', seat: [4.90, -6.28], yaw: 0,           seatY: 0.25, stance: [4.90, -4.28], roam: false, acts: ['type', 'nod', 'talk', 'type', 'stretch'] },
    { name: '큐',       kind: 'tri',      color: 0x4E9DF0, zone: 'command', seat: [-5.32, -1.15], yaw: Math.PI / 2, seatY: 0.15, stance: [-3.30, -1.15], roam: true,  acts: ['type', 'nod', 'talk', 'stretch'], headphones: true },
    { name: '뮤즈',     kind: 'yeti',     color: 0xEDE0C8, zone: 'command', seat: [-2.50, -1.33], yaw: Math.PI / 2, seatY: 0.55, stance: [-3.35, -2.45], roam: true,  acts: ['talk', 'wave', 'nod', 'type', 'stretch'] },
    { name: '키링',     kind: 'cat',      color: 0xFCF4E6, zone: 'command', seat: [0.50, -1.33],  yaw: -Math.PI / 2, seatY: 0.55, stance: [1.70, -1.33], roam: true,  acts: ['talk', 'nod', 'type', 'wave', 'stretch'] },
    { name: '부이',     kind: 'tri',      color: 0xFF3E9E, zone: 'lounge',  seat: [4.45, -2.60],  yaw: Math.PI / 2, seatY: 0.15, stance: [3.30, -2.60], roam: true,  acts: ['type', 'nod', 'talk', 'stretch'] },
    { name: '하마뮤즈', kind: 'hippo',    color: 0xB49BE0, zone: 'lounge',  seat: [-1.15, 3.20],  yaw: 1.00,        seatY: 0.50, stance: [-2.35, 2.45], roam: true,  acts: ['sip', 'talk', 'nod', 'wave', 'stretch'], glasses: true },
    { name: '하크',     kind: 'squircle', color: 0x242424, zone: 'lounge',  seat: [1.15, 2.40],   yaw: -0.05,       seatY: 0.22, stance: [1.15, 1.15], roam: true,  acts: ['type', 'nod', 'talk', 'stretch'] },
    { name: '인스팅트', kind: 'disc',     color: 0xF4EBDC, zone: 'lounge',  seat: [3.15, 3.35],   yaw: -1.05,       seatY: 0.22, stance: [3.15, 4.60], roam: true,  acts: ['read', 'nod', 'talk', 'stretch'], glasses: true }
  ];

  /* ── 길찾기: 바닥 격자 A* (가구 회피) ───────────────────── */
  const ROOM_LIM = 6.50;
  const OB_B = [                        // 사각 장애물 (중심 x, z, 반폭, 반높이)
    { x: 2.90, z: -5.55, hw: 3.58, hd: 1.06 },   // 피클즈 롱데스크 + 의자
    { x: -4.70, z: -1.15, hw: 1.00, hd: 1.48 },  // 큐 책상 + 의자
    { x: 4.95, z: -2.60, hw: 1.18, hd: 1.48 },   // 부이 책상 + 파티션
    { x: -6.42, z: -4.00, hw: 0.64, hd: 1.98 },  // 책장
    { x: -5.55, z: 2.55, hw: 0.62, hd: 1.62 }    // 커피바
  ];
  const OB_C = [                        // 원형 장애물 (중심 x, z, 반지름)
    { x: -1.00, z: -1.40, r: 1.62 },    // 원탁 + 안락의자
    { x: 1.00, z: 4.55, r: 1.04 },      // 낮은 원탁
    { x: -1.15, z: 3.20, r: 0.80 },     // 안락의자 3
    { x: 1.15, z: 2.40, r: 0.80 },
    { x: 3.15, z: 3.35, r: 0.80 },
    { x: -4.52, z: 1.95, r: 0.44 },     // 스툴
    { x: -4.52, z: 3.10, r: 0.44 },
    { x: -2.55, z: 4.85, r: 0.44 },     // 플로어 램프
    { x: 2.55, z: 1.35, r: 0.50 },      // 사이드 테이블
    { x: -3.05, z: -6.35, r: 0.48 }, { x: -6.30, z: -6.20, r: 0.55 },
    { x: 6.22, z: -1.10, r: 0.55 }, { x: 6.28, z: 1.60, r: 0.50 },
    { x: -6.18, z: 6.05, r: 0.55 }, { x: -3.20, z: 6.28, r: 0.42 },
    { x: 5.10, z: 5.40, r: 0.50 }, { x: -0.10, z: -6.42, r: 0.40 },
    { x: 2.05, z: -6.42, r: 0.36 }
  ];
  function blockedAt(x, z, pad) {
    pad = pad || 0;
    if (Math.abs(x) > ROOM_LIM - pad || Math.abs(z) > ROOM_LIM - pad) return true;
    for (let i = 0; i < OB_B.length; i++) {
      const b = OB_B[i];
      if (Math.abs(x - b.x) < b.hw + pad && Math.abs(z - b.z) < b.hd + pad) return true;
    }
    for (let i = 0; i < OB_C.length; i++) {
      const c = OB_C[i];
      const dx = x - c.x, dz = z - c.z;
      if (dx * dx + dz * dz < (c.r + pad) * (c.r + pad)) return true;
    }
    return false;
  }

  const NAV = { cell: 0.30, min: -6.55, max: 6.55 };
  const NAVN = Math.round((NAV.max - NAV.min) / NAV.cell) + 1;
  const navFree = new Uint8Array(NAVN * NAVN);
  for (let iz = 0; iz < NAVN; iz++) {
    for (let ix = 0; ix < NAVN; ix++) {
      navFree[iz * NAVN + ix] = blockedAt(NAV.min + ix * NAV.cell, NAV.min + iz * NAV.cell, 0.26) ? 0 : 1;
    }
  }
  const navIx = x => Math.max(0, Math.min(NAVN - 1, Math.round((x - NAV.min) / NAV.cell)));
  const navWx = i => NAV.min + i * NAV.cell;

  function nearestFree(ix, iz) {
    if (navFree[iz * NAVN + ix]) return [ix, iz];
    for (let r = 1; r <= 5; r++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const nx2 = ix + dx, nz2 = iz + dz;
          if (nx2 < 0 || nz2 < 0 || nx2 >= NAVN || nz2 >= NAVN) continue;
          if (navFree[nz2 * NAVN + nx2]) return [nx2, nz2];
        }
      }
    }
    return null;
  }
  function lineClear(x1, z1, x2, z2) {
    const d = Math.hypot(x2 - x1, z2 - z1);
    const n = Math.max(2, Math.ceil(d / 0.14));
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (blockedAt(x1 + (x2 - x1) * t, z1 + (z2 - z1) * t, 0.22)) return false;
    }
    return true;
  }
  function findPath(ax, az, bx, bz) {
    let s = nearestFree(navIx(ax), navIx(az));
    let e = nearestFree(navIx(bx), navIx(bz));
    if (!s || !e) return null;
    const S = s[1] * NAVN + s[0], E = e[1] * NAVN + e[0];
    if (S === E) return [{ x: bx, z: bz }];
    const open = [S];
    const came = new Int32Array(NAVN * NAVN).fill(-1);
    const gScore = new Float32Array(NAVN * NAVN).fill(1e9);
    const fScore = new Float32Array(NAVN * NAVN).fill(1e9);
    const inOpen = new Uint8Array(NAVN * NAVN);
    gScore[S] = 0;
    fScore[S] = Math.hypot(s[0] - e[0], s[1] - e[1]);
    inOpen[S] = 1;
    const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    let guard = 0;
    while (open.length && guard++ < 6000) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (fScore[open[i]] < fScore[open[bi]]) bi = i;
      const cur = open.splice(bi, 1)[0];
      inOpen[cur] = 0;
      if (cur === E) {
        const cells = [];
        let c = cur;
        while (c !== -1) { cells.push(c); c = came[c]; }
        cells.reverse();
        const pts = cells.map(i => ({ x: navWx(i % NAVN), z: navWx(Math.floor(i / NAVN)) }));
        pts.push({ x: bx, z: bz });
        // 스트링 풀링 — 곧게 걸을 수 있는 구간은 건너뛴다
        const out = [];
        let i0 = 0;
        while (i0 < pts.length - 1) {
          let j = pts.length - 1;
          while (j > i0 + 1 && !lineClear(pts[i0].x, pts[i0].z, pts[j].x, pts[j].z)) j--;
          out.push(pts[j]);
          i0 = j;
        }
        return out;
      }
      const cx = cur % NAVN, cz = Math.floor(cur / NAVN);
      for (let d = 0; d < DIRS.length; d++) {
        const nx2 = cx + DIRS[d][0], nz2 = cz + DIRS[d][1];
        if (nx2 < 0 || nz2 < 0 || nx2 >= NAVN || nz2 >= NAVN) continue;
        const ni = nz2 * NAVN + nx2;
        if (!navFree[ni]) continue;
        if (DIRS[d][0] && DIRS[d][1] && (!navFree[cz * NAVN + nx2] || !navFree[nz2 * NAVN + cx])) continue;
        const ng = gScore[cur] + DIRS[d][2];
        if (ng < gScore[ni]) {
          gScore[ni] = ng;
          came[ni] = cur;
          fScore[ni] = ng + Math.hypot(nx2 - e[0], nz2 - e[1]);
          if (!inOpen[ni]) { open.push(ni); inOpen[ni] = 1; }
        }
      }
    }
    return null;
  }

  // 돌아다닐 자리 (구역별)
  const ROAM = [
    { x: -3.80, z: 2.42, yaw: -Math.PI / 2, act: 'sip', label: '커피바' },
    { x: -5.12, z: -3.90, yaw: -Math.PI / 2, act: 'browse', label: '책장' },
    { x: -5.15, z: 0.60, yaw: -Math.PI / 2, act: 'browse', label: '화이트보드' },
    { x: 0.30, z: 1.20, yaw: 0.35, act: 'talk', label: '가운데' },
    { x: 2.95, z: 5.55, yaw: 0.15, act: 'talk', label: '라운지 앞' },
    { x: 4.30, z: 0.90, yaw: 1.10, act: 'talk', label: '오른쪽' },
    { x: -3.30, z: 5.30, yaw: -0.75, act: 'talk', label: '문 앞' }
  ].map(s => Object.assign({ taken: null }, s));

  /* 재질: 캐릭터도 같은 보송 클레이 */
  const furTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = '#808080'; x.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 3400; i++) {
      const g = 96 + ((Math.random() * 64) | 0);
      x.fillStyle = 'rgb(' + g + ',' + g + ',' + g + ')';
      x.fillRect((Math.random() * 128) | 0, (Math.random() * 128) | 0, 1, 1 + ((Math.random() * 2) | 0));
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3, 3);
    return t;
  })();

  const clay = (color, o) => new THREE.MeshPhysicalMaterial(Object.assign({
    color, roughness: 0.9, metalness: 0,
    sheen: 0.4, sheenRoughness: 0.75, sheenColor: new THREE.Color(0xFFF5EA),
    bumpMap: furTex, bumpScale: 0.005
  }, o || {}));
  const soft = (color, o) => new THREE.MeshStandardMaterial(Object.assign({
    color, roughness: 0.6, metalness: 0
  }, o || {}));

  // 큰 만화 눈: 흰 눈알 + 세로 동공 (+작은 하이라이트)
  function bigEye(g, x, y, z, r, pr, dark) {
    const w = add(g, sph(r, 22), soft(0xFFFFFF, { roughness: 0.42 }), x, y, z, false);
    w.scale.set(1, 1.1, 0.74);
    const p = add(g, sph(pr, 20), soft(dark || 0x1C1815, { roughness: 0.36 }), x, y - r * 0.03, z + r * 0.58, false);
    p.scale.set(1, 1.34, 0.56);
    const s = add(g, sph(pr * 0.3, 10), soft(0xFFFFFF, { roughness: 0.3 }), x - pr * 0.38, y + pr * 0.6, z + r * 0.66, false);
    s.scale.set(1, 1.1, 0.5);
    return w;
  }
  function dotEye(g, x, y, z, r, color) {
    const e = add(g, sph(r, 16), soft(color || 0x241E1B, { roughness: 0.34 }), x, y, z, false);
    e.scale.set(1, 1.12, 0.7);
    add(g, sph(r * 0.34, 8), soft(0xFFFFFF, { roughness: 0.3 }), x - r * 0.3, y + r * 0.42, z + r * 0.5, false)
      .scale.set(1, 1, 0.5);
    return e;
  }
  function smileArc(g, x, y, z, r, tube, color, flip) {
    const t = add(g, new THREE.TorusGeometry(r, tube, 8, 18, Math.PI), soft(color || 0x2A2320, { roughness: 0.4 }), x, y, z, false);
    if (flip) t.rotation.z = Math.PI;
    t.scale.set(1, 1, 0.6);
    return t;
  }
  function cheek(g, x, y, z, r, color) {
    const c = add(g, sph(r, 14), soft(color || 0xF2A9BE, { roughness: 0.9 }), x, y, z, false);
    c.scale.set(1, 0.82, 0.34);
    return c;
  }

  /* ── 캐릭터별 몸 만들기 ─────────────────────────────────── */
  function makeTri(cfg) {                       // 큐 · 부이
    const body = new THREE.Group();
    const pts = [[-0.5, -0.46], [0.5, -0.46], [0, 0.5]];
    const geo = claySlab(roundShape(pts, 0.28), 0.46, 0.075, 8, 34);
    add(body, geo, clay(cfg.color, { roughness: 0.86 }), 0, 0.64, 0);
    if (cfg.name === '큐') {
      bigEye(body, -0.155, 0.66, 0.27, 0.16, 0.078);
      bigEye(body, 0.155, 0.66, 0.27, 0.16, 0.078);
      // 큰 흰 헤드셋 (밴드 + 이어컵)
      const band = add(body, new THREE.TorusGeometry(0.40, 0.048, 9, 30, Math.PI), clay(0xFBFAF6, { roughness: 0.5 }), 0, 0.72, 0.02, false);
      band.rotation.z = 0;
      [-1, 1].forEach(sd => {
        const cup = add(body, cyl(0.155, 0.155, 0.13, 22), clay(0xF8F5EE, { roughness: 0.44 }), sd * 0.40, 0.60, 0.04, false);
        cup.rotation.z = Math.PI / 2;
        const pad = add(body, cyl(0.10, 0.10, 0.15, 18), clay(0xE3DACB, { roughness: 0.7 }), sd * 0.45, 0.60, 0.04, false);
        pad.rotation.z = Math.PI / 2;
        add(body, sph(0.028, 10), soft(0xE8899A, { roughness: 0.6 }), sd * 0.47, 0.60, 0.14, false);
      });
    } else {
      dotEye(body, -0.155, 0.64, 0.32, 0.058);
      dotEye(body, 0.155, 0.64, 0.32, 0.058);
      const m = add(body, new THREE.CapsuleGeometry(0.028, 0.12, 6, 12), soft(0x241E1B, { roughness: 0.36 }), 0, 0.42, 0.35, false);
      m.rotation.z = -0.16;
      m.rotation.x = -0.05;
    }
    const arms = [-1, 1].map(side => {
      const arm = new THREE.Group();
      arm.position.set(side * 0.33, 0.46, 0.06);
      add(arm, new THREE.CapsuleGeometry(0.072, 0.11, 8, 14), clay(cfg.color, { roughness: 0.86 }), 0, -0.08, 0);
      body.add(arm);
      return arm;
    });
    return { body, arms, legs: [], top: 1.34 };
  }

  function makeDisc(cfg) {                      // 인스팅트: 아이보리 원반 + 세리프 I
    const body = new THREE.Group();
    const discGeo = cyl(0.5, 0.5, 0.34, 48);
    discGeo.rotateX(Math.PI / 2);
    add(body, discGeo, clay(cfg.color, { roughness: 0.86 }), 0, 0.52, 0);
    const ink = soft(0x2C2A28, { roughness: 0.5 });
    add(body, clayBox(0.072, 0.34, 0.05, 4.2, 14), ink, 0, 0.52, 0.155);
    add(body, clayBox(0.155, 0.052, 0.05, 4.2, 14), ink, 0, 0.715, 0.152);
    add(body, clayBox(0.155, 0.052, 0.05, 4.2, 14), ink, 0, 0.325, 0.152);
    if (cfg.glasses) {
      [-1, 1].forEach(sd => {
        const rim = add(body, new THREE.TorusGeometry(0.105, 0.017, 8, 22), ink, sd * 0.175, 0.60, 0.175, false);
        rim.scale.set(1, 1, 0.55);
        const temple = add(body, clayBox(0.018, 0.016, 0.16, 2, 8), ink, sd * 0.27, 0.60, 0.10, false);
        temple.rotation.y = sd * 0.42;
      });
      add(body, clayBox(0.075, 0.016, 0.02, 2, 8), ink, 0, 0.615, 0.19, false);
    }
    return { body, arms: [], legs: [], top: 1.04 };
  }

  function makeHippo(cfg) {                     // 하마뮤즈: 보라 보송 하마
    const body = new THREE.Group();
    const purple = clay(cfg.color);
    const light = clay(0xC8B2EA);
    add(body, sph(0.34, 30), purple, 0, 0.42, 0).scale.set(1.02, 1.04, 0.94);
    add(body, sph(0.31, 32), purple, 0, 0.8, 0).scale.set(1.1, 0.96, 0.96);
    add(body, sph(0.21, 30), light, 0, 0.70, 0.11).scale.set(1.44, 0.72, 0.62);
    cheek(body, -0.26, 0.68, 0.19, 0.095, 0xF39BB8);
    cheek(body, 0.26, 0.68, 0.19, 0.095, 0xF39BB8);
    dotEye(body, -0.125, 0.9, 0.235, 0.045);
    dotEye(body, 0.125, 0.9, 0.235, 0.045);
    add(body, sph(0.024, 12), soft(0x7E6A9A, { roughness: 0.7 }), -0.055, 0.79, 0.29, false);
    add(body, sph(0.024, 12), soft(0x7E6A9A, { roughness: 0.7 }), 0.055, 0.79, 0.29, false);
    if (cfg.glasses) {
      const frame = clay(0x9B6FD8, { roughness: 0.45 });
      [-1, 1].forEach(sd => {
        const rim = add(body, new THREE.TorusGeometry(0.072, 0.014, 8, 20), frame, sd * 0.125, 0.905, 0.285, false);
        rim.scale.set(1, 1, 0.5);
      });
      add(body, clayBox(0.055, 0.014, 0.02, 2, 8), frame, 0, 0.905, 0.315, false);
      [-1, 1].forEach(sd => {
        const tp = add(body, clayBox(0.016, 0.014, 0.12, 2, 8), frame, sd * 0.205, 0.905, 0.235, false);
        tp.rotation.y = sd * 0.45;
      });
    }
    add(body, sph(0.115, 24), soft(0x6E2B45, { roughness: 0.55 }), 0, 0.655, 0.255, false).scale.set(1.2, 0.92, 0.5);
    add(body, sph(0.07, 18), soft(0xEC7C9B, { roughness: 0.7 }), 0, 0.622, 0.3, false).scale.set(1.1, 0.6, 0.45);
    add(body, clayBox(0.05, 0.06, 0.03, 2, 10), soft(0xFFFCF3, { roughness: 0.4 }), 0.045, 0.7, 0.315, false);
    [-0.22, 0.22].forEach(x => {
      add(body, sph(0.1, 20), purple, x, 1.02, -0.02).scale.set(1, 1, 0.8);
      add(body, sph(0.062, 16), soft(0xF6A9C6, { roughness: 0.85 }), x, 1.02, 0.045, false).scale.set(1, 1, 0.5);
    });
    const arms = [-1, 1].map(side => {
      const arm = new THREE.Group();
      arm.position.set(side * 0.32, 0.5, 0);
      add(arm, new THREE.CapsuleGeometry(0.078, 0.2, 8, 16), purple, 0, -0.13, 0);
      body.add(arm);
      return arm;
    });
    const legs = [-1, 1].map(side => {
      const leg = new THREE.Group();
      leg.position.set(side * 0.14, 0.22, 0.02);
      add(leg, new THREE.CapsuleGeometry(0.09, 0.1, 8, 16), purple, 0, -0.13, 0);
      return leg;
    });
    return { body, arms, legs, top: 1.24 };
  }

  function makeYeti(cfg) {                      // 뮤즈: 크림 보송 예티
    const body = new THREE.Group();
    const cream = clay(cfg.color);
    add(body, sph(0.37, 32), cream, 0, 0.46, 0).scale.set(1.0, 1.18, 0.9);
    add(body, sph(0.31, 32), cream, 0, 0.85, 0).scale.set(1.03, 1.0, 0.9);
    add(body, sph(0.235, 28), clay(0xF9E1C2, { roughness: 0.88 }), 0, 0.85, 0.2).scale.set(1.06, 1.02, 0.5);
    dotEye(body, -0.09, 0.875, 0.33, 0.03);
    dotEye(body, 0.09, 0.875, 0.33, 0.03);
    smileArc(body, 0, 0.82, 0.355, 0.045, 0.011, 0x3A2C22, true);
    cheek(body, -0.155, 0.82, 0.315, 0.05, 0xF3B0AE);
    cheek(body, 0.155, 0.82, 0.315, 0.05, 0xF3B0AE);
    add(body, sph(0.07, 14), clay(0xE4D4B7), 0, 1.14, -0.02, false).scale.set(1, 0.7, 1);
    const arms = [-1, 1].map(side => {
      const arm = new THREE.Group();
      arm.position.set(side * 0.34, 0.6, 0);
      const a = add(arm, new THREE.CapsuleGeometry(0.095, 0.2, 8, 16), cream, side * 0.04, -0.14, 0);
      a.rotation.z = side * 0.18;
      body.add(arm);
      return arm;
    });
    const legs = [-1, 1].map(side => {
      const leg = new THREE.Group();
      leg.position.set(side * 0.16, 0.26, 0);
      add(leg, new THREE.CapsuleGeometry(0.11, 0.1, 8, 16), cream, 0, -0.16, 0);
      return leg;
    });
    return { body, arms, legs, top: 1.32 };
  }

  function makeCat(cfg) {                       // 키링: 흰 고양이 (^ ^)
    const body = new THREE.Group();
    const cream = clay(cfg.color, { roughness: 0.88 });
    add(body, sph(0.4, 34), cream, 0, 0.44, 0).scale.set(1.06, 0.94, 0.86);
    add(body, sph(0.36, 32), cream, 0, 0.68, 0).scale.set(1.08, 0.86, 0.88);
    [-1, 1].forEach(side => {
      const ear = add(body, new THREE.ConeGeometry(0.155, 0.26, 26), cream, side * 0.235, 0.88, -0.02);
      ear.rotation.z = side * -0.2;
      ear.scale.set(1, 1, 0.78);
    });
    smileArc(body, -0.135, 0.62, 0.33, 0.058, 0.016, 0x2A2320, false);
    smileArc(body, 0.135, 0.62, 0.33, 0.058, 0.016, 0x2A2320, false);
    cheek(body, -0.215, 0.55, 0.28, 0.062, 0xF7B4C4);
    cheek(body, 0.215, 0.55, 0.28, 0.062, 0xF7B4C4);
    const arms = [-1, 1].map(side => {
      const arm = new THREE.Group();
      arm.position.set(side * 0.34, 0.46, 0.12);
      add(arm, sph(0.105, 20), cream, side * 0.03, -0.05, 0);
      body.add(arm);
      return arm;
    });
    const legs = [-1, 1].map(side => {
      const leg = new THREE.Group();
      leg.position.set(side * 0.16, 0.16, 0.08);
      add(leg, sph(0.11, 20), cream, 0, -0.04, 0);
      return leg;
    });
    return { body, arms, legs, top: 1.14 };
  }

  function makeClover(cfg) {                    // 초록·노랑·연분홍·진분홍: 4엽 피클
    const body = new THREE.Group();
    const geo = claySlab(cloverShape(0.205, 0.175), 0.26, 0.075, 8, 26);
    add(body, geo, clay(cfg.color, { roughness: 0.9 }), 0, 0.42, 0);
    const eye = (x) => {
      const e = add(body, sph(0.048, 18), soft(0x1E1A18, { roughness: 0.34 }), x, 0.44, 0.215, false);
      e.scale.set(0.92, 1.55, 0.7);
      add(body, sph(0.013, 8), soft(0xFFFFFF, { roughness: 0.3 }), x - 0.015, 0.505, 0.25, false)
        .scale.set(1, 1, 0.5);
    };
    if (cfg.face === 'squeeze') {
      // '> <' 장난스러운 눈 (막내)
      [-1, 1].forEach(sd => {
        const x0 = sd * 0.085;
        const a1 = add(body, clayBox(0.082, 0.024, 0.045, 2.6, 8), soft(0x1E1A18, { roughness: 0.36 }), x0, 0.465, 0.232, false);
        a1.rotation.z = sd * 0.62;
        const a2 = add(body, clayBox(0.082, 0.024, 0.045, 2.6, 8), soft(0x1E1A18, { roughness: 0.36 }), x0, 0.418, 0.232, false);
        a2.rotation.z = -sd * 0.62;
      });
      const mo = add(body, new THREE.TorusGeometry(0.036, 0.011, 8, 16, Math.PI), soft(0x1E1A18, { roughness: 0.4 }), 0, 0.395, 0.235, false);
      mo.scale.set(1, 1, 0.5);
    } else {
      eye(-0.085); eye(0.085);
      smileArc(body, 0, 0.365, 0.235, 0.045, 0.011, 0x1E1A18, true);
    }
    return { body, arms: [], legs: [], top: 0.98 };
  }

  function makeSquircle(cfg) {                  // 하크: 검정 스퀘클 + 흰 부채꼴
    const body = new THREE.Group();
    const s = roundShape([[-0.36, -0.36], [0.36, -0.36], [0.36, 0.36], [-0.36, 0.36]], 0.24);
    const geo = claySlab(s, 0.26, 0.115, 9, 26);
    add(body, geo, clay(cfg.color, { roughness: 0.8 }), 0, 0.48, 0);
    const f = new THREE.Shape();
    f.moveTo(-0.21, -0.01);
    f.bezierCurveTo(-0.12, 0.10, -0.02, 0.16, 0.07, 0.17);
    f.bezierCurveTo(0.16, 0.18, 0.20, 0.10, 0.20, 0.01);
    f.bezierCurveTo(0.20, -0.09, 0.15, -0.16, 0.06, -0.18);
    f.bezierCurveTo(-0.04, -0.19, -0.15, -0.09, -0.21, -0.01);
    const fg = new THREE.ExtrudeGeometry(f, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.035, bevelSegments: 6, curveSegments: 26 });
    fg.center();
    const fan = add(body, fg, clay(0xFBFBF8, { roughness: 0.55 }), 0.01, 0.49, 0.215);
    fan.rotation.z = -0.08;
    return { body, arms: [], legs: [], top: 1.0 };
  }

  const BUILDERS = { tri: makeTri, disc: makeDisc, hippo: makeHippo, yeti: makeYeti, cat: makeCat, clover: makeClover, squircle: makeSquircle };

  function buildCharacter(cfg) {
    const root = new THREE.Group();
    const parts = BUILDERS[cfg.kind](cfg);
    root.add(parts.body);
    if (parts.legs) parts.legs.forEach(l => root.add(l));
    root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    root.userData.name = cfg.name;
    return {
      root, body: parts.body, arms: parts.arms || [], legs: parts.legs || [],
      head: parts.body.children[0], torso: parts.body.children[0],
      top: parts.top || 1.2, baseY: 0
    };
  }

  const walkers = PEOPLE.map((cfg, i) => {
    const sx = cfg.seat[0], sz = cfg.seat[1];
    const built = buildCharacter(cfg);
    built.root.scale.setScalar(1.5);
    built.top *= 1.5;
    built.root.position.set(sx, cfg.seatY, sz);
    built.root.rotation.y = cfg.yaw;
    scene.add(built.root);
    return Object.assign({
      cfg, state: 'sit', pose: 1, act: 'type', actT: 3 + Math.random() * 3,
      t: 9 + i * 1.6 + Math.random() * 7, phase: Math.random() * 6,
      path: [], pi: 0, speed: 0.85 + Math.random() * 0.25, stage: null,
      roamSpot: null, stance: { x: cfg.stance[0], z: cfg.stance[1] },
      yawTarget: cfg.yaw
    }, built);
  });
  // 클릭·호버 판정용 메시 목록
  const pickMeshes = [];
  walkers.forEach(w => w.root.traverse(o => { if (o.isMesh) { o.userData.walker = w; pickMeshes.push(o); } }));

  /* ── 아바타 바 ──────────────────────────────────────────── */
  const chips = [];
  walkers.forEach((w, i) => {
    const src2d = document.querySelector('.walker[data-member="' + w.cfg.name + '"] img');
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'o3d-chip';
    chip.innerHTML = (src2d ? '<img src="' + src2d.getAttribute('src') + '" alt="">' : '') + '<span>' + w.cfg.name + '</span>';
    chip.addEventListener('click', () => focusOn(w));
    bar.appendChild(chip);
    chips.push(chip);
  });

  /* ── 선택한 1명만 보이는 미니 이름 태그 (상시 명찰 없음) ── */
  const tag = document.createElement('div');
  tag.className = 'o3d-tag';
  tag.hidden = true;
  tag.innerHTML = '<i class="o3d-tagdot"></i><b></b><span></span>';
  pillLayer.appendChild(tag);
  const tagName = tag.querySelector('b'), tagMeta = tag.querySelector('span');
  const ZONE_NAME = { meeting: '대회의실', command: '지휘실', lounge: '라운지' };

  let focusTarget = null;
  function focusOn(w) {
    focusTarget = w;
    chips.forEach((c, i) => c.classList.toggle('on', walkers[i] === w));
    ring.position.set(w.root.position.x, 0.2, w.root.position.z);
    ring.visible = true;
    tagName.textContent = w.cfg.name;
    tagMeta.textContent = ZONE_NAME[w.cfg.zone] + ' · ' + (w.state === 'walk' ? '이동 중' : (w.act === 'sip' ? '커피 타임' : '근무 중'));
    tag.hidden = false;
    void tag.offsetWidth;
    tag.classList.add('on');
    tip.hidden = true;
    clearTimeout(focusOn.t);
    focusOn.t = setTimeout(() => {
      ring.visible = false; chips.forEach(c => c.classList.remove('on')); focusTarget = null;
      tag.classList.remove('on');
      setTimeout(() => { if (!focusTarget) tag.hidden = true; }, 240);
    }, 4200);
  }
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.58, 0.82, 40),
    new THREE.MeshBasicMaterial({ color: 0xE67F92, transparent: true, opacity: 0.8, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  scene.add(ring);

  /* ── 카메라 조작 ────────────────────────────────────────── */
  const cam = { az: 0.74, pol: 1.00, dist: 34, target: new THREE.Vector3(0.25, 1.30, -0.55), size: 7.6, zoom: 1 };
  const camBase = { az: 0.74, pol: 1.0 };
  // 좁은 화면(모바일)은 방 안쪽이 화면을 가득 채우도록 더 당겨서 보여준다
  let camNarrow = null;
  function fitCam() {
    const w = host.clientWidth || 320;
    const isNarrow = w < 520;
    if (isNarrow === camNarrow) return;
    camNarrow = isNarrow;
    cam.size = isNarrow ? 5.9 : 7.6;
    cam.zoom = 1;
  }

  // 구역 핀을 3D 좌표에 맞춰 화면 위에 놓는다
  // 구역 핀을 3D 좌표에 맞춰 화면 위에 놓는다
  const PIN_ANCHORS = [
    { sel: '.pin-meeting', v: new THREE.Vector3(2.90, 2.98, -5.95) },
    { sel: '.pin-command', v: new THREE.Vector3(-1.00, 2.58, -1.40) },
    { sel: '.pin-lounge',  v: new THREE.Vector3(1.00, 2.38, 3.60) }
  ].map(o => ({ el: document.querySelector(o.sel), v: o.v }));

  function applyCamera() {
    const d = cam.dist, p = cam.pol, a = cam.az;
    camera.position.set(
      cam.target.x + d * Math.sin(p) * Math.sin(a),
      cam.target.y + d * Math.cos(p),
      cam.target.z + d * Math.sin(p) * Math.cos(a)
    );
    camera.lookAt(cam.target);
    const half = cam.size / cam.zoom;
    const aspect = (host.clientWidth || 1) / (host.clientHeight || 1);
    camera.left = -half * aspect; camera.right = half * aspect;
    camera.top = half; camera.bottom = -half;
    camera.updateProjectionMatrix();
    placePins();
  }

  const pointers = new Map();
  let dragging = false, moved = 0, lastX = 0, lastY = 0, pinchStart = 0;
  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) { dragging = true; moved = 0; lastX = e.clientX; lastY = e.clientY; }
    if (pointers.size === 2) { pinchStart = pinchDistance(); }
  });
  canvas.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId)) { hoverTest(e); return; }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1 && dragging) {
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      moved += Math.abs(dx) + Math.abs(dy);
      lastX = e.clientX; lastY = e.clientY;
      cam.az = clamp(cam.az - dx * 0.006, camBase.az - 0.55, camBase.az + 0.55);
      cam.pol = clamp(cam.pol - dy * 0.004, 0.72, 1.24);
      applyCamera();
    } else if (pointers.size === 2) {
      const d = pinchDistance();
      if (pinchStart) cam.zoom = clamp(cam.zoom * (d / pinchStart), 0.6, 2.6);
      pinchStart = d;
      applyCamera();
    }
  });
  canvas.addEventListener('pointerup', e => {
    const wasDrag = moved > 9;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchStart = 0;
    if (pointers.size === 0) dragging = false;
    if (!wasDrag && pointers.size === 0) clickTest(e);
  });
  canvas.addEventListener('pointerleave', () => { pointers.clear(); dragging = false; hideTip(); });
  canvas.addEventListener('wheel', e => {
    if (!e.ctrlKey) return;           // 휠은 페이지 스크롤, Ctrl+휠만 확대·축소
    e.preventDefault();
    cam.zoom = clamp(cam.zoom * (e.deltaY > 0 ? 0.92 : 1.08), 0.7, 2.4);
    applyCamera();
  }, { passive: false });
  function pinchDistance() {
    const p = [...pointers.values()];
    return Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) || 1;
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ── 사물 상호작용 ──────────────────────────────────────── */
  const ray = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const props = [];
  room.traverse(o => { if (o.userData && o.userData.prop) props.push(o); });

  const tip = document.createElement('div');
  tip.className = 'o3d-tip';
  tip.hidden = true;
  host.appendChild(tip);

  let hovered = null;
  function propOf(object) {
    let o = object;
    while (o && !o.userData.prop) o = o.parent;
    return o || null;
  }
  function setHover(o, ev) {
    if (hovered === o) { if (o && ev) moveTip(ev); return; }
    if (hovered) hovered.traverse(n => { if (n.isMesh && n.material && n.material.emissive) n.material.emissive.setHex(n.userData.baseEmi || 0x000000); });
    hovered = o;
    if (o) {
      o.traverse(n => {
        if (n.isMesh && n.material && n.material.emissive) {
          n.userData.baseEmi = n.material.emissive.getHex();
          n.material.emissive.setHex(0xFFD2A0);
          n.material.emissiveIntensity = 0.14;
        }
      });
      canvas.style.cursor = 'pointer';
      tip.hidden = false;
      tip.textContent = PROP_LABEL[o.userData.prop] || '';
      if (ev) moveTip(ev);
    } else {
      canvas.style.cursor = 'grab';
      tip.hidden = true;
    }
  }
  function moveTip(ev) {
    const r = host.getBoundingClientRect();
    tip.style.left = (ev.clientX - r.left) + 'px';
    tip.style.top = (ev.clientY - r.top) + 'px';
  }
  function hideTip() { setHover(null); }

  const PROP_LABEL = { board: '화이트보드', table: '회의 테이블', command: '지휘실 책상', sofa: '라운지 소파', coffee: '커피 테이블', shelf: '책장', window: '창문', desk: '작업실 책상' };

  function raycastAt(ev) {
    const r = canvas.getBoundingClientRect();
    pointer.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(pointer, camera);
    return ray.intersectObjects(props, true);
  }
  function hoverTest(ev) {
    const hits = raycastAt(ev);
    if (pickMeshes.length) {
      const chits = ray.intersectObjects(pickMeshes, false);
      if (chits.length && (!hits.length || chits[0].distance <= hits[0].distance)) {
        const w = chits[0].object.userData.walker;
        if (w) {
          setHover(null);
          canvas.style.cursor = 'pointer';
          tip.hidden = false; tip.textContent = w.cfg.name;
          moveTip(ev);
          return;
        }
      }
    }
    setHover(hits.length ? propOf(hits[0].object) : null, ev);
  }
  function clickTest(ev) {
    const hits = raycastAt(ev);
    if (pickMeshes.length) {
      const chits = ray.intersectObjects(pickMeshes, false);
      if (chits.length && (!hits.length || chits[0].distance <= hits[0].distance)) {
        const w = chits[0].object.userData.walker;
        if (w) { focusOn(w); return; }
      }
    }
    if (!hits.length) { if (window.officePropClose) window.officePropClose(); return; }
    const p = propOf(hits[0].object);
    if (!p) return;
    const b = new THREE.Box3().setFromObject(p);
    const pts = [[b.min.x, b.min.y, b.min.z], [b.max.x, b.max.y, b.max.z]].map(v => {
      const q = new THREE.Vector3(v[0], v[1], v[2]).project(camera);
      return { x: (q.x * 0.5 + 0.5) * canvas.clientWidth, y: (-q.y * 0.5 + 0.5) * canvas.clientHeight };
    });
    const r = host.getBoundingClientRect();
    const rect = {
      left: r.left + Math.min(pts[0].x, pts[1].x),
      right: r.left + Math.max(pts[0].x, pts[1].x),
      top: r.top + Math.min(pts[0].y, pts[1].y),
      bottom: r.top + Math.max(pts[0].y, pts[1].y),
      width: Math.abs(pts[1].x - pts[0].x),
      height: Math.abs(pts[1].y - pts[0].y)
    };
    if (window.officePropOpen) window.officePropOpen(p.userData.prop, rect);
  }

  /* ── 행동 상태머신 & 애니메이션 ─────────────────────────── */
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clock = new THREE.Clock();
  const tmpV = new THREE.Vector3();

  function pickAct(w) {
    const pool = w.cfg.acts || ['type', 'nod'];
    let a = pool[(Math.random() * pool.length) | 0];
    if (w.state === 'rest' && w.roamSpot) a = w.roamSpot.act;
    w.act = a;
    w.actT = 2.8 + Math.random() * 4.4;
  }
  function pickRoam(w) {
    const free = ROAM.filter(s => !s.taken);
    if (!free.length) return null;
    const far = free.filter(s => Math.hypot(s.x - w.cfg.seat[0], s.z - w.cfg.seat[1]) > 2.4);
    const pool = far.length ? far : free;
    return pool[(Math.random() * pool.length) | 0];
  }
  function beginRoam(w) {
    const spot = pickRoam(w);
    if (!spot) { w.t = 3 + Math.random() * 5; return; }
    const path = findPath(w.stance.x, w.stance.z, spot.x, spot.z);
    if (!path || !path.length) { w.t = 3 + Math.random() * 5; return; }
    spot.taken = w;
    w.roamSpot = spot;
    w.path = path; w.pi = 0; w.stage = 'out';
    w.state = 'stand';
  }
  function beginReturn(w) {
    const from = { x: w.root.position.x, z: w.root.position.z };
    const path = findPath(from.x, from.z, w.stance.x, w.stance.z);
    if (w.roamSpot) w.roamSpot.taken = null;
    w.roamSpot = null;
    if (path && path.length) { w.path = path; w.pi = 0; w.state = 'walk'; w.stage = 'back'; }
    else { w.state = 'settle'; }
  }
  function arrive(w) {
    if (w.stage === 'out' && w.roamSpot) {
      w.stage = 'rest';
      w.state = 'rest';
      w.t = 2.8 + Math.random() * 3.6;
      w.yawTarget = w.roamSpot.yaw;
      w.act = w.roamSpot.act;
    } else {
      w.state = 'settle';
      w.yawTarget = w.cfg.yaw;
    }
  }

  function updateCharacter(w, dt, t) {
    const damp = Math.min(1, dt * 7);
    if (w.state !== 'walk') w.phase += dt * 1.2;
    if (reduce) return;
    switch (w.state) {
      case 'sit':
        w.t -= dt; w.actT -= dt;
        if (w.actT <= 0) pickAct(w);
        w.pose += (1 - w.pose) * damp;
        if (w.t <= 0) {
          if (w.cfg.roam && Math.random() < 0.6) beginRoam(w);
          else { w.state = 'stretch'; w.t = 3.6; }
        }
        break;
      case 'stretch':
        w.t -= dt;
        w.pose += ((w.t > 1.3 ? 0.10 : 1) - w.pose) * damp;
        w.act = 'wave';
        w.actT = 99;
        if (w.t <= 0) { w.pose = 1; w.state = 'sit'; w.t = 10 + Math.random() * 16; pickAct(w); }
        break;
      case 'stand': {
        w.pose += (0 - w.pose) * damp;
        const k = 1 - w.pose;
        w.root.position.x = w.cfg.seat[0] + (w.stance.x - w.cfg.seat[0]) * k;
        w.root.position.z = w.cfg.seat[1] + (w.stance.z - w.cfg.seat[1]) * k;
        w.yawTarget = Math.atan2(w.stance.x - w.cfg.seat[0], w.stance.z - w.cfg.seat[1]) || w.cfg.yaw;
        if (w.pose < 0.06) { w.pose = 0; w.state = 'walk'; }
        break;
      }
      case 'walk': {
        const p = w.path[w.pi];
        if (!p) { arrive(w); break; }
        const dx = p.x - w.root.position.x, dz = p.z - w.root.position.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.09) {
          w.pi++;
          if (w.pi >= w.path.length) arrive(w);
          break;
        }
        const step = Math.min(d, w.speed * dt);
        w.root.position.x += (dx / d) * step;
        w.root.position.z += (dz / d) * step;
        w.yawTarget = Math.atan2(dx, dz);
        w.phase += dt * 8.6;
        break;
      }
      case 'rest':
        w.t -= dt;
        if (w.t <= 0) beginReturn(w);
        break;
      case 'settle': {
        w.pose += (1 - w.pose) * damp;
        const k = w.pose;
        w.root.position.x = w.stance.x + (w.cfg.seat[0] - w.stance.x) * k;
        w.root.position.z = w.stance.z + (w.cfg.seat[1] - w.stance.z) * k;
        if (w.pose > 0.97) {
          w.pose = 1; w.state = 'sit'; w.t = 11 + Math.random() * 16;
          w.root.position.x = w.cfg.seat[0];
          w.root.position.z = w.cfg.seat[1];
          pickAct(w);
        }
        break;
      }
    }
  }

  function applyPose(w, dt, t) {
    const damp = Math.min(1, dt * 7);
    const targetY = FLOOR_Y + w.pose * (w.cfg.seatY - FLOOR_Y);
    w.root.position.y += (targetY - w.root.position.y) * Math.min(1, dt * 6);

    let d = w.yawTarget - w.root.rotation.y;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    w.root.rotation.y += d * Math.min(1, dt * 5);

    const walking = (w.state === 'walk' || w.state === 'stand' || w.state === 'settle');
    const sitAmt = w.pose;

    w.legs.forEach((leg, i) => {
      const target = walking
        ? (w.state === 'walk' ? Math.sin(w.phase + i * Math.PI) * 0.52 : 0)
        : (sitAmt * 1.05 + (i % 2 ? 0.10 : 0));
      leg.rotation.x += (target - leg.rotation.x) * damp;
    });

    let bx = 0, by = 0, bob = 0;
    if (w.state === 'walk') {
      bob = Math.abs(Math.sin(w.phase)) * 0.03;
      bx = 0.05;
      w.arms.forEach((arm, i) => {
        arm.rotation.x += (Math.sin(w.phase + i * Math.PI) * 0.42 - arm.rotation.x) * damp;
        arm.rotation.z += (0 - arm.rotation.z) * damp;
      });
    } else {
      const a = w.act;
      if (a === 'type' && sitAmt > 0.35) {
        bx = 0.12 + Math.sin(t * 1.6) * 0.02;
        w.arms.forEach((arm, i) => {
          const target = -0.78 + Math.sin(t * 6.5 + i * Math.PI) * 0.16;
          arm.rotation.x += (target - arm.rotation.x) * Math.min(1, dt * 12);
        });
      } else if (a === 'wave') {
        bx = -0.02; by = Math.sin(t * 3.4) * 0.05;
        w.arms.forEach((arm, i) => {
          const target = i === 1 ? (-2.0 + Math.sin(t * 6) * 0.28) : -0.25;
          arm.rotation.x += (target - arm.rotation.x) * Math.min(1, dt * 8);
        });
      } else if (a === 'sip') {
        bx = -0.06;
        w.arms.forEach((arm, i) => {
          const target = i === 0 ? (-1.5 + Math.sin(t * 2.2) * 0.08) : -0.2;
          arm.rotation.x += (target - arm.rotation.x) * Math.min(1, dt * 6);
        });
      } else if (a === 'read') {
        bx = 0.16;
        w.arms.forEach((arm, i) => {
          const target = -0.75 + Math.sin(t * 1.1 + i) * 0.06;
          arm.rotation.x += (target - arm.rotation.x) * Math.min(1, dt * 6);
        });
      } else if (a === 'nod') {
        bx = 0.05 + Math.sin(t * 2.4) * 0.08;
        w.arms.forEach(arm => { arm.rotation.x += (-0.25 - arm.rotation.x) * Math.min(1, dt * 4); });
      } else if (a === 'talk') {
        by = Math.sin(t * 0.9 + w.phase) * 0.14;
        w.arms.forEach((arm, i) => {
          const target = -0.35 + Math.sin(t * 1.7 + i * 2.1) * 0.22;
          arm.rotation.x += (target - arm.rotation.x) * Math.min(1, dt * 5);
        });
      } else if (a === 'browse') {
        bx = 0.10;
        w.arms.forEach((arm, i) => {
          const target = i === 1 ? (-1.15 + Math.sin(t * 1.4) * 0.22) : -0.3;
          arm.rotation.x += (target - arm.rotation.x) * Math.min(1, dt * 5);
        });
      } else {
        bob = (Math.sin(t * 1.3 + w.phase) * 0.5 + 0.5) * 0.012;
        w.arms.forEach(arm => { arm.rotation.x += (0 - arm.rotation.x) * damp; });
      }
    }
    w.body.position.y = bob;
    w.body.rotation.x += (bx - w.body.rotation.x) * damp;
    w.body.rotation.y += (by - w.body.rotation.y) * Math.min(1, dt * 3);
  }

  // 걷는 사람끼리(앉은 사람과도) 너무 붙지 않게 살짝 밀어낸다
  function separate(dt) {
    const k = Math.min(1, dt * 6);
    for (let i = 0; i < walkers.length; i++) {
      const a = walkers[i];
      if (a.state !== 'walk') continue;
      for (let j = 0; j < walkers.length; j++) {
        if (i === j) continue;
        const b = walkers[j];
        const dx = a.root.position.x - b.root.position.x;
        const dz = a.root.position.z - b.root.position.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.0001 && d < 0.82) {
          const push = (0.82 - d) * k;
          a.root.position.x += (dx / d) * push;
          a.root.position.z += (dz / d) * push;
        }
      }
    }
  }

  /* ── 렌더 루프 ──────────────────────────────────────────── */
  function resize() {
    const w = host.clientWidth || 320, h = host.clientHeight || 320;
    fitCam();
    renderer.setSize(w, h, false);
    applyCamera();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(host);

  function frame() {
    const dt = Math.min(0.05, clock.getDelta());
    const t = clock.elapsedTime;
    walkers.forEach(w => { updateCharacter(w, dt, t); applyPose(w, dt, t); });
    separate(dt);
    if (focusTarget) {
      const rp = focusTarget.root.position;
      ring.position.set(rp.x, 0.2, rp.z);
      tmpV.set(rp.x, focusTarget.top + 0.18 + rp.y, rp.z).project(camera);
      tag.style.transform = 'translate(-50%,-100%) translate(' +
        ((tmpV.x * 0.5 + 0.5) * host.clientWidth).toFixed(1) + 'px,' +
        (((-tmpV.y * 0.5 + 0.5) * host.clientHeight) - 8).toFixed(1) + 'px)';
    }
    if (ring.visible) ring.material.opacity = 0.62 + Math.sin(t * 3) * 0.18;
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  applyCamera();
  resize();
  stage.classList.add('stage-3d');
  host.hidden = false;
  window.__office3dReady = true;
  window.__o3d = { scene, camera, cam, walkers, applyCamera, ring, renderer, THREE, ROAM, findPath };  // 개발용 핸들
  requestAnimationFrame(frame);
})();
