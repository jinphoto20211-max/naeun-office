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
  renderer.toneMappingExposure = 1.06;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 200);

  /* ── 팔레트 (레퍼런스: 크림 벽 + 허니 우드 + 세이지) ───────── */
  const C = {
    wall: 0xEFE1CA, wallTrim: 0xE2CFB2, wallBase: 0xE6D4B8,
    floor: 0xC89B68, floorDark: 0xB0854F, floorLight: 0xD6AE7C,
    stone: 0xCBC4B8, stoneDark: 0xB9B1A3,
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
    t.repeat.set(2.6, 2.6);
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
      a.push(cur.clone().sub(prev).normalize().multiplyScalar(r).add(cur));
      b.push(cur.clone().sub(next).normalize().multiplyScalar(r).add(cur));
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
  scene.add(new THREE.HemisphereLight(0xFFF6E9, 0xD9C4A6, 1.0));
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
  const slab = add(room, clayBox(R * 2 + 0.7, 0.9, R * 2 + 0.7, 3.6, 26), M.stone, 0, -0.38, 0);
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
  const wallZ = add(room, clayBox(R * 2 + 1.3, WALL_H, WALL_T, 4.2, 26), M.wall, 0, WALL_H / 2, -R - WALL_T / 2 + 0.06);
  const wallX = add(room, clayBox(WALL_T, WALL_H, R * 2 + 1.3, 4.2, 26), M.wall, -R - WALL_T / 2 + 0.06, WALL_H / 2, 0);
  wallZ.receiveShadow = wallX.receiveShadow = true;
  [wallZ, wallX].forEach((w, i) => {
    const capW = i === 0 ? R * 2 + 1.5 : WALL_T + 0.24;
    const capD = i === 0 ? WALL_T + 0.24 : R * 2 + 1.5;
    const x = i === 0 ? 0 : -R - WALL_T / 2 + 0.06;
    const z = i === 0 ? -R - WALL_T / 2 + 0.06 : 0;
    add(room, clayBox(capW, 0.2, capD, 3.0, 20), M.wallTrim, x, WALL_H + 0.02, z);
    add(room, clayBox(capW - 0.06, 0.46, capD - 0.06, 3.0, 20), M.wallBase, x, 0.28, z);
  });

  // 벽 액자 · 벽등 · 문
  function wallFrame(x, y, z, w, h, ry, art) {
    const g = new THREE.Group();
    g.position.set(x, y, z); g.rotation.y = ry || 0;
    add(g, clayBox(w, h, 0.09, 3.2, 16), M.cream, 0, 0, 0);
    add(g, clayBox(w - 0.16, h - 0.16, 0.05, 3.2, 16), clayMat(art, { roughness: 0.9 }), 0, 0, 0.05, false);
    room.add(g);
    return g;
  }
  wallFrame(-3.4, 2.25, -R + 0.05, 1.0, 0.78, 0, 0xBFD3D8);
  wallFrame(-1.55, 2.5, -R + 0.05, 0.7, 0.9, 0, 0xE7C9A8);
  wallFrame(-R + 0.05, 2.2, 2.1, 0.9, 0.72, Math.PI / 2, 0xD8C6A6);

  // 문 (왼쪽 벽)
  (function door() {
    const g = new THREE.Group();
    g.position.set(-R + 0.06, 0, 4.3); g.rotation.y = Math.PI / 2;
    add(g, clayBox(1.5, 2.5, 0.12, 3.4, 18), M.wallBase, 0, 1.25, 0);
    add(g, clayBox(1.2, 2.2, 0.1, 3.2, 16), M.cream, 0, 1.18, 0.06, false);
    add(g, sph(0.07, 10), M.woodDark, 0.42, 1.15, 0.12, false);
    room.add(g);
  })();
  // 벽등 (따뜻한 스콘)
  (function sconce() {
    const g = new THREE.Group();
    g.position.set(-2.6, 2.55, -R + 0.12);
    add(g, clayBox(0.26, 0.34, 0.16, 3, 14), M.woodDark, 0, 0, 0);
    add(g, sph(0.16, 14), M.glow, 0, 0.02, 0.14, false).scale.set(1, 1.15, 1);
    const pl = new THREE.PointLight(0xFFDCAE, 3.2, 4.5, 2);
    pl.position.set(0, 0.05, 0.28);
    g.add(pl);
    room.add(g);
  })();

  // 바깥 돌 테두리(플린스) + 덤불 + 계단
  const plinthY = -0.16;
  add(room, clayBox(R * 2 + 2.5, 0.5, 1.1, 3.6, 22), M.stoneDark, 0, plinthY, R + 1.0);
  add(room, clayBox(1.1, 0.5, R * 2 + 2.5, 3.6, 22), M.stoneDark, R + 1.0, plinthY, 0);
  add(room, clayBox(2.6, 0.22, 0.62, 3.4, 18), M.woodLight, 0, -0.2, R + 1.75);
  add(room, clayBox(2.0, 0.22, 0.5, 3.4, 18), M.woodLight, 0, -0.02, R + 1.35, false);

  // 앞 테두리 덤불
  for (let i = 0; i < 9; i++) {
    const x = -6.0 + i * 1.42;
    if (x > -0.9 && x < 1.2) continue;              // 계단 자리 비우기
    const s = 0.16 + Math.random() * 0.07;
    add(room, sph(s, 12), i % 2 ? M.leaf : M.leaf2, x, 0.26, R + 1.0, false);
    add(room, sph(s * 0.8, 10), M.leaf2, x + 0.24, 0.24, R + 1.12, false);
  }
  for (let i = 0; i < 7; i++) {
    const z = -4.4 + i * 1.5;
    const s = 0.15 + Math.random() * 0.06;
    add(room, sph(s, 12), i % 2 ? M.leaf2 : M.leaf, R + 1.0, 0.26, z, false);
  }

  /* ── 가구 헬퍼 ──────────────────────────────────────────── */
  function group(x, z, ry) {
    const g = new THREE.Group();
    g.position.set(x, FLOOR_Y, z);
    g.rotation.y = ry || 0;
    room.add(g);
    return g;
  }
  function chair(g, x, z, ry) {
    const ch = new THREE.Group();
    ch.position.set(x, 0, z); ch.rotation.y = ry;
    add(ch, cyl(0.36, 0.36, 0.1, 22), M.sageDark, 0, 0.46, 0);
    add(ch, clayBox(0.72, 0.16, 0.72, 2.6, 16), M.sage, 0, 0.56, 0);
    add(ch, clayBox(0.16, 0.78, 0.66, 2.6, 16), M.sage, 0, 0.94, -0.3);
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
    add(m, clayBox(w, h, 0.09, 3.4, 16), M.dark, 0, 0.3 + h / 2, 0);
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
    return add(g, clayBox(w, h, d, 3.4, 10), clayMat(color, { roughness: 0.9 }), x, y, z);
  }

  /* ── 지휘실: 아늑한 곡선 책상 + 은은한 모니터 ──────────── */
  const command = group(0, -5.9);
  command.userData.prop = 'command';
  const deskTop = add(command, clayBox(6.0, 0.16, 1.2, 2.8, 22), M.woodLight, 0, 0.76, 0);
  deskTop.rotation.x = 0;
  add(command, clayBox(6.0, 0.16, 0.2, 3, 16), M.woodDark, 0, 0.68, -0.52);
  add(command, clayBox(0.24, 0.76, 0.95, 2.8, 16), M.wood, -2.88, 0.38, 0);
  add(command, clayBox(0.24, 0.76, 0.95, 2.8, 16), M.wood, 2.88, 0.38, 0);
  add(command, clayBox(1.25, 0.62, 0.8, 2.8, 16), M.wood, -1.9, 0.31, 0);
  add(command, clayBox(1.25, 0.62, 0.8, 2.8, 16), M.wood, 1.9, 0.31, 0);
  monitor(command, -1.95, 0.8, -0.16, 0.28, 1.05, 0.62, screenTexB);
  monitor(command, 0, 0.8, -0.22, 0, 1.18, 0.7, screenTexA);
  monitor(command, 1.95, 0.8, -0.16, -0.28, 1.05, 0.62, screenTexC);
  add(command, clayBox(0.78, 0.06, 0.3, 3, 14), M.dark, 0, 0.86, 0.2);        // 키보드
  add(command, cyl(0.1, 0.09, 0.16, 16), M.cream, 1.3, 0.9, 0.26);            // 머그
  add(command, cyl(0.17, 0.14, 0.34, 14), M.pot, -2.3, 0.98, 0.2);            // 화분
  plant(command, -2.3, 0.2, 0.45);
  chair(command, -2.1, -1.05, 0.05);
  chair(command, 1.95, -1.05, -0.05);

  /* ── 대회의실: 둥근 우드 테이블 ─────────────────────────── */
  const tableAt = group(-4.0, -0.8);
  tableAt.userData.prop = 'table';
  add(tableAt, cyl(1.5, 1.5, 0.14, 44), M.wood, 0, 0.74, 0);
  add(tableAt, cyl(1.36, 1.36, 0.08, 40), M.woodLight, 0, 0.82, 0);
  add(tableAt, cyl(0.22, 0.26, 0.72, 18), M.woodDark, 0, 0.38, 0);
  add(tableAt, cyl(0.6, 0.6, 0.1, 26), M.woodDark, 0, 0.06, 0);
  add(tableAt, cyl(0.1, 0.09, 0.17, 14), M.cream, 0.62, 0.9, 0.2);
  add(tableAt, cyl(0.1, 0.09, 0.17, 14), M.cream, -0.5, 0.9, -0.3);
  add(tableAt, clayBox(0.34, 0.04, 0.44, 3, 12), M.cream, 0.1, 0.86, 0.35);
  book(tableAt, -0.15, 0.9, 0.3, 0.34, 0.06, 0.26, 0xD9A574);
  [[0, -2.15, 0], [0, 2.15, Math.PI], [-2.15, 0, Math.PI / 2], [2.15, 0, -Math.PI / 2]]
    .forEach(([x, z, ry]) => chair(tableAt, x, z, ry));
  plant(tableAt, 1.0, -1.0, 0.55);

  /* ── 라운지: 소파 · 러그 · 커피 테이블 · 스탠드 ─────────── */
  const rug = add(room, clayBox(4.6, 0.08, 3.6, 2.4, 22), M.rug, 3.9, FLOOR_Y + 0.04, -3.0);
  rug.castShadow = false;
  const rug2 = add(room, clayBox(4.4, 0.07, 3.4, 2.4, 22), fabricMat(0xF6ECDB, { bumpScale: 0.022 }), -4.0, FLOOR_Y + 0.035, -0.8);
  rug2.castShadow = false;

  const sofa = group(4.35, -4.35, 0.07);
  sofa.userData.prop = 'sofa';
  add(sofa, clayBox(3.2, 0.42, 1.2, 2.6, 20), M.sage, 0, 0.44, 0);
  add(sofa, clayBox(3.2, 0.8, 0.34, 2.6, 20), M.sage, 0, 0.8, -0.46);
  add(sofa, clayBox(0.34, 0.68, 1.16, 2.6, 18), M.sageDark, -1.5, 0.66, 0);
  add(sofa, clayBox(0.34, 0.68, 1.16, 2.6, 18), M.sageDark, 1.5, 0.66, 0);
  add(sofa, clayBox(1.34, 0.2, 1.02, 2.4, 16), M.sage, -0.76, 0.62, 0.04);
  add(sofa, clayBox(1.34, 0.2, 1.02, 2.4, 16), M.sage, 0.76, 0.62, 0.04);
  add(sofa, clayBox(0.7, 0.52, 0.24, 2.4, 14), M.pink, -0.95, 0.86, -0.16).rotation.z = 0.1;
  add(sofa, clayBox(0.62, 0.46, 0.22, 2.4, 14), M.cream, 0.95, 0.82, -0.14).rotation.z = -0.12;

  const coffee = group(3.15, -2.55);
  coffee.userData.prop = 'coffee';
  add(coffee, cyl(0.76, 0.76, 0.12, 30), M.woodLight, 0, 0.42, 0);
  add(coffee, cyl(0.1, 0.1, 0.4, 12), M.woodDark, 0, 0.22, 0);
  add(coffee, cyl(0.36, 0.36, 0.08, 22), M.woodDark, 0, 0.05, 0);
  add(coffee, cyl(0.1, 0.09, 0.15, 14), M.cream, 0.3, 0.53, 0.12);
  add(coffee, cyl(0.1, 0.09, 0.15, 14), M.cream, -0.28, 0.53, -0.1);
  add(coffee, cyl(0.09, 0.07, 0.24, 12), M.leaf2, 0.05, 0.56, -0.02);
  book(coffee, 0.02, 0.5, 0.28, 0.3, 0.05, 0.22, 0xD1B49A);

  /* ── 작업실 책상 (개인 자리) ─────────────────────────────── */
  const deskSpots = [[-4.5, 3.1, 0.22], [-4.5, 5.3, 0.12], [4.3, 3.6, -0.3]];
  deskSpots.forEach(([x, z, ry]) => {
    const d = group(x, z, ry);
    d.userData.prop = 'desk';
    add(d, clayBox(2.0, 0.13, 1.0, 2.6, 20), M.woodLight, 0, 0.75, 0);
    add(d, clayBox(0.16, 0.74, 0.9, 2.8, 16), M.wood, -0.92, 0.37, 0);
    add(d, clayBox(0.16, 0.74, 0.9, 2.8, 16), M.wood, 0.92, 0.37, 0);
    add(d, clayBox(0.7, 0.56, 0.84, 2.8, 16), M.wood, 0.52, 0.28, 0);
    add(d, clayBox(0.66, 0.05, 0.44, 3, 12), M.dark, -0.2, 0.84, 0.06);
    add(d, clayBox(0.54, 0.36, 0.06, 3.4, 12), M.dark, -0.2, 1.02, -0.06);
    add(d, cyl(0.09, 0.08, 0.14, 14), M.cream, 0.6, 0.88, 0.22);
    chair(d, 0, 1.1, Math.PI);
  });

  /* ── 책장 ───────────────────────────────────────────────── */
  const shelf = group(-6.5, -3.3, Math.PI / 2);
  shelf.userData.prop = 'shelf';
  add(shelf, clayBox(3.0, 2.4, 0.14, 3.6, 18), M.woodDark, 0, 1.22, -0.26);
  add(shelf, clayBox(0.14, 2.4, 0.62, 3.2, 14), M.wood, -1.5, 1.22, 0);
  add(shelf, clayBox(0.14, 2.4, 0.62, 3.2, 14), M.wood, 1.5, 1.22, 0);
  add(shelf, clayBox(3.2, 0.16, 0.66, 3.0, 16), M.wood, 0, 2.42, 0);
  add(shelf, clayBox(3.2, 0.16, 0.66, 3.0, 16), M.wood, 0, 0.08, 0);
  for (let i = 0; i < 4; i++) {
    const y = 0.48 + i * 0.56;
    add(shelf, clayBox(2.94, 0.09, 0.56, 3, 14), M.woodLight, 0, y, 0);
    let bx = -1.2;
    for (let b = 0; b < 7; b++) {
      const bw = 0.1 + ((i + b) % 3) * 0.02;
      const bh = 0.26 + ((i * 3 + b) % 4) * 0.05;
      book(shelf, bx, y + 0.05 + bh / 2, 0.02, bw, bh, 0.32, [0xE9AEB2, 0x9DC0DC, 0xA9BFA6, 0xE9A78F, 0xF8EEDE, 0x86AE74, 0xE3C37A][(i + b) % 7]);
      bx += bw + 0.06;
      if (bx > 1.1) break;
    }
  }
  plant(shelf, 1.1, 0.02, 0.5);

  /* ── 화이트보드 ─────────────────────────────────────────── */
  const board = group(-4.6, -6.7);
  board.userData.prop = 'board';
  add(board, clayBox(2.8, 1.62, 0.12, 3.4, 18), M.cream, 0, 1.78, 0);
  add(board, clayBox(2.56, 1.4, 0.06, 3.2, 16), clayMat(0xFDFBF4, { roughness: 0.7 }), 0, 1.78, 0.08, false);
  add(board, clayBox(0.72, 0.06, 0.03, 3, 10), clayMat(0xE8899A), -0.55, 2.14, 0.12, false);
  add(board, clayBox(1.12, 0.05, 0.03, 3, 10), clayMat(0x8FB8DE), -0.2, 1.96, 0.12, false);
  add(board, clayBox(0.94, 0.05, 0.03, 3, 10), clayMat(0x7FC197), 0.15, 1.8, 0.12, false);
  add(board, clayBox(0.52, 0.05, 0.03, 3, 10), clayMat(0xE8B27A), -0.4, 1.62, 0.12, false);
  add(board, clayBox(1.5, 0.14, 0.12, 3, 14), M.woodLight, 0, 0.94, 0.06);

  /* ── 창문 (따뜻한 채광) ─────────────────────────────────── */
  const win = group(4.2, -6.72);
  win.userData.prop = 'window';
  add(win, clayBox(2.6, 2.0, 0.14, 3.4, 18), M.cream, 0, 1.94, 0);
  add(win, clayBox(2.36, 1.76, 0.08, 3.2, 16), new THREE.MeshStandardMaterial({
    color: 0xFFEDD2, emissive: 0xFFD9A8, emissiveIntensity: 0.55, roughness: 0.5
  }), 0, 1.94, 0.08, false);
  add(win, clayBox(0.09, 1.76, 0.05, 3, 10), M.cream, 0, 1.94, 0.13);
  add(win, clayBox(2.36, 0.09, 0.05, 3, 10), M.cream, 0, 1.94, 0.13);
  add(win, clayBox(2.8, 0.14, 0.26, 3, 14), M.woodLight, 0, 0.9, 0.02);
  const winLight = new THREE.PointLight(0xFFE2B8, 4.5, 7, 2);
  winLight.position.set(0, 1.9, 0.6);
  win.add(winLight);

  /* ── 소품: 화분 · 스탠드 · 천장등 ───────────────────────── */
  plant(room, -6.2, -6.1, 1.1);
  plant(room, 6.0, -6.1, 0.95);
  plant(room, 6.1, 0.9, 1.2);
  plant(room, -6.3, 6.0, 1.0);
  plant(room, 5.9, -1.5, 0.8);
  plant(room, 2.4, 5.3, 0.95);

  const sideTable = group(-1.6, 5.0);
  add(sideTable, cyl(0.36, 0.32, 0.08, 20), M.woodLight, 0, 0.54, 0);
  add(sideTable, cyl(0.06, 0.06, 0.5, 12), M.woodDark, 0, 0.27, 0);
  add(sideTable, cyl(0.22, 0.22, 0.06, 18), M.woodDark, 0, 0.03, 0);
  add(sideTable, cyl(0.1, 0.09, 0.16, 14), M.cream, 0.06, 0.64, 0.02);

  const lamp = group(5.9, -2.6);
  add(lamp, cyl(0.26, 0.3, 0.08, 20), M.woodDark, 0, 0.04, 0);
  add(lamp, cyl(0.04, 0.04, 1.9, 10), M.woodDark, 0, 1.0, 0);
  add(lamp, cyl(0.34, 0.26, 0.38, 22), new THREE.MeshStandardMaterial({
    color: 0xFFE6BE, emissive: 0xFFD49A, emissiveIntensity: 0.7, roughness: 0.65
  }), 0, 2.02, 0);
  const lampPoint = new THREE.PointLight(0xFFCF96, 6, 6, 2);
  lampPoint.position.set(0, 2.0, 0);
  lamp.add(lampPoint);

  // 천장 목걸이 조명(따뜻한 공)
  add(room, cyl(0.3, 0.3, 0.07, 18), M.cream, -1.4, 3.35, -6.7, false);
  add(room, sph(0.19, 16), M.glow, -1.4, 3.16, -6.7, false);

  /* ── 캐릭터 (나은님 실제 캐릭터 사진 8장 기준) ───────────── */
  const PEOPLE = [
    { name: '초록',     kind: 'clover',   color: 0x6ECC55, zone: 'meeting', spots: [0, 1, 5] },
    { name: '노랑',     kind: 'clover',   color: 0xF7D63F, zone: 'meeting', spots: [1, 2, 3] },
    { name: '진분홍',   kind: 'clover',   color: 0xF0329A, zone: 'meeting', spots: [2, 3, 4] },
    { name: '막내',     kind: 'clover',   color: 0xFCC9DC, zone: 'meeting', spots: [3, 4, 19] },
    { name: '뮤즈',     kind: 'yeti',     color: 0xEDE0C8, zone: 'command', spots: [8, 9] },
    { name: '하마뮤즈', kind: 'hippo',    color: 0xB49BE0, zone: 'command', spots: [9, 10, 11] },
    { name: '인스팅트', kind: 'disc',     color: 0xF4EBDC, zone: 'command', spots: [10, 11, 12] },
    { name: '하크',     kind: 'squircle', color: 0x242424, zone: 'lounge',  spots: [14, 15] },
    { name: '부이',     kind: 'tri',      color: 0xFF3E9E, zone: 'lounge',  spots: [15, 16] },
    { name: '큐',       kind: 'tri',      color: 0x4E9DF0, zone: 'lounge',  spots: [13, 14] },
    { name: '키링',     kind: 'cat',      color: 0xFCF4E6, zone: 'lounge',  spots: [12, 13] }
  ];

  // 3D 바닥 좌표계 통로 (x, z)
  const NODES = [
    [-6.0, 1.8], [-6.2, 3.3], [-3.1, 4.6], [-1.4, 5.2], [-0.6, 4.2],
    [-1.2, 2.4], [-1.2, 0.4], [-1.0, -1.8], [-1.6, -3.6], [-3.0, -4.9],
    [-1.0, -4.9], [1.0, -4.9], [2.4, -3.8], [2.2, -2.2], [3.6, -1.9],
    [5.0, -2.0], [5.4, -0.2], [3.8, 1.0], [2.0, 2.6], [0.2, 3.6]
  ];
  const EDGES = [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10],[10,11],[11,12],[12,13],[13,14],[14,15],[15,16],[16,17],[17,18],[18,19]];
  const ADJ = NODES.map(() => []);
  EDGES.forEach(([a, b]) => { ADJ[a].push(b); ADJ[b].push(a); });
  function findPath(a, b) {
    if (a === b) return [a];
    const prev = {}, seen = { [a]: true }, q = [a];
    while (q.length) {
      const cur = q.shift();
      for (const nx of ADJ[cur]) {
        if (seen[nx]) continue;
        seen[nx] = true; prev[nx] = cur;
        if (nx === b) { const p = [b]; let c = b; while (c !== a) { c = prev[c]; p.unshift(c); } return p; }
        q.push(nx);
      }
    }
    return null;
  }

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
    const pts = [[-0.52, -0.5], [0.52, -0.5], [0, 0.52]];
    const geo = pillow(claySlab(roundShape(pts, 0.22), 0.44, 0.13, 9, 30), 1.32, 1.28, 0.05);
    add(body, geo, clay(cfg.color, { roughness: 0.86 }), 0, 0.64, 0);
    if (cfg.name === '큐') {
      bigEye(body, -0.16, 0.68, 0.3, 0.16, 0.078);
      bigEye(body, 0.16, 0.68, 0.3, 0.16, 0.078);
    } else {
      dotEye(body, -0.155, 0.64, 0.32, 0.058);
      dotEye(body, 0.155, 0.64, 0.32, 0.058);
      const m = add(body, new THREE.CapsuleGeometry(0.028, 0.12, 6, 12), soft(0x241E1B, { roughness: 0.36 }), 0, 0.42, 0.35, false);
      m.rotation.z = -0.16;
      m.rotation.x = -0.05;
    }
    return { body, arms: [], legs: [], top: 1.34 };
  }

  function makeDisc(cfg) {                      // 인스팅트: 아이보리 원반 + 세리프 I
    const body = new THREE.Group();
    add(body, sph(0.5, 44), clay(cfg.color, { roughness: 0.88 }), 0, 0.52, 0).scale.set(1, 1, 0.38);
    const ink = soft(0x2C2A28, { roughness: 0.55 });
    add(body, clayBox(0.08, 0.3, 0.06, 2.2, 12), ink, 0, 0.52, 0.15);
    add(body, clayBox(0.185, 0.06, 0.06, 2.2, 12), ink, 0, 0.69, 0.15);
    add(body, clayBox(0.185, 0.06, 0.06, 2.2, 12), ink, 0, 0.35, 0.15);
    return { body, arms: [], legs: [], top: 1.04 };
  }

  function makeHippo(cfg) {                     // 하마뮤즈: 보라 보송 하마
    const body = new THREE.Group();
    const purple = clay(cfg.color);
    const light = clay(0xC8B2EA);
    add(body, sph(0.34, 30), purple, 0, 0.42, 0).scale.set(1.02, 1.04, 0.94);
    add(body, sph(0.31, 32), purple, 0, 0.8, 0).scale.set(1.1, 0.96, 0.96);
    add(body, sph(0.21, 30), light, 0, 0.71, 0.14).scale.set(1.42, 0.74, 0.78);
    cheek(body, -0.26, 0.68, 0.19, 0.095, 0xF39BB8);
    cheek(body, 0.26, 0.68, 0.19, 0.095, 0xF39BB8);
    dotEye(body, -0.125, 0.9, 0.235, 0.045);
    dotEye(body, 0.125, 0.9, 0.235, 0.045);
    add(body, sph(0.024, 12), soft(0x7E6A9A, { roughness: 0.7 }), -0.055, 0.8, 0.33, false);
    add(body, sph(0.024, 12), soft(0x7E6A9A, { roughness: 0.7 }), 0.055, 0.8, 0.33, false);
    add(body, sph(0.115, 24), soft(0x6E2B45, { roughness: 0.55 }), 0, 0.66, 0.25, false).scale.set(1.18, 0.9, 0.55);
    add(body, sph(0.07, 18), soft(0xEC7C9B, { roughness: 0.7 }), 0, 0.625, 0.3, false).scale.set(1.1, 0.6, 0.5);
    add(body, clayBox(0.05, 0.06, 0.03, 2, 10), soft(0xFFFCF3, { roughness: 0.4 }), 0.045, 0.7, 0.305, false);
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
    add(body, sph(0.31, 32), cream, 0, 0.85, 0).scale.set(1.03, 1.0, 0.96);
    add(body, sph(0.235, 28), clay(0xF9E1C2, { roughness: 0.88 }), 0, 0.85, 0.18).scale.set(1.06, 1.02, 0.44);
    dotEye(body, -0.09, 0.875, 0.38, 0.03);
    dotEye(body, 0.09, 0.875, 0.38, 0.03);
    smileArc(body, 0, 0.82, 0.42, 0.045, 0.011, 0x3A2C22, true);
    cheek(body, -0.155, 0.82, 0.37, 0.05, 0xF3B0AE);
    cheek(body, 0.155, 0.82, 0.37, 0.05, 0xF3B0AE);
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
      const ear = add(body, new THREE.ConeGeometry(0.14, 0.24, 26), cream, side * 0.235, 0.92, -0.02);
      ear.rotation.z = side * -0.16;
      add(body, sph(0.05, 14), cream, side * 0.272, 1.01, -0.02, false);
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
    const geo = pillow(claySlab(cloverShape(0.23, 0.155), 0.26, 0.135, 9, 24), 1.0, 1.0, 0.05);
    add(body, geo, clay(cfg.color, { roughness: 0.9 }), 0, 0.47, 0);
    const eye = (x) => {
      const e = add(body, sph(0.045, 18), soft(0x1E1A18, { roughness: 0.34 }), x, 0.485, 0.235, false);
      e.scale.set(0.92, 1.55, 0.55);
      add(body, sph(0.012, 8), soft(0xFFFFFF, { roughness: 0.3 }), x - 0.014, 0.545, 0.28, false)
        .scale.set(1, 1, 0.5);
    };
    eye(-0.085); eye(0.085);
    return { body, arms: [], legs: [], top: 0.98 };
  }

  function makeSquircle(cfg) {                  // 하크: 검정 스퀘클 + 흰 부채꼴
    const body = new THREE.Group();
    const s = roundShape([[-0.36, -0.36], [0.36, -0.36], [0.36, 0.36], [-0.36, 0.36]], 0.24);
    const geo = pillow(claySlab(s, 0.26, 0.115, 9, 26), 0.95, 0.95, 0.045);
    add(body, geo, clay(cfg.color, { roughness: 0.8 }), 0, 0.48, 0);
    const f = new THREE.Shape();
    f.moveTo(-0.21, -0.01);
    f.bezierCurveTo(-0.12, 0.10, -0.02, 0.16, 0.07, 0.17);
    f.bezierCurveTo(0.16, 0.18, 0.20, 0.10, 0.20, 0.01);
    f.bezierCurveTo(0.20, -0.09, 0.15, -0.16, 0.06, -0.18);
    f.bezierCurveTo(-0.04, -0.19, -0.15, -0.09, -0.21, -0.01);
    const fg = new THREE.ExtrudeGeometry(f, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.035, bevelSegments: 6, curveSegments: 26 });
    fg.center();
    const fan = add(body, fg, clay(0xFBFBF8, { roughness: 0.55 }), 0.01, 0.49, 0.17);
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
    const built = buildCharacter(cfg);
    const startIdx = cfg.spots[0];
    const [sx, sz] = NODES[startIdx];
    built.root.position.set(sx, FLOOR_Y, sz);
    scene.add(built.root);

    const pill = document.createElement('div');
    pill.className = 'o3d-pill';
    pill.innerHTML = '<i class="o3d-dot"></i><b>' + cfg.name + '</b><span class="o3d-prog"><i></i></span>';
    pillLayer.appendChild(pill);

    return Object.assign({
      cfg, idx: startIdx, path: [], pill,
      bar: pill.querySelector('.o3d-prog > i'),
      node: built, phase: Math.random() * 6, speed: 0.85,
      wait: 1.5 + Math.random() * 4, busy: false, segT: 0, segD: 0,
      from: new THREE.Vector3(sx, 0, sz), to: new THREE.Vector3(sx, 0, sz),
      yaw: 0
    }, built);
  });

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

  let focusTarget = null;
  function focusOn(w) {
    focusTarget = w;
    chips.forEach((c, i) => c.classList.toggle('on', walkers[i] === w));
    ring.position.set(w.root.position.x, 0.16, w.root.position.z);
    ring.visible = true;
    clearTimeout(focusOn.t);
    focusOn.t = setTimeout(() => { ring.visible = false; chips.forEach(c => c.classList.remove('on')); focusTarget = null; }, 4200);
  }
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.5, 0.72, 40),
    new THREE.MeshBasicMaterial({ color: 0xE6A0AA, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  scene.add(ring);

  /* ── 카메라 조작 ────────────────────────────────────────── */
  const cam = { az: 0.78, pol: 0.98, dist: 34, target: new THREE.Vector3(0.2, 1.15, -0.4), size: 8.6, zoom: 1 };
  const camBase = { az: 0.76, pol: 1.0 };
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
      if (pinchStart) cam.dist = clamp(cam.dist * (pinchStart / d), 13, 30);
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
    setHover(hits.length ? propOf(hits[0].object) : null, ev);
  }
  function clickTest(ev) {
    const hits = raycastAt(ev);
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

  /* ── 이동 & 애니메이션 ──────────────────────────────────── */
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clock = new THREE.Clock();
  let lastDeclutter = 0;
  const tmpV = new THREE.Vector3();

  function pickSpot(w) {
    const free = w.cfg.spots.filter(i => {
      if (i === w.idx) return false;
      return !walkers.some(o => o !== w && o.idx === i);
    });
    if (!free.length) return;
    const target = free[(Math.random() * free.length) | 0];
    const path = findPath(w.idx, target);
    if (!path || path.length < 2) return;
    w.path = path.slice(1);
    w.busy = true;
    nextSegment(w);
  }
  function nextSegment(w) {
    if (!w.path.length) { w.busy = false; w.wait = 2 + Math.random() * 5; w.idx = w.targetIdx; return; }
    const n = w.path.shift();
    w.targetIdx = n;
    const [x, z] = NODES[n];
    w.from.copy(w.root.position);
    w.to.set(x, 0, z);
    w.segD = w.from.distanceTo(w.to);
    w.segT = 0;
    w.yaw = Math.atan2(w.to.x - w.from.x, w.to.z - w.from.z);
  }

  function updateCharacter(w, dt, t) {
    if (!reduce) {
      if (!w.busy) {
        w.wait -= dt;
        if (w.wait <= 0) pickSpot(w);
      } else {
        const sp = w.speed * dt;
        w.segT += sp;
        const k = w.segD > 0 ? Math.min(1, w.segT / w.segD) : 1;
        tmpV.copy(w.from).lerp(w.to, k);
        w.root.position.x = tmpV.x;
        w.root.position.z = tmpV.z;
        w.bar.style.width = Math.round(k * 100) + '%';
        let d = w.yaw - w.root.rotation.y;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        w.root.rotation.y += d * Math.min(1, dt * 7);
        w.phase += dt * 9.5;
        const s = Math.sin(w.phase);
        if (w.legs.length > 1) { w.legs[0].rotation.x = s * 0.55; w.legs[1].rotation.x = -s * 0.55; }
        if (w.arms.length > 1) { w.arms[0].rotation.x = -s * 0.45; w.arms[1].rotation.x = s * 0.45; }
        w.body.position.y = w.baseY + Math.abs(Math.cos(w.phase)) * 0.032;
        w.body.rotation.z = s * 0.035;
        if (k >= 1) nextSegment(w);
      }
      if (!w.busy) {
        w.phase += dt * 1.6;
        const b = Math.sin(w.phase) * 0.5 + 0.5;
        w.body.position.y = w.baseY + b * 0.012;
        w.body.rotation.z *= 0.9;
        if (w.legs.length > 1) { w.legs[0].rotation.x *= 0.86; w.legs[1].rotation.x *= 0.86; }
        if (w.arms.length > 1) { w.arms[0].rotation.x *= 0.86; w.arms[1].rotation.x *= 0.86; }
        w.root.rotation.y += Math.sin(t * 0.5 + w.phase) * 0.0012;
        w.bar.style.width = '0%';
      }
    }
    // 이름표(HTML) 투영
    tmpV.set(w.root.position.x, w.top + 0.24, w.root.position.z);
    tmpV.project(camera);
    const inFront = tmpV.z < 1;
    const sx = (tmpV.x * 0.5 + 0.5) * host.clientWidth;
    const sy = (-tmpV.y * 0.5 + 0.5) * host.clientHeight;
    w.pill.style.transform = 'translate(-50%,-100%) translate(' + sx.toFixed(1) + 'px,' + (sy - 6).toFixed(1) + 'px)';
    w.pill.style.opacity = inFront ? '1' : '0';
    w.sx = sx; w.sy = sy; w.vis = inFront;
  }

  function declutterPills() {
    const kept = [];
    walkers.slice().sort((a, b) => b.sy - a.sy).forEach(w => {
      if (!w.vis) return;
      const clash = kept.some(k => Math.abs(k.sx - w.sx) < 56 && Math.abs(k.sy - w.sy) < 18);
      w.pill.classList.toggle('dim', clash);
      if (!clash) kept.push(w);
    });
  }

  /* ── 렌더 루프 ──────────────────────────────────────────── */
  function resize() {
    const w = host.clientWidth || 320, h = host.clientHeight || 320;
    renderer.setSize(w, h, false);
    applyCamera();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(host);

  function frame() {
    const dt = Math.min(0.05, clock.getDelta());
    const t = clock.elapsedTime;
    walkers.forEach(w => updateCharacter(w, dt, t));
    if (t - lastDeclutter > 0.25) { lastDeclutter = t; declutterPills(); }
    if (focusTarget) {
      cam.target.lerp(new THREE.Vector3(focusTarget.root.position.x * 0.55, 0.9, focusTarget.root.position.z * 0.55), 0.04);
      applyCamera();
    }
    if (ring.visible) ring.material.opacity = 0.35 + Math.sin(t * 3) * 0.18;
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  applyCamera();
  resize();
  stage.classList.add('stage-3d');
  host.hidden = false;
  window.__office3dReady = true;
  window.__o3d = { scene, camera, cam, walkers, applyCamera, ring, renderer, THREE };  // 개발용 핸들
  requestAnimationFrame(frame);
})();
