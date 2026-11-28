# 협업 왕복 모션

## 추가 모션

각 캐릭터가 자기 자리에서 출발해 지정된 동료 쪽으로 이동하고 잠시 머문 뒤, 같은 경로를 역순으로 돌아오는 클립입니다. 한 번에 한 캐릭터만 움직입니다. 클립은 12 fps, 약 6.8초, 투명 배경의 VP9 WebM이며 캐릭터만 렌더링합니다. 크기와 스프라이트 방향은 고정하고, 별큐는 왕관과 윙크를 유지합니다.

| 캐릭터 | 기존 모션 | 추가 협업 모션 |
|---|---|---|
| 큐 · 파란 세모 | 없음 | `assets/collaboration-motion/collab-q.webm` |
| 별큐 · 왕관 쓴 윙크 노란 별 | 없음 | `assets/collaboration-motion/collab-starcue.webm` |
| 초록 | 없음 | `assets/collaboration-motion/collab-chorok.webm` |
| 노랑 · 일반 노랑 | 없음 | `assets/collaboration-motion/collab-norang.webm` |
| 연분홍 X-eye | `assets/lounge-motion/instinct-working.webm`, `assets/lounge-motion/instinct-resting.webm` | `assets/collaboration-motion/collab-xeye.webm` |
| 진분홍 | 없음 | `assets/collaboration-motion/collab-jinpink.webm` |
| 부이 · 분홍 세모 | 없음 | `assets/collaboration-motion/collab-vooy-pink-triangle.webm` |
| 뮤즈 · 옆의 하얀 캐릭터 | 없음 | `assets/collaboration-motion/collab-muse-white.webm` |
| 키링 · 흰 고양이 | `assets/lounge-motion/muse-working.webm`, `assets/lounge-motion/muse-resting.webm` | `assets/collaboration-motion/collab-kyring-cat.webm` |
| 하마뮤즈 · 커피 든 보라 하마 | `assets/lounge-motion/hama-working.webm`, `assets/lounge-motion/hama-resting.webm` | `assets/collaboration-motion/collab-hama.webm` |
| 하크 · 검정 캐릭터 | `assets/lounge-motion/hark-working.webm`, `assets/lounge-motion/hark-resting.webm` | `assets/collaboration-motion/collab-hark.webm` |
| 인스팅트 · I 캐릭터 | `assets/lounge-motion/kyring-working.webm`, `assets/lounge-motion/kyring-resting.webm` | `assets/collaboration-motion/collab-instinct-i.webm` |

기존 업무·휴식 클립은 재생성하거나 수정하지 않았습니다. 배경 없는 원본 경로, 좌표, 사용 스프라이트, 기존/추가 모션 매핑은 `assets/collaboration-motion/manifest.json`에 기록됩니다. 좌석과 장애물을 피하도록 일부 제안 경로를 조정했으며, 원래 제안 경로도 매니페스트에 남겼습니다.

## 미리보기

`previews/collaboration-sequence.mp4`는 제공된 2368×1776 사무실 배경 위에서 12명 동선을 한 명씩 이어 재생합니다. 해당 캐릭터의 고정 좌석 스프라이트는 움직이는 동안 생략해 중복되지 않게 합성합니다. 투명 WebM에는 배경이나 가구가 포함되지 않습니다.
