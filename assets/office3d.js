/* 나은 비서실 — 3D 클레이 오피스 (three.js, 인라인 주입용 모듈)
   - 아이소메트릭 카메라 · 실제 그림자 · 깊이 정렬(occlusion) 자동
   - 10명 3D 캐릭터: 색·모양·이름표 고유, 걷기(팔·다리)·방향 회전·바운스
   - 책상·테이블·소파·책장·창문 등 사물 클릭 → 정보 카드
   - 드래그 회전 / 핀치·휠 줌 / 탭 선택 (모바일 대응)
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
  renderer.toneMappingExposure = 1.03;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 200);

  /* ── 팔레트 ─────────────────────────────────────────────── */
  const C = {
    wall: 0xF2E3CD, wall2: 0xEBD8BE, floor: 0xB9C6A6, floor2: 0xAFBD9B,
    wood: 0xC08A57, woodDark: 0x96663E, woodLight: 0xD3A470,
    dark: 0x4B3A31, white: 0xFFF9F0, cream: 0xFBF1E2,
    sage: 0x9DBCA4, sageDark: 0x7FA889, pink: 0xE8A6AE, coral: 0xEFA992,
    blue: 0x8FB8DE, screen: 0x2E3B49, screenOn: 0x6C93B8,
    leaf: 0x6FA463, leaf2: 0x86B871, pot: 0xC98A62, rug: 0xEFD9BE, metal: 0x8C8F94
  };

  const mat = (color, rough = 0.95, extra = {}) =>
    new THREE.MeshStandardMaterial(Object.assign({ color, roughness: rough, metalness: 0.02 }, extra));

  const add = (parent, geo, material, x = 0, y = 0, z = 0, shadow = true) => {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    if (shadow) { m.castShadow = true; m.receiveShadow = true; }
    parent.add(m);
    return m;
  };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const cyl = (rt, rb, h, seg = 20) => new THREE.CylinderGeometry(rt, rb, h, seg);
  const sph = (r, s = 16) => new THREE.SphereGeometry(r, s, Math.max(8, s / 2));

  /* ── 조명 ───────────────────────────────────────────────── */
  scene.add(new THREE.HemisphereLight(0xFFF3E0, 0xB9AE9A, 1.15));
  const sun = new THREE.DirectionalLight(0xFFF0DC, 1.55);
  sun.position.set(-6.5, 11, 7.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -9; sun.shadow.camera.right = 9;
  sun.shadow.camera.top = 9; sun.shadow.camera.bottom = -9;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 34;
  sun.shadow.bias = -0.0012;
  sun.shadow.radius = 2.4;
  scene.add(sun);
  const lampLight = new THREE.PointLight(0xFFDEB0, 14, 12, 2);
  lampLight.position.set(2.6, 3.1, -5.6);
  scene.add(lampLight);

  /* ── 방 ─────────────────────────────────────────────────── */
  const room = new THREE.Group();
  scene.add(room);
  const R = 7;                       // 바닥 반폭

  const floorBase = add(room, box(R * 2 + 0.9, 0.5, R * 2 + 0.9), mat(C.wall2), 0, -0.25, 0);
  floorBase.castShadow = false;
  const floorTop = add(room, box(R * 2, 0.16, R * 2), mat(C.floor), 0, 0, 0);
  floorTop.castShadow = false;
  // 바닥 널 결 (얇은 판)
  for (let i = -6; i <= 6; i++) {
    const s = add(room, box(R * 2 - 0.1, 0.02, 0.06), mat(C.floor2, 1), 0, 0.085, i * 1.05, false);
    s.receiveShadow = true; s.castShadow = false;
  }
  // 벽
  const wallMat = mat(C.wall, 0.98);
  add(room, box(R * 2 + 0.6, 3.6, 0.36), wallMat, 0, 1.8, -R - 0.18);
  add(room, box(0.36, 3.6, R * 2 + 0.6), wallMat, -R - 0.18, 1.8, 0);
  // 걸레받이
  add(room, box(R * 2 + 0.6, 0.16, 0.1), mat(C.woodLight), 0, 0.14, -R + 0.03);
  add(room, box(0.1, 0.16, R * 2 + 0.6), mat(C.woodLight), -R + 0.03, 0.14, 0);

  /* ── 가구 헬퍼 ───────────────────────────────────────────── */
  function group(x, z, ry = 0) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    room.add(g);
    return g;
  }
  function chair(g, x, z, ry) {
    const ch = new THREE.Group();
    ch.position.set(x, 0, z); ch.rotation.y = ry;
    add(ch, cyl(0.34, 0.34, 0.1, 18), mat(C.sageDark), 0, 0.46, 0);
    add(ch, box(0.66, 0.12, 0.66), mat(C.sage), 0, 0.52, 0);
    add(ch, box(0.12, 0.7, 0.62), mat(C.sage), 0, 0.86, -0.29);
    add(ch, cyl(0.06, 0.06, 0.42, 10), mat(C.metal, 0.6), 0, 0.22, 0);
    add(ch, cyl(0.3, 0.3, 0.06, 16), mat(C.metal, 0.6), 0, 0.04, 0);
    g.add(ch);
    return ch;
  }
  function monitor(g, x, y, z, ry, w = 1.05, h = 0.62) {
    const m = new THREE.Group(); m.position.set(x, y, z); m.rotation.y = ry;
    add(m, box(0.1, 0.34, 0.1), mat(C.metal, 0.7), 0, 0.17, 0);
    add(m, box(w, h, 0.06), mat(0x2A2F36), 0, 0.34 + h / 2, 0);
    add(m, box(w * 0.93, h * 0.86, 0.02), mat(C.screenOn, 0.5, { emissive: 0x2E4A63, emissiveIntensity: 0.55 }), 0, 0.34 + h / 2, 0.045, false);
    g.add(m);
    return m;
  }
  function plant(g, x, z, scale = 1) {
    const p = new THREE.Group(); p.position.set(x, 0, z); p.scale.setScalar(scale);
    add(p, cyl(0.3, 0.24, 0.4, 14), mat(C.pot), 0, 0.2, 0);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const leaf = add(p, sph(0.26, 12), mat(i % 2 ? C.leaf : C.leaf2), Math.cos(a) * 0.18, 0.62 + (i % 3) * 0.16, Math.sin(a) * 0.18);
      leaf.scale.set(0.8, 1.5, 0.8);
    }
    g.add(p);
    return p;
  }


  /* ── 지휘실: 곡선 책상 + 모니터 ─────────────────────────── */
  const command = group(0, -5.9);
  command.userData.prop = 'command';
  add(command, box(5.9, 0.12, 1.15), mat(C.woodLight), 0, 0.76, 0);
  add(command, box(5.9, 0.1, 0.16), mat(C.woodDark), 0, 0.7, -0.5);
  add(command, box(0.2, 0.76, 0.9), mat(C.wood), -2.85, 0.38, 0);
  add(command, box(0.2, 0.76, 0.9), mat(C.wood), 2.85, 0.38, 0);
  add(command, box(1.2, 0.5, 0.72), mat(C.wood), -1.9, 0.25, 0);
  add(command, box(1.2, 0.5, 0.72), mat(C.wood), 1.9, 0.25, 0);
  monitor(command, -1.95, 0.8, -0.15, 0.26);
  monitor(command, 0, 0.8, -0.2, 0, 1.15, 0.66);
  monitor(command, 1.95, 0.8, -0.15, -0.26);
  add(command, box(0.7, 0.04, 0.26), mat(C.dark, 0.8), 0, 0.83, 0.18);        // 키보드
  add(command, cyl(0.09, 0.08, 0.14, 12), mat(C.white), 1.3, 0.86, 0.22);      // 머그
  add(command, cyl(0.16, 0.13, 0.34, 12), mat(C.pot), -2.3, 0.95, 0.18);       // 화분
  chair(command, -2.1, -1.05, 0.05);
  chair(command, 1.95, -1.05, -0.05);

  /* ── 대회의실: 원형 테이블 ──────────────────────────────── */
  const tableAt = group(-4.0, -0.8);
  tableAt.userData.prop = 'table';
  add(tableAt, cyl(1.45, 1.45, 0.12, 40), mat(C.wood), 0, 0.74, 0);
  add(tableAt, cyl(1.3, 1.3, 0.06, 36), mat(C.woodLight), 0, 0.81, 0);
  add(tableAt, cyl(0.16, 0.2, 0.72, 14), mat(C.woodDark), 0, 0.38, 0);
  add(tableAt, cyl(0.55, 0.55, 0.07, 24), mat(C.woodDark), 0, 0.05, 0);
  add(tableAt, cyl(0.1, 0.09, 0.16, 12), mat(C.white), 0.62, 0.89, 0.2);
  add(tableAt, cyl(0.1, 0.09, 0.16, 12), mat(C.white), -0.5, 0.89, -0.3);
  add(tableAt, box(0.3, 0.03, 0.4), mat(C.white, 1), 0.1, 0.85, 0.35);
  [[0, -2.05, 0], [0, 2.05, Math.PI], [-2.05, 0, Math.PI / 2], [2.05, 0, -Math.PI / 2]]
    .forEach(([x, z, ry]) => chair(tableAt, x, z, ry));

  /* ── 라운지: 소파·커피 테이블·러그 ──────────────────────── */
  const rug = add(room, box(4.4, 0.04, 3.4), mat(C.rug, 1), 3.9, 0.09, -3.0);
  rug.castShadow = false;
  const rug2 = add(room, box(4.3, 0.03, 3.3), mat(0xE7CDAE, 1), -4.0, 0.08, -0.8);
  rug2.castShadow = false;
  add(room, cyl(2.05, 2.05, 0.02, 36), mat(0xF0DDC6, 1), -4.0, 0.1, -0.8, false);
  const sofa = group(4.35, -4.35, 0.07);
  sofa.userData.prop = 'sofa';
  add(sofa, box(3.1, 0.34, 1.15), mat(C.sage), 0, 0.42, 0);
  add(sofa, box(3.1, 0.72, 0.3), mat(C.sage), 0, 0.75, -0.44);
  add(sofa, box(0.28, 0.62, 1.1), mat(C.sageDark), -1.45, 0.62, 0);
  add(sofa, box(0.28, 0.62, 1.1), mat(C.sageDark), 1.45, 0.62, 0);
  add(sofa, box(1.3, 0.16, 1.0), mat(C.sage), -0.75, 0.6, 0.03);
  add(sofa, box(1.3, 0.16, 1.0), mat(C.sage), 0.75, 0.6, 0.03);
  add(sofa, sph(0.24, 14), mat(C.pink), -0.9, 0.78, -0.2);
  add(sofa, sph(0.2, 14), mat(C.cream), 0.95, 0.74, -0.16);

  const coffee = group(3.15, -2.55);
  coffee.userData.prop = 'coffee';
  add(coffee, cyl(0.72, 0.72, 0.1, 28), mat(C.woodLight), 0, 0.42, 0);
  add(coffee, cyl(0.09, 0.09, 0.4, 10), mat(C.woodDark), 0, 0.22, 0);
  add(coffee, cyl(0.34, 0.34, 0.06, 20), mat(C.woodDark), 0, 0.04, 0);
  add(coffee, cyl(0.1, 0.09, 0.14, 12), mat(C.white), 0.3, 0.52, 0.12);
  add(coffee, cyl(0.1, 0.09, 0.14, 12), mat(C.white), -0.28, 0.52, -0.1);
  add(coffee, cyl(0.09, 0.07, 0.24, 10), mat(C.leaf2), 0.05, 0.55, -0.02);

  /* ── 작업실 책상 (개인 자리) ─────────────────────────────── */
  const deskSpots = [[-4.5, 3.1, 0.22], [-4.5, 5.3, 0.12], [4.3, 3.6, -0.3]];
  deskSpots.forEach(([x, z, ry], i) => {
    const d = group(x, z, ry);
    d.userData.prop = 'desk';
    add(d, box(1.9, 0.1, 0.95), mat(C.woodLight), 0, 0.74, 0);
    add(d, box(0.12, 0.72, 0.85), mat(C.wood), -0.88, 0.36, 0);
    add(d, box(0.12, 0.72, 0.85), mat(C.wood), 0.88, 0.36, 0);
    add(d, box(0.66, 0.5, 0.8), mat(C.wood), 0.5, 0.25, 0);
    add(d, box(0.62, 0.03, 0.42), mat(C.dark, 0.8), -0.2, 0.81, 0.05);
    add(d, box(0.5, 0.34, 0.05), mat(0x2A2F36), -0.2, 0.99, -0.06);
    add(d, cyl(0.08, 0.075, 0.13, 12), mat(C.white), 0.55, 0.86, 0.2);
    chair(d, 0, 1.05, Math.PI);
  });

  /* ── 책장 ───────────────────────────────────────────────── */
  const shelf = group(-6.5, -3.3, Math.PI / 2);
  shelf.userData.prop = 'shelf';
  add(shelf, box(3.0, 2.3, 0.1), mat(C.woodDark), 0, 1.15, -0.24);       // 뒤판
  add(shelf, box(0.1, 2.3, 0.56), mat(C.wood), -1.45, 1.15, 0);          // 옆판
  add(shelf, box(0.1, 2.3, 0.56), mat(C.wood), 1.45, 1.15, 0);
  add(shelf, box(3.1, 0.12, 0.6), mat(C.wood), 0, 2.3, 0);               // 상판
  add(shelf, box(3.1, 0.12, 0.6), mat(C.wood), 0, 0.08, 0);              // 하판
  for (let i = 0; i < 4; i++) {
    const y = 0.44 + i * 0.52;
    add(shelf, box(2.86, 0.06, 0.5), mat(C.woodLight), 0, y, 0);
    for (let b = 0; b < 8; b++) {
      const col = [C.pink, C.blue, C.sage, C.coral, C.cream, C.leaf2, 0xE3C37A][(i + b) % 7];
      const hgt = 0.24 + ((i + b) % 3) * 0.06;
      add(shelf, box(0.075, hgt, 0.26), mat(col, 1), -1.18 + b * 0.33, y + 0.03 + hgt / 2, 0.04);
    }
  }

  /* ── 화이트보드 (뒷벽 왼쪽) ─────────────────────────────── */
  const board = group(-4.6, -6.8);
  board.userData.prop = 'board';
  add(board, box(2.7, 1.55, 0.08), mat(C.cream), 0, 1.75, 0);
  add(board, box(2.5, 1.36, 0.04), mat(0xFDFBF4, 0.6), 0, 1.75, 0.06, false);
  add(board, box(0.7, 0.05, 0.02), mat(0xE8899A, 0.8), -0.55, 2.12, 0.09, false);
  add(board, box(1.1, 0.04, 0.02), mat(0x8FB8DE, 0.8), -0.2, 1.95, 0.09, false);
  add(board, box(0.9, 0.04, 0.02), mat(0x7FC197, 0.8), 0.15, 1.8, 0.09, false);
  add(board, box(0.5, 0.04, 0.02), mat(0xE8B27A, 0.8), -0.4, 1.62, 0.09, false);
  add(board, box(1.4, 0.12, 0.1), mat(C.woodLight), 0, 0.94, 0.08);

  /* ── 창문 (뒷벽) ────────────────────────────────────────── */
  const win = group(4.2, -6.84);
  win.userData.prop = 'window';
  add(win, box(2.5, 1.9, 0.1), mat(C.cream), 0, 1.9, 0);
  add(win, box(2.26, 1.66, 0.06), mat(0xBCD9EF, 0.4, { emissive: 0x9CC4E0, emissiveIntensity: 0.35 }), 0, 1.9, 0.06, false);
  add(win, box(0.06, 1.66, 0.04), mat(C.cream), 0, 1.9, 0.1);
  add(win, box(2.26, 0.06, 0.04), mat(C.cream), 0, 1.9, 0.1);
  add(win, box(2.7, 0.12, 0.24), mat(C.woodLight), 0, 0.92, 0.02);

  /* ── 소품: 화분 · 조명 · 시계 ───────────────────────────── */
  plant(room, -6.3, -6.2, 1.15);
  plant(room, 6.1, -6.2, 1.0);
  plant(room, 6.2, 0.9, 1.25);
  plant(room, -6.4, 6.1, 1.05);
  plant(room, 5.9, -1.6, 0.85);
  plant(room, 2.4, 5.4, 1.0);
  const sideTable = group(-1.6, 5.0);
  add(sideTable, cyl(0.34, 0.3, 0.06, 18), mat(C.woodLight), 0, 0.52, 0);
  add(sideTable, cyl(0.05, 0.05, 0.5, 10), mat(C.woodDark), 0, 0.26, 0);
  add(sideTable, cyl(0.2, 0.2, 0.04, 14), mat(C.woodDark), 0, 0.02, 0);
  add(sideTable, cyl(0.09, 0.08, 0.15, 12), mat(C.white), 0.06, 0.62, 0.02);
  const lamp = group(5.9, -2.6);
  add(lamp, cyl(0.22, 0.26, 0.06, 16), mat(C.woodDark), 0, 0.03, 0);
  add(lamp, cyl(0.035, 0.035, 1.9, 8), mat(C.woodDark), 0, 0.95, 0);
  const shade = add(lamp, cyl(0.3, 0.24, 0.34, 16), mat(C.cream, 0.7, { emissive: 0xFFD9A0, emissiveIntensity: 0.35 }), 0, 1.95, 0);
  add(room, cyl(0.26, 0.26, 0.05, 16), mat(C.cream), -1.4, 3.2, -6.8, false);  // 천장 조명
  add(room, sph(0.17, 12), mat(0xFFE9C0, 0.5, { emissive: 0xFFE0A8, emissiveIntensity: 0.7 }), -1.4, 3.03, -6.8, false);

  /* ── 캐릭터 (나은님 실제 캐릭터 사진 8장 기준 리모델링) ──────
     큐·부이 = 둥근 삼각 클레이 / 하마뮤즈 = 보라 하마 / 뮤즈 = 크림 예티
     인스팅트 = 아이보리 원반 + 세리프 I / 하크 = 검정 스쿼클 + 흰 부채
     키링 = 흰 고양이(^ ^) / 초록·노랑·연분홍·진분홍 = 4엽 피클
  */
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

  /* ── 재질: 무광 클레이 + 아주 얇은 보송 결 ───────────────── */
  const furTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = '#808080'; x.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 3200; i++) {
      const g = 96 + ((Math.random() * 64) | 0);
      x.fillStyle = 'rgb(' + g + ',' + g + ',' + g + ')';
      x.fillRect((Math.random() * 128) | 0, (Math.random() * 128) | 0, 1, 1 + ((Math.random() * 2) | 0));
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3, 3);
    return t;
  })();

  const clay = (color, o) => new THREE.MeshStandardMaterial(Object.assign({
    color, roughness: 0.96, metalness: 0, bumpMap: furTex, bumpScale: 0.0035
  }, o || {}));
  const soft = (color, o) => new THREE.MeshStandardMaterial(Object.assign({
    color, roughness: 0.62, metalness: 0
  }, o || {}));

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
  function claySlab(shape, depth, bevel) {
    const g = new THREE.ExtrudeGeometry(shape, {
      depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel,
      bevelSegments: 5, curveSegments: 18
    });
    g.center();
    return g;
  }

  // 큰 만화 눈: 흰 눈알 + 세로 동공 (+작은 하이라이트)
  function bigEye(g, x, y, z, r, pr, dark) {
    const w = add(g, sph(r, 20), soft(0xFFFFFF, { roughness: 0.42 }), x, y, z, false);
    w.scale.set(1, 1.1, 0.74);
    const p = add(g, sph(pr, 18), soft(dark || 0x1C1815, { roughness: 0.36 }), x, y - r * 0.03, z + r * 0.58, false);
    p.scale.set(1, 1.34, 0.56);
    const s = add(g, sph(pr * 0.3, 10), soft(0xFFFFFF, { roughness: 0.3 }), x - pr * 0.38, y + pr * 0.6, z + r * 0.66, false);
    s.scale.set(1, 1.1, 0.5);
    return w;
  }
  // 작은 점 눈
  function dotEye(g, x, y, z, r, color) {
    const e = add(g, sph(r, 14), soft(color || 0x241E1B, { roughness: 0.34 }), x, y, z, false);
    e.scale.set(1, 1.12, 0.7);
    add(g, sph(r * 0.34, 8), soft(0xFFFFFF, { roughness: 0.3 }), x - r * 0.3, y + r * 0.42, z + r * 0.5, false)
      .scale.set(1, 1, 0.5);
    return e;
  }
  // 웃는 눈(^) · 웃는 입(‿)
  function smileArc(g, x, y, z, r, tube, color, flip) {
    const t = add(g, new THREE.TorusGeometry(r, tube, 8, 16, Math.PI), soft(color || 0x2A2320, { roughness: 0.4 }), x, y, z, false);
    if (flip) t.rotation.z = Math.PI;
    t.scale.set(1, 1, 0.6);
    return t;
  }
  function cheek(g, x, y, z, r, color) {
    const c = add(g, sph(r, 12), soft(color || 0xF2A9BE, { roughness: 0.9 }), x, y, z, false);
    c.scale.set(1, 0.82, 0.34);
    return c;
  }

  /* ── 캐릭터별 몸 만들기 ─────────────────────────────────── */
  function makeTri(cfg) {                       // 큐 · 부이
    const body = new THREE.Group();
    const pts = [[-0.52, -0.5], [0.52, -0.5], [0, 0.52]];
    const geo = claySlab(roundShape(pts, 0.19), 0.5, 0.1);
    const shell = add(body, geo, soft(cfg.color, { roughness: 0.72 }), 0, 0.6, 0);
    shell.scale.set(1, 1, 1);
    if (cfg.kind === 'tri' && cfg.name === '큐') {
      bigEye(body, -0.16, 0.66, 0.3, 0.155, 0.075);
      bigEye(body, 0.16, 0.66, 0.3, 0.155, 0.075);
    } else {
      dotEye(body, -0.155, 0.62, 0.3, 0.058);
      dotEye(body, 0.155, 0.62, 0.3, 0.058);
      const m = add(body, new THREE.CapsuleGeometry(0.026, 0.12, 4, 10), soft(0x241E1B, { roughness: 0.36 }), 0, 0.4, 0.33, false);
      m.rotation.z = -0.16;
      m.rotation.x = -0.05;
    }
    return { body, arms: [], legs: [], top: 1.24 };
  }

  function makeDisc(cfg) {                      // 인스팅트: 아이보리 원반 + 세리프 I
    const body = new THREE.Group();
    const shell = add(body, sph(0.5, 32), clay(cfg.color, { roughness: 0.9 }), 0, 0.52, 0);
    shell.scale.set(1, 1, 0.36);
    const ink = soft(0x2C2A28, { roughness: 0.55 });
    add(body, box(0.075, 0.3, 0.05), ink, 0, 0.52, 0.155);
    add(body, box(0.085, 0.05, 0.05), ink, 0, 0.695, 0.155);
    add(body, box(0.175, 0.055, 0.055), ink, 0, 0.69, 0.15);
    add(body, box(0.175, 0.055, 0.055), ink, 0, 0.35, 0.15);
    return { body, arms: [], legs: [], top: 1.04 };
  }

  function makeHippo(cfg) {                     // 하마뮤즈: 보라 보송 하마
    const body = new THREE.Group();
    const purple = clay(cfg.color);
    const light = clay(0xC8B2EA);
    add(body, sph(0.34, 24), purple, 0, 0.4, 0).scale.set(1.02, 1.02, 0.94);
    const head = add(body, sph(0.31, 26), purple, 0, 0.8, 0);
    head.scale.set(1.1, 0.96, 0.96);
    // 주둥이
    const mz = add(body, sph(0.21, 24), light, 0, 0.71, 0.14);
    mz.scale.set(1.42, 0.74, 0.78);
    // 볼
    cheek(body, -0.26, 0.68, 0.19, 0.095, 0xF39BB8);
    cheek(body, 0.26, 0.68, 0.19, 0.095, 0xF39BB8);
    // 눈 + 콧구멍
    dotEye(body, -0.125, 0.9, 0.235, 0.045);
    dotEye(body, 0.125, 0.9, 0.235, 0.045);
    add(body, sph(0.024, 10), soft(0x7E6A9A, { roughness: 0.7 }), -0.055, 0.8, 0.33, false);
    add(body, sph(0.024, 10), soft(0x7E6A9A, { roughness: 0.7 }), 0.055, 0.8, 0.33, false);
    // 벌린 입 + 혀 + 앞니 하나
    const mouth = add(body, sph(0.115, 20), soft(0x6E2B45, { roughness: 0.55 }), 0, 0.66, 0.25, false);
    mouth.scale.set(1.18, 0.9, 0.55);
    const tongue = add(body, sph(0.07, 16), soft(0xEC7C9B, { roughness: 0.7 }), 0, 0.625, 0.3, false);
    tongue.scale.set(1.1, 0.6, 0.5);
    add(body, box(0.05, 0.055, 0.03), soft(0xFFFCF3, { roughness: 0.4 }), 0.045, 0.7, 0.305, false);
    // 귀
    [-0.22, 0.22].forEach(x => {
      add(body, sph(0.1, 16), purple, x, 1.02, -0.02).scale.set(1, 1, 0.8);
      add(body, sph(0.062, 14), soft(0xF6A9C6, { roughness: 0.85 }), x, 1.02, 0.045, false).scale.set(1, 1, 0.5);
    });
    // 팔 · 다리
    const arms = [-1, 1].map(side => {
      const arm = new THREE.Group();
      arm.position.set(side * 0.32, 0.5, 0);
      add(arm, new THREE.CapsuleGeometry(0.075, 0.2, 5, 12), purple, 0, -0.13, 0);
      body.add(arm);
      return arm;
    });
    const legs = [-1, 1].map(side => {
      const leg = new THREE.Group();
      leg.position.set(side * 0.14, 0.22, 0.02);
      add(leg, new THREE.CapsuleGeometry(0.088, 0.1, 5, 12), purple, 0, -0.13, 0);
      return leg;
    });
    return { body, arms, legs, top: 1.24 };
  }

  function makeYeti(cfg) {                      // 뮤즈: 크림 보송 예티
    const body = new THREE.Group();
    const cream = clay(cfg.color);
    const peak = clay(0xE4D4B7);
    add(body, sph(0.37, 26), cream, 0, 0.44, 0).scale.set(1.0, 1.18, 0.9);
    const head = add(body, sph(0.31, 26), cream, 0, 0.83, 0);
    head.scale.set(1.03, 1.0, 0.96);
    add(body, sph(0.235, 24), clay(0xF9E1C2, { roughness: 0.88 }), 0, 0.83, 0.18).scale.set(1.06, 1.02, 0.44);
    dotEye(body, -0.09, 0.855, 0.36, 0.03);
    dotEye(body, 0.09, 0.855, 0.36, 0.03);
    smileArc(body, 0, 0.8, 0.4, 0.045, 0.011, 0x3A2C22, true);
    cheek(body, -0.155, 0.8, 0.35, 0.05, 0xF3B0AE);
    cheek(body, 0.155, 0.8, 0.35, 0.05, 0xF3B0AE);
    add(body, sph(0.07, 12), peak, 0, 1.12, -0.02, false).scale.set(1, 0.7, 1);
    const arms = [-1, 1].map(side => {
      const arm = new THREE.Group();
      arm.position.set(side * 0.34, 0.58, 0);
      const a = add(arm, new THREE.CapsuleGeometry(0.09, 0.2, 5, 12), cream, side * 0.04, -0.14, 0);
      a.rotation.z = side * 0.18;
      body.add(arm);
      return arm;
    });
    const legs = [-1, 1].map(side => {
      const leg = new THREE.Group();
      leg.position.set(side * 0.16, 0.26, 0);
      add(leg, new THREE.CapsuleGeometry(0.105, 0.1, 5, 12), cream, 0, -0.16, 0);
      return leg;
    });
    return { body, arms, legs, top: 1.3 };
  }

  function makeCat(cfg) {                       // 키링: 흰 고양이 (^ ^)
    const body = new THREE.Group();
    const cream = clay(cfg.color, { roughness: 0.92 });
    add(body, sph(0.4, 28), cream, 0, 0.44, 0).scale.set(1.06, 0.94, 0.86);
    const head = add(body, sph(0.36, 26), cream, 0, 0.68, 0);
    head.scale.set(1.08, 0.86, 0.88);
    // 뾰족 귀
    [-1, 1].forEach(side => {
      const ear = add(body, new THREE.ConeGeometry(0.135, 0.22, 22), cream, side * 0.235, 0.92, -0.02);
      ear.rotation.z = side * -0.16;
      add(body, sph(0.045, 12), cream, side * 0.27, 1.01, -0.02, false);
    });
    smileArc(body, -0.135, 0.62, 0.32, 0.058, 0.015, 0x2A2320, false);
    smileArc(body, 0.135, 0.62, 0.32, 0.058, 0.015, 0x2A2320, false);
    cheek(body, -0.215, 0.55, 0.27, 0.062, 0xF7B4C4);
    cheek(body, 0.215, 0.55, 0.27, 0.062, 0xF7B4C4);
    const arms = [-1, 1].map(side => {
      const arm = new THREE.Group();
      arm.position.set(side * 0.34, 0.46, 0.12);
      add(arm, sph(0.105, 16), cream, side * 0.03, -0.05, 0);
      body.add(arm);
      return arm;
    });
    const legs = [-1, 1].map(side => {
      const leg = new THREE.Group();
      leg.position.set(side * 0.16, 0.16, 0.08);
      add(leg, sph(0.11, 16), cream, 0, -0.04, 0);
      return leg;
    });
    return { body, arms, legs, top: 1.12 };
  }

  function makeClover(cfg) {                    // 초록·노랑·연분홍·진분홍: 4엽 피클
    const body = new THREE.Group();
    const m = clay(cfg.color, { roughness: 0.93 });
    const R = 0.215, D = 0.152, cy = 0.36;
    [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([sx, sy]) => {
      add(body, sph(R, 20), m, sx * D, cy + sy * D, 0).scale.set(1.02, 1.02, 0.8);
    });
    const eye = (x) => {
      const e = add(body, sph(0.045, 16), soft(0x1E1A18, { roughness: 0.34 }), x, cy + 0.015, 0.145, false);
      e.scale.set(0.92, 1.55, 0.55);
      add(body, sph(0.012, 8), soft(0xFFFFFF, { roughness: 0.3 }), x - 0.014, cy + 0.075, 0.185, false)
        .scale.set(1, 1, 0.5);
    };
    eye(-0.085); eye(0.085);
    return { body, arms: [], legs: [], top: 0.94 };
  }

  function makeSquircle(cfg) {                  // 하크: 검정 스퀘클 + 흰 부채꼴
    const body = new THREE.Group();
    const black = soft(cfg.color, { roughness: 0.88 });
    const s = roundShape([[-0.36, -0.36], [0.36, -0.36], [0.36, 0.36], [-0.36, 0.36]], 0.21);
    add(body, claySlab(s, 0.24, 0.07), black, 0, 0.46, 0);
    // 흰 부채(은행잎) 심볼
    const f = new THREE.Shape();
    f.moveTo(-0.21, -0.01);
    f.bezierCurveTo(-0.12, 0.10, -0.02, 0.16, 0.07, 0.17);
    f.bezierCurveTo(0.16, 0.18, 0.20, 0.10, 0.20, 0.01);
    f.bezierCurveTo(0.20, -0.09, 0.15, -0.16, 0.06, -0.18);
    f.bezierCurveTo(-0.04, -0.19, -0.15, -0.09, -0.21, -0.01);
    const fg = new THREE.ExtrudeGeometry(f, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 4, curveSegments: 20 });
    fg.center();
    const fan = add(body, fg, soft(0xFBFBF8, { roughness: 0.5 }), 0.01, 0.47, 0.14);
    fan.rotation.z = -0.08;
    return { body, arms: [], legs: [], top: 1.0 };
  }

  const BUILDERS = { tri: makeTri, disc: makeDisc, hippo: makeHippo, yeti: makeYeti, cat: makeCat, clover: makeClover, squircle: makeSquircle };

  function buildCharacter(cfg) {
    const root = new THREE.Group();
    const parts = BUILDERS[cfg.kind](cfg);
    const body = parts.body;
    root.add(body);
    if (parts.legs) parts.legs.forEach(l => root.add(l));
    root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    root.userData.name = cfg.name;
    return {
      root, body, arms: parts.arms || [], legs: parts.legs || [],
      head: body.children[0], torso: body.children[0],
      top: parts.top || 1.2, baseY: 0
    };
  }

  const walkers = PEOPLE.map((cfg, i) => {
    const built = buildCharacter(cfg);
    const startIdx = cfg.spots[0];
    const [sx, sz] = NODES[startIdx];
    built.root.position.set(sx, 0, sz);
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
    ring.position.set(w.root.position.x, 0.06, w.root.position.z);
    ring.visible = true;
    clearTimeout(focusOn.t);
    focusOn.t = setTimeout(() => { ring.visible = false; chips.forEach(c => c.classList.remove('on')); focusTarget = null; }, 4200);
  }
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.5, 0.72, 32),
    new THREE.MeshBasicMaterial({ color: 0xE6A0AA, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  scene.add(ring);

  /* ── 카메라 조작 ────────────────────────────────────────── */
  const cam = { az: 0.78, pol: 0.98, dist: 34, target: new THREE.Vector3(0.2, 1.15, -0.6), size: 8.2, zoom: 1 };
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
    if (focusTarget) { /* keep ring until timeout */ }
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
        if (n.isMesh && n.material && n.material.emissive) { n.userData.baseEmi = n.material.emissive.getHex(); n.material.emissive.setHex(0xFFD2A0); n.material.emissiveIntensity = 0.16; }
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
      const [x, z] = NODES[i];
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
        // 목표 방향으로 부드럽게 회전
        let d = w.yaw - w.root.rotation.y;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        w.root.rotation.y += d * Math.min(1, dt * 7);
        // 걷기 사이클
        w.phase += dt * 9.5;
        const s = Math.sin(w.phase);
        if (w.legs.length > 1) { w.legs[0].rotation.x = s * 0.55; w.legs[1].rotation.x = -s * 0.55; }
        if (w.arms.length > 1) { w.arms[0].rotation.x = -s * 0.45; w.arms[1].rotation.x = s * 0.45; }
        w.body.position.y = w.baseY + Math.abs(Math.cos(w.phase)) * 0.032;
        w.body.rotation.z = s * 0.035;
        if (k >= 1) nextSegment(w);
      }
      if (!w.busy) {
        // 서 있을 때: 호흡 + 가끔 두리번
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
      const wHalf = 30, hHalf = 9;
      const clash = kept.some(k => Math.abs(k.sx - w.sx) < wHalf + 26 && Math.abs(k.sy - w.sy) < hHalf * 2);
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

  // 시작
  applyCamera();
  resize();
  stage.classList.add('stage-3d');
  host.hidden = false;
  window.__office3dReady = true;
  window.__o3d = { scene, camera, cam, walkers, applyCamera, ring, renderer, THREE };  // 개발용 핸들
  requestAnimationFrame(frame);
})();
