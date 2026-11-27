"""office-fg.png — 캐릭터 위에 겹칠 전경 가구(책상 표면 + 노트북)만 떼어낸다.

배경 사진에서 책상 표면은 flood fill 로 따고(가구 경계에서 멈춤),
책상 위 노트북은 화면에서 읽은 사각형으로 더한다.
마지막에 살짝 번지게 해서 캐릭터 하단이 부드럽게 가려지도록.
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
# 긴 책상(노트북 4대 놓인 상판)
mask |= flood((700, 470), 38, (595, 400, 1050, 620))
# 왼쪽 책상
mask |= flood((200, 715), 34, (40, 640, 330, 790))
# 가운데 원탁
mask |= flood((600, 780), 34, (405, 715, 790, 860))
# 오른쪽 책상(모니터 자리)
mask |= flood((1190, 860), 34, (1050, 700, 1254, 900))

# 노트북 (책상 뒤 좌석 캐릭터를 가리도록 상판 위쪽까지)
# — 컷 선이 수평으로 보이지 않게 노트북 덮개의 기울기(아이소메트릭)를 따라 사각형을 비스듬히 그린다.
lap = Image.new('L', (W, H), 0)
d = ImageDraw.Draw(lap)
SLOPE = 0.42  # 긴 책상 쪽 덮개 윗면 기울기
def lid(x0, y0, w=64, h=96, slope=SLOPE):
    d.polygon([(x0, y0), (x0 + w, y0 + w * slope), (x0 + w, y0 + w * slope + h), (x0, y0 + h)], fill=255)

lid(596, 402)
lid(668, 438)
lid(750, 486)
lid(844, 531)
# 옆 책상 노트북(반대 기울기)
d.rectangle((212, 644, 318, 724), fill=255)
d.rectangle((1124, 740, 1224, 812), fill=255)
lap_m = np.asarray(lap) > 0

mask |= lap_m

alpha = Image.fromarray((mask * 255).astype('uint8'), 'L')
alpha = alpha.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(1.3))
img = np.asarray(im).astype(np.uint8)
Image.fromarray(np.dstack([img, np.asarray(alpha)]), 'RGBA').save(OUT)
print('saved', OUT, int(mask.sum()))
