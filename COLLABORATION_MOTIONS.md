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

기존 업무·휴식 클립은 재생성하거나 수정하지 않았습니다. 배경 없는 원본 경로, 좌표, 사용 스프라이트, 기존/추가 모션 매핑은 `assets/collaboration-motion/manifest.json`에 기록됩니다. 12개 경로를 배경에 겹쳐 확인하고, 책상·회의 테이블·카운터·좌석을 가로지르는 것으로 보인 일부 경유점을 열린 바닥 쪽으로 조정했습니다. 시작 좌석에서 나오는 첫 구간과 지정된 도착점에 접근하는 마지막 구간은 원래 위치가 가구와 가까워 짧은 예외가 있을 수 있으며, 이전 제안 경로도 매니페스트에 남겼습니다.

## 원본 위치 보정

사용자가 제공한 원본 장면(36155.png)과 캐릭터 없는 배경을 대조해 12명의 시작·복귀 좌석 중심을 다시 맞췄습니다. 캐릭터-스프라이트 매핑과 좌석·도착점은 유지하고, 가구를 피해 갈 수 있도록 일부 경유점만 다시 배치했습니다.
별큐는 36227.jpg 참고의 앉은 스프라이트를 시작·복귀 정지 구간에, 36228.jpg 참고의 걷는 스프라이트를 이동 구간에 사용합니다. 두 자세 모두 왕관과 윙크를 유지하며, 별도 투명 캐릭터 컷아웃으로 렌더링합니다.

## 미리보기

`previews/collaboration-sequence.mp4`는 제공된 2368×1776 사무실 배경 위에서 12명 동선을 한 명씩 이어 재생합니다. 해당 캐릭터의 고정 좌석 스프라이트는 움직이는 동안 생략해 중복되지 않게 합성합니다. 투명 WebM에는 배경이나 가구가 포함되지 않습니다.
