# 나은 비서실

나은님 전용 비서실 대시보드 (GitHub Pages 정적 페이지).

- `index.html` — 앱 본체 (단일 파일, 이미지 Base64 인라인 + three.js 모듈 인라인)
  - 오피스 맵: **3D 클레이 오피스**(three.js, CDN import) — 10명 캐릭터가 통로로 걸어 다니고,
    책상·테이블·소파·책장·화이트보드·창문을 눌러 요약 카드를 띄웁니다.
    WebGL/CDN 을 못 쓰는 환경에서는 2D 스프라이트 판(`build-walkers.py`)이 자동으로 남습니다.
  - 트래커: 체험단·설문·응모·상품권 집계와 노션 공용 허브 요약(맨 위 카드)
- `build-tracker.py` — 트래커 탭 HTML/CSS 생성 (노션 기록 → 수치)
- `build-walkers.py` — 2D 스프라이트 오피스(폴백) 마크업·CSS·JS 생성, 사물 카드 공유 로직
- `build-3d.py` — `assets/office3d.js` 를 index.html 안에 인라인 주입 (3D 씬 마크업·CSS 포함)
- `assets/office3d.js` — three.js 3D 오피스 씬 (방·가구·10명 캐릭터·이동·사물 클릭)
- `assets/office-room.jpg`, `sprites/*.png` — 2D 판 배경·캐릭터 원본
- `deploy.sh` — 커밋·푸시 후 Pages 반영 확인

빌드 순서: `python3 build-tracker.py` → `python3 build-walkers.py` → `python3 build-3d.py`

페이지는 `noindex` 이고 개인 식별 정보·계정 핸들은 넣지 않습니다.
