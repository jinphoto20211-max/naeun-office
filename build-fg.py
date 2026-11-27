"""office-fg.png — 캐릭터 위에 겹칠 '앞쪽 가구'만 떼어낸다.

전경 레이어는 배경 사진의 같은 픽셀을 그대로 복사한 것이라,
캐릭터가 없는 곳을 덮어도 화면은 똑같다. 그래서 여기서 중요한 것은
'어떤 캐릭터의 어디까지를 가릴지' = 덮는 영역의 경계선이다.

- 롱데스크: 책상 상판 + 노트북 4대 (뒤에 앉은 4인은 상판 뒤 가장자리에서 잘림)
- 왼쪽 책상: 상판 뒤 가장자리 선(아이소메트릭 기울기) 아래 + 노트북
  · 예전에는 flood fill 이 의자 등받이까지 번지고 사각형이 노트북 위쪽을 덮어
    큐의 몸통을 가렸다 → 선 아래로 자르는 방식으로 바꿈
- 오른쪽 책상: 모니터만 (부이는 의자에 앉아 책상 앞쪽 → 모서리까지 덮으면 몸통이 잘린다)
  · 예전 사각형(1124,740)-(1224,812)이 의자 등받이를 덮어 부이 얼굴・몸통을 가렸다 → 삭제
"""
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SRC = '/workspace/github/naeun-office/assets/office-bg.jpg'
OUT = '/workspace/github/naeun-office/assets/office-fg.png'

im = Image.open(SRC).convert('RGB')
W, H = im.size


def flood(seed, thresh, box):
    c = im.copy()
    ImageDraw.floodfill(c, seed, (255, 0, 255), thresh=thresh)
    a = np.asarray(c)
    m = (a[:, :, 0] > 250) & (a[:, :, 1] < 10) & (a[:, :, 2] > 250)
    x0, y0, x1, y1 = box
    keep = np.zeros_like(m)
    keep[y0:y1, x0:x1] = True
    return m & keep


mask = np.zeros((H, W), dtype=bool)

# ── 긴 책상(피클즈 4인 자리) 상판 ─────────────────────────────
mask |= flood((700, 470), 38, (595, 400, 1050, 620))

# ── 왼쪽 책상(큐) — 상판 뒤 가장자리 선 아래만 ────────────────
# 선: (210, 698) 을 지나고 아이소메트릭 기울기 0.37
SLOPE = 0.37
yy = np.arange(H)[:, None]
xx = np.arange(W)[None, :]
left_edge = 698 + (xx - 210) * SLOPE
left_zone = (xx >= 40) & (xx <= 340) & (yy >= left_edge) & (yy <= 800)
mask |= left_zone

# ── 노트북 4대(긴 책상) — 덮개 기울기를 따라 비스듬히 ─────────
lap = Image.new('L', (W, H), 0)
d = ImageDraw.Draw(lap)


def lid(x0, y0, w=64, h=96, slope=0.42):
    d.polygon([(x0, y0), (x0 + w, y0 + w * slope),
               (x0 + w, y0 + w * slope + h), (x0, y0 + h)], fill=255)


lid(596, 402)
lid(668, 438)
lid(750, 486)
lid(844, 531)

# ── 왼쪽 책상 노트북(큐 앞) — 실제 노트북 네 꼭짓점 ────────────
d.polygon([(188, 686), (308, 672), (324, 728), (204, 746)], fill=255)

# ── 가운데 원탁 — 테이블 아래쪽(다리·그림자)만 ─────────────────
mask |= flood((600, 780), 34, (405, 715, 790, 860))

# ── 오른쪽 책상(부이) — 모니터만 ─────────────────────────────
# 부이는 의자에 앉아 책상 앞쪽에 있으므로 책상 모서리를 전경에 넣으면 몸통이 잘린다.
# (예전 사각형이 의자 등받이를 덮어 얼굴 절반이 가려졌던 원인)
d.rectangle((925, 680, 1065, 805), fill=255)     # 모니터·스탠드

mask |= np.asarray(lap) > 0

alpha = Image.fromarray((mask * 255).astype('uint8'), 'L')
alpha = alpha.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(1.3))
img = np.asarray(im).astype(np.uint8)
rgb = img.copy()
rgb[np.asarray(alpha) == 0] = 0      # 투명 영역 RGB 를 0으로 → PNG 20배 이상 작아짐(화면 동일)
Image.fromarray(np.dstack([rgb, np.asarray(alpha)]), 'RGBA').save(OUT, optimize=True)
print('saved', OUT, int(mask.sum()))
