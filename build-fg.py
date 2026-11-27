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
lap = Image.new('L', (W, H), 0)
d = ImageDraw.Draw(lap)
for box in [(596, 404, 745, 496), (668, 438, 802, 534), (754, 485, 880, 579), (846, 531, 970, 624),
            (176, 646, 320, 726), (1120, 742, 1226, 812)]:
    d.rectangle(box, fill=255)
lap_m = np.asarray(lap) > 0

mask |= lap_m

alpha = Image.fromarray((mask * 255).astype('uint8'), 'L')
alpha = alpha.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(1.3))
img = np.asarray(im).astype(np.uint8)
Image.fromarray(np.dstack([img, np.asarray(alpha)]), 'RGBA').save(OUT)
print('saved', OUT, int(mask.sum()))
