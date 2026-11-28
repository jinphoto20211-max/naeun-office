# 나은 비서실

나은님 전용 비서실 대시보드 (GitHub Pages 정적 페이지).

- `index.html` — 앱 본체 (단일 파일)
  - 오피스 맵: **16:9 움직이는 오피스 영상**(`assets/office-bg-v3.mp4`, 1280×720, 38초 루프) 위에
    열세 명의 투명 클릭 영역·말풍선만 얹는 구조. 좌표계는 영상 픽셀(`BASE_W`1280×`BASE_H`720)이고,
    케릭터를 누르면 팝업 없이 머리 위 말풍선으로 최근 단톡방 대화가 떠요. 1분 자동 말풍선·수다모드·
    확대/축소(`+`/`-`/`⤢`/핀치)는 그대로. 영상은 `muted playsinline autoplay loop` + `poster` 로
    모바일 자동재생을 보장하며, 첫 프레임 포스터가 `assets/office-bg-v3-poster.jpg` 입니다.
  - 상단 헤더: 시계 + 원터치 `[↻ 새로고침]`(모바일 캐시 우회) + 「오늘 생활·하진이 한 줄 브리핑」
  - 오피스 카드 아래: 「지금 내 손이 필요한 핵심 3건」 — [완료]·[패스]를 누르면 해피방 API
    (`POST /api/admin/rooms/happy/messages`, 토큰 `localStorage: naeun:agc-token:v1`)로 담당 비서에게
    지시를 보내고, 토큰이 없으면 지휘실 모달을 문구 프리필로 엽니다. 처리 상태는
    `localStorage: naeun-office:handoff:v1` 에만 저장되고 [되돌리기]가 됩니다.
  - 맨 아래(대회의실·단톡방 아래): 비서 접속 현황·오이 상태 줄과 「💬 지휘실에서 지시하기」 버튼
  - 트래커: 적립·포인트 / 복권·예치금 / 미션 보드 + 체험단·설문·응모·상품권 집계와 노션 공용 허브 요약
  - 회의실: 오늘의 안건 + AI 단톡방(임베드/새 창) — 방 주인 비밀번호는 브라우저에만 저장
- `build-tracker.py` — 트래커 탭 HTML/CSS 생성 (노션 기록 → 수치)
  - 트래커 맨 위 **적립·포인트 / 복권·예치금 / 당첨 후 미션** 보드는 이 파일의
    `MALL_STAMP_TOTAL`·`POINT_ITEMS`·`LOTTO_*`·`MISSIONS` 상수에서 만들어집니다.
  - 트래커 카드의 **[진행]·[패스]·[리마인드]** 버튼도 `acts()` 가 생성합니다.
  - `TRACKER-PANEL` 안에 `<script>window.TRACKER_DATA = {...}</script>` 를 함께 넣습니다.
    오피스 맵 상단 **두 칸 브리핑**(`#todayBriefBar` ← `TRACKER_DATA.brief`)과
    오피스 카드 아래 **핵심 3건 카드**(`#handCard` ← `TRACKER_DATA.handoff`)가 이 데이터를 읽습니다.
    → 브리핑·손필요 항목을 고칠 때는 `index.html`이 아니라 `build-tracker.py`의
      `BRIEF_LINES`(왼쪽 일정 칸, 한 줄에 하나) · `BRIEF_WEATHER_ICON`/`BRIEF_WEATHER_TEMP`/
      `BRIEF_WEATHER_TIP`(오른쪽 날씨 칸) · `HANDOFF` 를 고치고 다시 실행하세요.
      (Apple Weather 출처 표기는 글자로 붙입니다 — `&#xF8FF;` 는 안드로이드에서 깨져 쓰지 않습니다.)
  - 실행은 `python3 build-tracker.py` (마커 사이만 교체, 나머지 화면은 건드리지 않음)
- `build-walkers.py`, `build-clay.py`, `build-people.py` — 이전 2D/3D 실험용 생성기(지금 화면에는 미사용)
- `assets/office-bg-v3.mp4` — 지금 쓰는 오피스 배경 영상 (1280×720·38초·H.264 High yuv420p·faststart·약 2.2MB)
- `assets/office-bg-v3-poster.jpg` — 그 영상의 첫 프레임(로딩 중 빈 화면 방지)
- `assets/office-bg.jpg`, `assets/office-bg-v2.jpg` — 이전 정지 배경 (지금 화면에는 미사용)
- `assets/office-fg.png` — 전경 가구(책상·노트북·원탁·모니터) 레이어 — 캐릭터 위에 겹쳐 책상·노트북을 뚫고 나오지 않게 함 (`build-fg.py` 로 재생성)
- `assets/chars/*.png` — 11명 캐릭터 투명 스프라이트
- **앱 아이콘(분홍 클레이 매듭)** — `build-icon.py` 가 원본 JPG 한 장에서 흰 여백을 걷어내고 다시 만듭니다.
  - `assets/app-icon.png`(512, 모서리 투명) · `assets/icon-192.png` · `assets/brand-mark.png`(168 = 헤더 56px의 3배)
  - `assets/favicon.png`(64) · `assets/apple-touch-icon.png`(180, 홈 화면용이라 모서리까지 분홍) ·
    `assets/icon-512-maskable.png`(512, maskable용 full-bleed)
  - 헤더 왼쪽 로고는 `index.html` 의 `<img class="brand-mark">`, 파비콘·홈 화면 아이콘은 `<head>` 링크와
    `manifest.webmanifest` 가 `?v=20261128i` 로 캐시를 끊어 참조합니다. 아이콘을 바꿀 때는
    `python3 build-icon.py <원본.jpg>` 실행 후 `?v=` 값만 올리면 됩니다(루트 `icon-192.png`·`icon-512.png`·
    `apple-touch-icon.png`·`favicon.png` 는 예전 경로 호환용으로 같이 갱신됩니다).
- `deploy.sh` — 커밋·푸시 후 Pages 반영 확인

2.5D 스테이지의 마크업·CSS·JS는 `work` 스크립트로 주입된 상태이며, 좌표/말풍선 문구는
`index.html` 안의 `OFFICE25D-SCRIPT` 블록에서 바로 고칠 수 있습니다.

페이지는 `noindex` 이고 개인 식별 정보·계정 핸들은 넣지 않습니다.
