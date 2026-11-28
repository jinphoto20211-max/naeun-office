# 나은 비서실

나은님 전용 비서실 대시보드 (GitHub Pages 정적 페이지).

- `index.html` — 앱 본체 (단일 파일)
  - 오피스 맵: **16:9 움직이는 오피스 영상**(`assets/office-bg-v3.mp4`, 1280×720, 38초 루프) 위에
    열세 명의 투명 클릭 영역·말풍선만 얹는 구조. 좌표계는 영상 픽셀(`BASE_W`1280×`BASE_H`720)이고,
    케릭터를 누르면 팝업 없이 머리 위 말풍선으로 최근 단톡방 대화가 떠요. 1분 자동 말풍선·수다모드·
    확대/축소(`+`/`-`/`⤢`/핀치)는 그대로. 영상은 `muted playsinline autoplay loop` + `poster` 로
    모바일 자동재생을 보장하며, 첫 프레임 포스터가 `assets/office-bg-v3-poster.jpg` 입니다.
  - 트래커: 체험단·설문·응모·상품권 집계와 노션 공용 허브 요약(맨 위 카드)
  - 회의실: 오늘의 안건 + AI 단톡방(임베드/새 창) — 방 주인 비밀번호는 브라우저에만 저장
- `build-tracker.py` — 트래커 탭 HTML/CSS 생성 (노션 기록 → 수치)
- `build-walkers.py`, `build-clay.py`, `build-people.py` — 이전 2D/3D 실험용 생성기(지금 화면에는 미사용)
- `assets/office-bg-v3.mp4` — 지금 쓰는 오피스 배경 영상 (1280×720·38초·H.264 High yuv420p·faststart·약 2.2MB)
- `assets/office-bg-v3-poster.jpg` — 그 영상의 첫 프레임(로딩 중 빈 화면 방지)
- `assets/office-bg.jpg`, `assets/office-bg-v2.jpg` — 이전 정지 배경 (지금 화면에는 미사용)
- `assets/office-fg.png` — 전경 가구(책상·노트북·원탁·모니터) 레이어 — 캐릭터 위에 겹쳐 책상·노트북을 뚫고 나오지 않게 함 (`build-fg.py` 로 재생성)
- `assets/chars/*.png` — 11명 캐릭터 투명 스프라이트
- `deploy.sh` — 커밋·푸시 후 Pages 반영 확인

2.5D 스테이지의 마크업·CSS·JS는 `work` 스크립트로 주입된 상태이며, 좌표/말풍선 문구는
`index.html` 안의 `OFFICE25D-SCRIPT` 블록에서 바로 고칠 수 있습니다.

페이지는 `noindex` 이고 개인 식별 정보·계정 핸들은 넣지 않습니다.
