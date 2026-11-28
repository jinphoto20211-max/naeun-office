#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""나은 비서실 — '트래커' 탭 생성기.

노션 🎁 체험단·리뷰 현황 / 📝 설문·응모·출첵·로또 현황 / 🚧 미결 건,
그리고 memory/topics/shopping-review-campaigns/docs/current-status.md 의
기록만으로 수치를 계산한다. 추정값은 넣지 않는다.

실행: python3 work/naeun-office/build-tracker.py [index.html ...]
  - 마커(<!-- TRACKER-PANEL:START --> … END) 사이를 새 내용으로 교체
  - 마커가 없으면 탭·패널·CSS·JS를 한 번 삽입
"""

import sys, io, os
from datetime import datetime, timedelta, timezone

BASE = os.path.dirname(os.path.abspath(__file__))
KST = timezone(timedelta(hours=9))

STAMP = "2026-11-28(토) 09:00"
NOTION_SYNC = "11/28 08:30"
MIGYEOL_SYNC = "11/27 11:37"

# ── 1. 누적 응모 (기록이 남아 있는 날짜만) ─────────────────────────────
# 체험단: current-status.md '접수 이력' + 노션 11/26·11/27 절 (카톡 선물하기 포함)
EVENT_SUBMITS = {
    "11/12": 14, "11/13": 2, "11/14": 5, "11/15": 6, "11/16": 4,
    "11/17": 4, "11/18": 13, "11/19": 13, "11/20": 17, "11/21": 9,
    "11/22": 8, "11/23": 4, "11/24": 18, "11/25": 8, "11/26": 8, "11/27": 14,
    "11/28": 6,
}
# 설문·응모·핫딜헌터 완료: 📝 설문·응모·출첵·로또 현황의 일자별 '완료' 집계
SURVEY_DONE = {
    "11/15": 7, "11/16": 1, "11/17": 3, "11/18": 1, "11/19": 6,
    "11/20": 5, "11/21": 0, "11/22": 4, "11/23": 6, "11/24": 20,
    "11/25": 16, "11/26": 9, "11/27": 8,
}
event_total = sum(EVENT_SUBMITS.values())
survey_total = sum(SURVEY_DONE.values())
cum_total = event_total + survey_total

# ── 2. 결과가 확정된 건 (노션 발표 대기 명단의 확정 표기) ──────────────
MISSES = 28          # 미당첨·미선정 확정 표기된 상품 단위
WINS_N = 8
decided = WINS_N + MISSES
win_rate = WINS_N / decided * 100

# ── 3. 당첨 확정 ─────────────────────────────────────────────────────
WINS = [
    ("설문", "[서울신문광고대상] 소이프스튜디오 하이드라 선 세럼",
     "11/28 08:17 문자 당첨 안내 · 수령지 입력 폼 마감 12/02 18:00", "D-4", "warn"),
    ("맘홀", "[라쉼] 아토리피드 배리어 장벽 크림",
     "11/23 발표 · 11/25 수령 · 카페 700자+사진 / 블로그 6장+ / 인스타 태그 + 구글폼", "후기 D-10", "warn"),
    ("네이버", "[제이엠솔루션] 고순도 앰플 마스크 4종",
     "11/20 발표 · 0원 주문 → 11/25 포토리뷰 377자·6장 + 블로그 + 이벤트 댓글까지 종결", "완결", "done"),
    ("네이버", "[제이엠솔루션] 매일 쓰는 저자극 스피큘 세럼",
     "11/06 발표 · 11/10 배송완료 → 구매확정 · 후기 5점 등록", "완결", "done"),
    ("쿠팡", "[키즈꼬모] 아동용 기모 바이크 상하의 세트",
     "11/17 체험단 선정 · 11/23 리뷰 등록(나은님 직접) · 마감 11/30", "완결", "done"),
    ("핫딜", "[KINSE] 워터 보틀 500mL",
     "11/17 챌린지 신청 · 11/19 배송 수령 · 3일 인증은 선택", "수령", "done"),
    ("설문", "금천G밸리상품권 5,000원",
     "11/24 금천구시설관리공단 수요조사 · 성함 풀네임 정정 완료 · 서울Pay+ 등록 12/24까지", "등록 대기", "wait"),
    ("설문", "CU 모바일상품권 5,000원",
     "11/25 대구광역시감염병관리지원단 · 사용 기한 12/25까지", "사용 전", "wait"),
]

# ── 4. 발표 대기 (날짜가 확정된 건) ───────────────────────────────────
PENDING = [
    ("11/30 (월)", "D-2", [
        ("카톡", "호빵맨 셰프 주방놀이", "11/22 접수 · 후기 12/18"),
        ("카톡", "팩토리노멀 호텔로비 향 멀티 스프레이", "11/22 접수 · 후기 12/16"),
        ("카톡", "하림 냄비요리 6종 2팩", "11/22 접수 · 후기 12/17"),
        ("맘홀", "브라운 프리미엄 엣지 카키 아기물티슈", "11/25 접수"),
        ("디너", "미카엘돈가스 치즈돈까스", "11/27 접수"),
    ]),
    ("12/01 (화)", "D-3", [
        ("카톡", "농협안심한우 1등급 소한마리알찬세트 1.35kg", "11/28 접수"),
        ("카톡", "비포문라이즈 소프트 퍼 패딩 바라클라바 (OFFWHITE)", "11/22 접수 · 후기 12/16"),
        ("카톡", "오셀픽 키즈 극세사 로브 (클래식 스트라이프 레드 / 140)", "11/27 접수 · 나은님 유지 확정"),
        ("카톡", "온브릭스 제주만감 황금향 3kg", "11/27 접수"),
        ("카톡", "호빵맨 런치 박스 세트", "11/27 접수"),
        ("디너", "월향농원 부사 사과 5kg", "11/27 접수"),
    ]),
    ("12/02 (수)", "D-4", [
        ("네이버", "닥터펩티 징크 펩타이드 수딩 배리어 세럼", "11/18 접수 · 11:00"),
        ("네이버", "닥터펩티 비타 펩타이드 글로우 토닝 세럼", "11/18 접수 · 11:00"),
        ("디너", "힘찬한우 정육점 8차", "11/26 접수"),
        ("디너", "능이와백숙 대구월성점", "11/26 접수"),
        ("디너", "교훈마켓 금씨네 청도미나리", "11/26 접수"),
        ("리뷰플", "PDRN 콜라겐 마스크팩 1BOX", "11/26 접수"),
        ("맘홀", "프랭클린&바를 겨울 준비템", "11/25 접수"),
        ("맘홀", "브이텍 크리스마스 국민장난감", "11/24 접수"),
        ("카톡", "얼라인랩 빵고미 손난로 보조배터리 5,200mAh", "11/25 접수"),
        ("카톡", "포미니 미피 듀얼 분사 무드등 가습기 (미피 옐로우)", "11/27 접수"),
        ("카톡", "밤부베베 행복한 말랑이 손수건 세트", "11/27 접수"),
        ("레뷰", "쿠키마리 케이크샵 황금역점 딸기케이크 1호", "11/27 접수 · 12/4 11~17시 수령 고정"),
    ]),
    ("12/03 (수)", "D-5", [
        ("카톡", "투쿨포스쿨 무드 스위치 팔레트 (03 허그 모브+브러쉬)", "11/26 접수"),
        ("카톡", "낫이븐모어 볼캡·버킷햇 (02 포인트 라인 볼캡)", "11/26 접수"),
        ("네이버", "후르디아 레티날 360도 볼륨샷 텐션 마스크", "11/23 접수 · 09:00"),
        ("레뷰", "그릇빡스 10만원 상당 제품", "11/27 접수 · 평일 10:00~19:00"),
        ("레뷰", "베라펙트 청보리 라하 젤클렌저", "11/27 접수 · 세안 전후 컷 + 원본 전달"),
        ("카톡", "수플린 대왕딸기 킹스베리 400g+", "11/27 접수"),
        ("카톡", "수플린 금실 딸기 400G 이상", "11/28 접수"),
        ("카톡", "테리파머 멜로우 호텔수건 5장 선물세트", "11/28 접수 · 10장 옵션 품절"),
    ]),
    ("12/04 (금)", "D-6", [
        ("맘홀", "아토팜 MLE 로션", "11/25 접수"),
        ("카톡", "바스 국민 고체 탈취제 옐로우 세트", "11/25 접수"),
        ("카톡", "코스알엑스 스킨 베리어 대용량 바디크림 450ml", "11/25 접수"),
        ("카톡", "명한우 1++ 일편 등심 400g", "11/25 접수"),
        ("레뷰", "베테랑 칼국수 밀키트 4개입", "11/27 접수"),
        ("리뷰플", "뿌리또 타월", "11/27 접수 · 욕실 사용샷 필수"),
        ("카톡", "오셀픽X브레드이발소 키즈 파자마 (깅엄 체크 레드 / 110)", "11/28 접수"),
    ]),
    ("12/07 (월)", "D-9", [
        ("카톡", "김정문알로에 피토그린 세럼 마스크팩 10매", "11/26 접수"),
        ("카톡", "당도엄선 제주 감귤 프리미엄 선물세트 4.5kg", "11/28 접수"),
        ("카톡", "라네즈 NEW 크림 스킨 미스트 80ml (+100ml)", "11/28 접수"),
        ("리뷰플", "호헴 짐벌 셀카봉", "11/27 접수"),
    ]),
]
pending_total = sum(len(g[2]) for g in PENDING)
next_week = sum(len(g[2]) for g in PENDING if "11/30" <= g[0][:5] <= "12/06")
this_week = sum(len(g[2]) for g in PENDING if "11/23" <= g[0][:5] <= "11/29")
today_total = 0        # 11/28(토) 발표일이 확정된 체험단 없음
today_survey = 0
next_announce_date = PENDING[0][0][:5]
next_announce_n = len(PENDING[0][2])
today_all = today_total

# ── 5. 결과 미확인 (발표일이 지났거나 공지 대기) ──────────────────────
UNKNOWN = [
    ("카톡", "11/27 발표 2건", "이세비 에어리 페이스 드링크 · 립프로그 트윙클 러닝 피아노 — 결과 확인 전", 2),
    ("리뷰플", "11/27 발표 3건", "little life 웨이브 피아노 · 천하제일 마사지 60분 · 글램팜 헤어 미스트", 3),
    ("디너", "11/27 발표 1건", "온통114 해남 호박고구마 5kg / 순창 통두부", 1),
    ("네이버", "11/27 발표 1건", "앰플엔 에어핏 비비 크림 결광비비", 1),
    ("설문", "11/27 발표 2건", "나의 최애 숲(안동 하회마을) · 자이 아르무제자이 NEO 영상 공유", 2),
    ("카톡", "뮤즈 신청 11건", "11/20 5건 · 11/21 6건 · 발표일 캠페인 공지 예정", 11),
    ("카톡", "직접 신청 16건", "11/20 3건 · 11/23 6건 · 11/24 5건 · 11/25 2건", 16),
    ("리뷰플", "5건", "11/24 쎄씨·쉐푸드 · 11/25 물티슈 파우치·아이앤유 식판·조이제이 공기청정기", 5),
    ("디너", "3건", "11/18 영주호수목장 · 11/19 힘찬한우 2만원권 · 11/24 오마이베이커리", 3),
    ("네이버", "2건", "11/25 뷰티시스 레티놀·프로틴 앰플 2종", 2),
]
unknown_total = sum(u[3] for u in UNKNOWN)

# ── 6. 남은 큐 ────────────────────────────────────────────────────────
QUEUE = [
    ("쿠팡", "동원 퀴진 미니핫도그 450g 2개", "5점 초안 전달 완료 · 등록은 나은님 직접", "등록 대기", "wait"),
    ("쿠팡", "한끼통살 곤약 현미 볶음밥 5개", "5점 초안 전달 완료 · 등록은 나은님 직접", "등록 대기", "wait"),
    ("맘홀", "라쉼 후기 3채널 + 구글폼 제출", "12/8 마감 · 인스타 재업로드 완료(11/28) · 카페·블로그 등록과 구글폼 제출 남음", "D-10", "warn"),
    ("챌린저스", "차앤박 더마앤서 액티브 부스트 앰플 30ml", "11/28 22:00~24:00 올리브영 배송 구매 · 당일 23:59 1·2차 인증", "오늘 22시", "today"),
    ("미결", "피클(노랑) 10건", "서울온 · 한국무역협회 · 마이리얼트립 · 국민연금 · 밀양시 · 엠브레인 · 서울아리수 · 성평등가족부 · 삼성증권 · 일제강제동원", "10건", "wait"),
    ("미결", "하마뮤즈 4건", "국토안전관리원 일산 · 템빨 룰렛 · 몽실몽실 캘린더 · KOSIS · 잡아바(항목 기준 4건)", "4건", "wait"),
]
queue_review = 4
queue_open = 14
queue_total = queue_review + queue_open

# ── 7. 노션 공용 허브 요약 (미결 건 · 증시 · 유가 · 담당별) ───────────
HUB_MIGYEOL = [
    ("서울온 만족도", "서울특별시 서울온 만족도 조사", "엠보팅 18문항 완료 → 제출 때 SMS 인증번호 필요", "~12/7", "wait"),
    ("한국무역협회", "수출 퀴즈", "개인 SNS 공유 + 계정 아이디 노출 캡처 필수", "~12/3", "wait"),
    ("마이리얼트립", "서호주 퍼스 2인", "카카오 로그인 후 실명인증", "~11/30", "warn"),
    ("국민연금공단", "블루투스 이어폰 만족도 조사", "응답자 이름란 PASS 인증 전용", "~12/7", "wait"),
    ("밀양시", "퀴즈·설문 이벤트", "실명·아이핀 인증 필요", "~11/27", "warn"),
    ("엠브레인", "패널파워 3일 주기 점검", "로그인 보안문자 대기 · 11/26 회차 미접속", "점검", "wait"),
    ("서울아리수", "AI 숏폼 투표", "제출 때 02-120 SMS 인증", "~11/29", "warn"),
    ("성평등가족부", "청소년 아르바이트 퀴즈", "자동입력방지 문자(CAPTCHA)", "~11/30", "wait"),
    ("삼성증권", "채권 라이브 퀴즈", "11/27 16~17시 라이브 시청 후 O/X 제출", "지남", "warn"),
    ("일제강제동원", "SNS 팔로우 이벤트", "인스타 완료 · 쓰레드 팔로우 인증 필요", "~11/27", "warn"),
    ("국토안전관리원", "모두의 광장 일산 2건", "간편인증 로그인 후 진행", "~12/4", "wait"),
    ("템빨", "오버기어드 룰렛", "카톡 앱 전용 · 이용권 1장 보유", "상시", "wait"),
    ("몽실몽실", "먼치킨 꽁이 2027 캘린더", "유튜브 앱 로그인 오류로 진행 불가", "마감 지남", "wait"),
    ("KOSIS·잡아바", "통계 퀴즈 / 일자리 퀴즈", "캡차·통합회원 로그인 직접 필요", "11/27·11/29", "wait"),
]
# ── 영상 주간 한도 초기화 (노션 「큐 그룹」 2026-11-28 12:02 KST 기준) ────
# 큐: 2026-12-09(수) 20:22 / 별큐: 2026-12-28(월) 09:20 (Asia/Seoul)
VIDEO_RESET_SRC = "노션 큐 그룹 · 11/28 12:02 기준"
VIDEO_RESETS = [
    ("큐", "12/09(수)", "20:22", "2026-12-09T20:22:00+09:00"),
    ("별큐", "12/28(월)", "09:20", "2026-12-28T09:20:00+09:00"),
]


def dday(iso):
    """한국 시간 달력 날짜 기준 남은 일수 (빌드 시점 고정값, 화면에서는 JS가 갱신)"""
    target = datetime.fromisoformat(iso).astimezone(KST).date()
    left = (target - datetime.now(KST).date()).days
    if left > 0:
        return "D-%d" % left
    return "오늘" if left == 0 else "지남"


HUB = {
    "market_title": "탈출 3단계 · 회복 0단계",
    "market_body": "미국 11/25 S&P500 7,182.78로 낙폭을 줄였지만 하이일드·변동성·추세 경계가 이어집니다. "
                   "11/26 추수감사절 휴장으로 11/27 판정은 건너뛰고 마지막 판정(11/25 기준)을 유지합니다.",
    "fuel_big": "1,775원",
    "fuel_small": "최저 · 논공농협",
    "fuel_body": "대구 평균 1,813원 · 옥포농협클린 1,784원 · 화원농협 1,790원 · 대곡알뜰 1,775원(달서 참고)",
    "teams": [
        ("⚡ 인스팅트", [
            "07:00 체험단 5대 플랫폼 수집 → ⚡수집 판 게시",
            "11·12·14시 핫딜헌터 (11/26 630건 · 신규 90)",
            "08:30 오피넷 유가 · 목요일 공공 퀴즈 수집",
        ]),
        ("🦛 하마뮤즈", [
            "AGE-R 2시간마다 우유·쿠키 · 15초 카톡 감지",
            "휴대폰 조작 필요 경품 응모 진행 (11/18분 ~60건)",
            "노랑이 넘긴 건(템빨·몽실몽실) 앱 전용 작업",
        ]),
        ("🎧 뮤즈", [
            "10:00 AI 트렌드 브리핑 (365일 루틴)",
            "5분마다 해피방 새 메시지 확인·답장",
            "08:00 경품 확인·응모 · 일 09:09·15:09 판 확인",
        ]),
    ],
}

# ── HTML ─────────────────────────────────────────────────────────────
PF_CLASS = {"카톡": "kakao", "레뷰": "revu", "디너": "dinner", "리뷰플": "rp",
            "맘홀": "mom", "네이버": "naver", "쿠팡": "coupang", "핫딜": "hot",
            "설문": "survey", "챌린저스": "challenge", "미결": "hold"}


def pf(label):
    return '<span class="trk-pf %s">%s</span>' % (PF_CLASS.get(label, ""), label)


def row(label, title, meta, badge=None, kind="", today=False):
    b = ""
    if badge:
        b = '<span class="trk-d %s%s">%s</span>' % (kind, " today" if today else "", badge)
    return ('<li class="trk-row">%s<span class="trk-body"><span class="trk-t">%s</span>'
            '<span class="trk-m">%s</span></span>%s</li>' % (pf(label), title, meta, b))


def hub_html():
    o = ['<div class="card hub-card">']
    o.append('<div class="hub-top"><h3>노션 공용 허브 한눈에</h3>'
             '<span>미결 건 · 증시 · 유가 · 영상 한도 · 담당별 요약 · 노션 동기화 %s</span></div>' % NOTION_SYNC)
    o.append('<div class="hub-grid">')
    o.append('<div class="hub-box"><div class="hub-label">📊 증시 장세 판정 · 11/25 기준</div>'
             '<div class="hub-big">%s</div><p class="hub-p">%s</p></div>' % (HUB["market_title"], HUB["market_body"]))
    o.append('<div class="hub-box"><div class="hub-label">⛽ 오피넷 유가 비교 · 11/27 08:30</div>'
             '<div class="hub-big">%s <small>%s</small></div><p class="hub-p">%s</p></div>'
             % (HUB["fuel_big"], HUB["fuel_small"], HUB["fuel_body"]))
    # 영상 주간 한도 초기화 — 증시·유가 바로 아래 전체 너비 1칸
    o.append('<div class="hub-box hub-wide"><div class="hub-label">🎬 영상 주간 한도 초기화 '
             '<small>%s</small></div><div class="hub-reset">' % VIDEO_RESET_SRC)
    for name, date, tm, iso in VIDEO_RESETS:
        o.append('<div class="hub-reset-i"><span class="hub-reset-k">%s</span>'
                 '<span class="hub-reset-v">%s <b>%s</b></span>'
                 '<span class="hub-reset-d" data-reset="%s">%s</span></div>'
                 % (name, date, tm, iso, dday(iso)))
    o.append('</div></div>')
    o.append('</div>')

    o.append('<div class="hub-sub">🚧 미결 건 <span class="n">%d건</span><em>피클 · 노랑 10 · 하마뮤즈 4</em></div>'
             % len(HUB_MIGYEOL))
    o.append('<ul class="hub-list">')
    for who, title, why, due, kind in HUB_MIGYEOL:
        o.append('<li class="hub-row"><span class="hub-who">%s</span>'
                 '<span class="hub-body"><b>%s</b><i>%s</i></span>'
                 '<span class="trk-d %s">%s</span></li>' % (who, title, why, kind, due))
    o.append('</ul>')

    o.append('<div class="hub-sub">담당별 지금 하는 일</div>')
    o.append('<div class="hub-grid three">')
    for name, lines in HUB["teams"]:
        o.append('<div class="hub-box"><div class="hub-label">%s</div><ul class="hub-ul">%s</ul></div>'
                 % (name, "".join("<li>%s</li>" % l for l in lines)))
    o.append('</div>')
    o.append('<p class="hub-foot">노션 공용 허브의 🚧 미결 건 · 📊 증시 장세 판정 · ⛽ 오피넷 유가 비교 · '
             '🎬 영상 주간 한도 초기화 · 담당별 챙기는 일 페이지에서 옮겨 적은 요약입니다. '
             '상세 기록은 노션에서 확인합니다.</p>')
    o.append('</div>')
    o.append(DDAY_JS)
    return "\n".join(o)


def sections():
    out = []

    # 노션 공용 허브 요약 — 트래커 맨 위(1번 카드)
    out.append(hub_html())

    # 요약
    out.append('<div class="card trk-card">')
    out.append('<div class="trk-top"><p class="trk-stamp">트래커 기준 <b>%s</b> · '
               '노션 동기화 %s · 미결 건 %s</p>'
               '<button class="trk-refresh" type="button" id="trkRefresh" title="페이지를 다시 불러옵니다">'
               '<span aria-hidden="true">↻</span> 새로고침</button></div>' % (STAMP, NOTION_SYNC, MIGYEOL_SYNC))
    out.append('<div class="trk-rule" aria-hidden="true"></div>')
    out.append('<div class="trk-stats">')
    out.append('<div class="trk-stat"><div class="trk-label">누적 응모</div>'
               '<div class="trk-num">%d</div>'
               '<div class="trk-note">체험단 %d · 설문·응모 %d (11/12~11/28 기록)</div></div>'
               % (cum_total, event_total, survey_total))
    out.append('<div class="trk-stat"><div class="trk-label">발표 대기</div>'
               '<div class="trk-num">%d</div>'
               '<div class="trk-note">발표일 확정 %d · 결과 미확인 %d 별도</div></div>'
               % (pending_total, pending_total, unknown_total))
    out.append('<div class="trk-stat"><div class="trk-label">당첨 확정</div>'
               '<div class="trk-num win">%d</div>'
               '<div class="trk-note">확정 결과 %d건 중 %d건 · %.1f%%</div></div>'
               % (WINS_N, decided, WINS_N, win_rate))
    out.append('<div class="trk-stat"><div class="trk-label">남은 큐</div>'
               '<div class="trk-num">%d</div>'
               '<div class="trk-note">리뷰·후기 %d · 미결 %d</div></div>'
               % (queue_total, queue_review, queue_open))
    out.append('</div>')

    # 오늘 발표 배너 — 발표일이 확정된 건이 없으면 중립 줄만
    if today_all:
        out.append('<div class="trk-banner"><div><span class="trk-banner-main">오늘 발표 %d건</span>'
                   '<small>11/28(토) — 체험단 %d · 설문·응모 %d · 아래 발표 일정에서 확인하세요</small></div>'
                   '<span class="trk-arw" aria-hidden="true">→</span></div>'
                   % (today_all, today_total, today_survey))
    else:
        out.append('<div class="trk-banner"><div><span class="trk-banner-main">오늘 발표 없음</span>'
                   '<small>11/28(토) — 발표일이 확정된 체험단이 없습니다 · 다음 발표 %s %d건 '
                   '(로또 6/45 제1252회 추첨은 오늘 20:45)</small></div>'
                   '<span class="trk-arw" aria-hidden="true">→</span></div>'
                   % (next_announce_date, next_announce_n))
    out.append('<div class="trk-week"><span>이번 주 11/23~11/29 남은 발표 %d건</span>'
               '<span>다음 주 11/30~12/06 발표 %d건</span>'
               '<span>발표일 지남·미확인 %d건</span></div>' % (this_week, next_week, unknown_total))

    # 당첨 확정
    out.append('<div class="trk-sec"><div class="trk-sec-head"><h3>당첨 확정</h3>'
               '<span class="cnt">%d건</span></div><ul class="trk-list">' % WINS_N)
    for label, title, meta, badge, kind in WINS:
        out.append(row(label, title, meta, badge, kind))
    out.append('</ul></div>')

    # 발표 대기
    out.append('<div class="trk-sec"><div class="trk-sec-head"><h3>발표 대기</h3>'
               '<span class="cnt">%d건 · 발표일순</span></div>' % pending_total)
    for date, tag, items in PENDING:
        today = date.startswith("11/28")
        out.append('<div class="trk-day%s"><b>%s</b><span>%s · %d건</span></div>'
                   % (" today" if today else "", date, tag, len(items)))
        out.append('<ul class="trk-list">')
        for label, title, meta in items:
            out.append(row(label, title, meta, tag, "today" if today else "", today))
        out.append('</ul>')
    out.append('</div>')

    # 결과 미확인
    out.append('<div class="trk-sec"><div class="trk-sec-head"><h3>결과 미확인</h3>'
               '<span class="cnt">%d건 · 발표일 지남·공지 대기</span></div><ul class="trk-list">'
               % unknown_total)
    for label, title, meta, n in UNKNOWN:
        out.append(row(label, title, meta, "%d건" % n, "wait"))
    out.append('</ul></div>')

    # 남은 큐
    out.append('<div class="trk-sec"><div class="trk-sec-head"><h3>남은 큐 · 진행 중</h3>'
               '<span class="cnt">%d건 · 리뷰·후기 %d + 미결 %d</span></div><ul class="trk-list">'
               % (queue_total, queue_review, queue_open))
    for label, title, meta, badge, kind in QUEUE:
        out.append(row(label, title, meta, badge, kind))
    out.append('</ul></div>')

    out.append('<p class="trk-foot">집계 기준 — 누적 응모는 기록이 남은 11/12~11/28 접수분'
               '(체험단은 카톡 선물하기 포함, 설문·응모는 일자별 완료 집계)입니다. '
               '당첨률은 노션 발표 명단에 결과가 확정된 건(당첨 %d + 미당첨·미선정 %d) 기준이고, '
               '미결 건은 노션 🚧 미결 건의 항목 수입니다. 수치는 노션 두 현황판과 '
               '<code>current-status.md</code> 기록만으로 계산했습니다.</p>' % (WINS_N, MISSES))
    out.append('</div>')
    return "\n".join(out)


CSS = """
  /* ── 트래커 ── */
  .trk-card{padding:22px 22px 26px}
  .trk-top{display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap}
  .trk-stamp{font-size:12.5px; color:var(--ink-soft); font-variant-numeric:tabular-nums; letter-spacing:-.1px}
  .trk-stamp b{color:var(--ink); font-weight:800}
  .trk-refresh{display:inline-flex; align-items:center; gap:6px; padding:8px 14px; border-radius:999px;
    background:#fff; border:1px solid var(--line-strong); font-size:12px; font-weight:800; color:var(--ink-soft);
    box-shadow:var(--shadow-sm); transition:transform .18s ease, box-shadow .18s ease}
  .trk-refresh:hover{transform:translateY(-1px); box-shadow:0 8px 18px rgba(140,105,70,.14)}
  .trk-rule{height:3px; background:var(--ink); border-radius:3px; margin:14px 0 2px}
  .trk-stats{display:grid; grid-template-columns:1fr 1fr}
  .trk-stat{padding:18px 2px 16px}
  .trk-stat:nth-child(odd){padding-right:20px}
  .trk-stat:nth-child(even){padding-left:20px; border-left:1px solid var(--line)}
  .trk-stat:nth-child(n+3){border-top:1px solid var(--line)}
  .trk-label{font-size:12px; font-weight:800; color:var(--muted); letter-spacing:-.1px}
  .trk-num{font-size:46px; line-height:1.06; font-weight:800; letter-spacing:-2.2px;
    font-variant-numeric:tabular-nums; margin-top:2px; color:var(--ink)}
  .trk-num.win{color:#C0392B}
  .trk-note{font-size:11.5px; color:var(--muted-2); margin-top:7px; font-variant-numeric:tabular-nums; letter-spacing:-.15px}
  .trk-banner{margin-top:16px; display:flex; align-items:center; justify-content:space-between; gap:12px;
    background:linear-gradient(135deg,#C63A2B 0%,#A82B20 100%); color:#fff; border-radius:13px;
    padding:14px 17px; box-shadow:0 12px 26px rgba(168,43,32,.22)}
  .trk-banner-main{font-size:15px; font-weight:800; letter-spacing:-.3px}
  .trk-banner small{display:block; margin-top:4px; font-size:11.5px; font-weight:600; opacity:.92; letter-spacing:-.15px}
  .trk-arw{font-size:18px; font-weight:800; opacity:.85; flex:0 0 auto}
  .trk-week{display:flex; flex-wrap:wrap; gap:7px; margin-top:10px}
  .trk-week span{font-size:11.5px; font-weight:700; color:var(--ink-soft); background:#FFF8F3;
    border:1px solid var(--line); border-radius:999px; padding:6px 11px; font-variant-numeric:tabular-nums}
  .trk-sec{margin-top:26px}
  .trk-sec-head{display:flex; align-items:baseline; justify-content:space-between; gap:10px;
    padding-bottom:8px; border-bottom:2px solid var(--ink)}
  .trk-sec-head h3{font-size:16px; font-weight:800; letter-spacing:-.35px}
  .trk-sec-head .cnt{font-size:11.5px; font-weight:800; color:var(--muted); font-variant-numeric:tabular-nums}
  .trk-day{display:flex; align-items:center; gap:8px; margin:16px 0 2px; font-size:11.5px; font-weight:700; color:var(--muted)}
  .trk-day::before{content:""; width:6px; height:6px; border-radius:50%; background:var(--line-strong); flex:0 0 auto}
  .trk-day b{font-size:12.5px; font-weight:800; color:var(--ink); letter-spacing:-.2px}
  .trk-day.today b{color:#C0392B}
  .trk-day.today::before{background:#C0392B}
  .trk-day span{font-variant-numeric:tabular-nums}
  .trk-list{list-style:none; margin:0; padding:0}
  .trk-row{display:grid; grid-template-columns:58px minmax(0,1fr) auto; gap:10px; align-items:start;
    padding:10px 2px; border-bottom:1px solid var(--line); font-size:12.5px}
  .trk-row:last-child{border-bottom:0}
  .trk-pf{font-size:10.5px; font-weight:800; text-align:center; padding:4px 0; border-radius:7px;
    background:#F5EEE4; color:var(--ink-soft); letter-spacing:-.2px}
  .trk-pf.kakao{background:#FDF2D2; color:#8A6A18}
  .trk-pf.revu{background:#FBE6EA; color:#A8546A}
  .trk-pf.dinner{background:#FDEBDD; color:#A9663A}
  .trk-pf.rp{background:#E7F0F9; color:#4A7098}
  .trk-pf.mom{background:#E8F3EA; color:#4E7A5C}
  .trk-pf.naver{background:#E4F4E6; color:#2F7D3C}
  .trk-pf.coupang{background:#FCE8E6; color:#B0463C}
  .trk-pf.hot{background:#FDF0E3; color:#A96B2E}
  .trk-pf.survey{background:#EDEBFA; color:#5E559B}
  .trk-pf.challenge{background:#E9F4F1; color:#3E7C6E}
  .trk-pf.hold{background:#F1ECE6; color:#84736A}
  .trk-body{min-width:0}
  .trk-t{display:block; font-weight:700; color:var(--ink); letter-spacing:-.2px; overflow-wrap:anywhere}
  .trk-m{display:block; margin-top:2px; font-size:11px; color:var(--muted); letter-spacing:-.15px; overflow-wrap:anywhere}
  .trk-d{font-size:10.5px; font-weight:800; padding:4px 9px; border-radius:999px; white-space:nowrap;
    border:1px solid var(--line-strong); color:var(--ink-soft); font-variant-numeric:tabular-nums}
  .trk-d.today{background:#C0392B; border-color:#C0392B; color:#fff}
  .trk-d.done{background:var(--green-soft); border-color:#CDE7D5; color:var(--green-deep)}
  .trk-d.warn{background:#FBEAE6; border-color:#F3D2CA; color:#B0442F}
  .trk-d.wait{background:#FFF7ED; border-color:#F2DFC6; color:#9A6B33}
  .trk-foot{margin-top:20px; padding-top:14px; border-top:1px solid var(--line);
    font-size:11px; line-height:1.65; color:var(--muted-2); letter-spacing:-.15px}
  .trk-foot code{font-size:10.5px; background:#F7F1E8; padding:1px 5px; border-radius:5px}
"""

HUB_CSS = """
  /* ── 노션 허브 요약 ── */
  .hub-card{margin-top:0; padding:22px}
  .hub-card + .trk-card{margin-top:16px}
  .hub-top{display:flex; align-items:baseline; justify-content:space-between; gap:10px; flex-wrap:wrap; margin-bottom:14px}
  .hub-top h3{font-size:16px; font-weight:800; letter-spacing:-.35px}
  .hub-top span{font-size:11.5px; font-weight:700; color:var(--muted)}
  .hub-grid{display:grid; grid-template-columns:1fr 1fr; gap:12px}
  .hub-grid.three{grid-template-columns:repeat(3,minmax(0,1fr))}
  .hub-box{padding:16px; border-radius:18px; background:#FFFBF5; border:1px solid var(--line)}
  .hub-label{font-size:11.5px; font-weight:800; color:var(--muted); letter-spacing:-.15px}
  .hub-big{margin-top:6px; font-size:21px; font-weight:800; letter-spacing:-.8px; font-variant-numeric:tabular-nums; color:var(--ink)}
  .hub-big small{font-size:11.5px; font-weight:700; color:var(--muted); letter-spacing:-.2px; margin-left:3px}
  .hub-p{margin-top:8px; font-size:11.5px; line-height:1.65; color:var(--ink-soft); letter-spacing:-.2px}
  .hub-sub{display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin:22px 0 6px;
    font-size:13px; font-weight:800; letter-spacing:-.25px; color:var(--ink)}
  .hub-sub .n{font-size:11px; font-weight:800; color:#fff; background:#C0392B; padding:2px 8px; border-radius:999px}
  .hub-sub em{font-style:normal; font-size:11px; font-weight:700; color:var(--muted)}
  .hub-list{list-style:none; margin:0; padding:0}
  .hub-row{display:grid; grid-template-columns:88px minmax(0,1fr) auto; gap:10px; align-items:center;
    padding:9px 2px; border-bottom:1px solid var(--line); font-size:12px}
  .hub-row:last-child{border-bottom:0}
  .hub-who{font-size:11px; font-weight:800; color:var(--ink-soft); letter-spacing:-.2px}
  .hub-body{min-width:0}
  .hub-body b{display:block; font-weight:700; color:var(--ink); overflow-wrap:anywhere}
  .hub-body i{display:block; margin-top:2px; font-style:normal; font-size:11px; color:var(--muted); overflow-wrap:anywhere}
  .hub-ul{list-style:none; margin:8px 0 0; padding:0}
  .hub-ul li{position:relative; padding-left:11px; font-size:11.5px; line-height:1.6; color:var(--ink-soft); letter-spacing:-.2px}
  .hub-ul li::before{content:""; position:absolute; left:0; top:8px; width:4px; height:4px; border-radius:50%; background:var(--pink)}
  .hub-foot{margin-top:16px; padding-top:12px; border-top:1px solid var(--line); font-size:11px; line-height:1.65; color:var(--muted-2); letter-spacing:-.15px}
  /* 영상 주간 한도 초기화 — 증시·유가 아래 전체 너비 한 칸 */
  .hub-wide{grid-column:1 / -1}
  .hub-label small{font-weight:700; color:var(--muted-2); letter-spacing:-.2px; margin-left:5px}
  .hub-reset{display:flex; flex-wrap:wrap; gap:10px 12px; margin-top:9px}
  .hub-reset-i{flex:1 1 190px; display:flex; align-items:center; gap:9px; min-width:0;
    padding:10px 13px; border-radius:14px; background:#fff; border:1px solid var(--line-strong)}
  .hub-reset-k{font-size:11.5px; font-weight:800; color:var(--muted); letter-spacing:-.2px; white-space:nowrap}
  .hub-reset-v{font-size:15px; font-weight:700; color:var(--ink-soft); letter-spacing:-.4px;
    font-variant-numeric:tabular-nums; white-space:nowrap}
  .hub-reset-v b{font-size:17px; font-weight:800; color:var(--ink); letter-spacing:-.5px}
  .hub-reset-d{margin-left:auto; font-size:11px; font-weight:800; padding:3px 8px; border-radius:999px;
    background:#FFF3E2; border:1px solid #F0DFC6; color:#96632E; white-space:nowrap; font-variant-numeric:tabular-nums}
  .hub-reset-d.today{background:#FBEAE6; border-color:#F3D2CA; color:#B0442F}
  .hub-reset-d.past{background:#F4EFE8; border-color:var(--line-strong); color:var(--muted)}
  @media (max-width:720px){
    .hub-big{font-size:19px}
    .hub-reset-v{font-size:14.5px}
    .hub-reset-v b{font-size:16px}
  }
"""

DDAY_JS = """<script>
(function(){
  function kstYMD(ms){ var d = new Date(ms + 9 * 3600000); return [d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()]; }
  var now = kstYMD(Date.now());
  var els = document.querySelectorAll('.hub-reset-d[data-reset]');
  for (var i = 0; i < els.length; i++){
    var el = els[i], t = Date.parse(el.getAttribute('data-reset'));
    if (!t) continue;
    var tg = kstYMD(t);
    var left = Math.round((Date.UTC(tg[0], tg[1], tg[2]) - Date.UTC(now[0], now[1], now[2])) / 86400000);
    el.textContent = left > 0 ? 'D-' + left : (left === 0 ? '오늘' : '지남');
    el.classList.remove('today', 'past');
    if (left === 0) el.classList.add('today');
    else if (left < 0) el.classList.add('past');
  }
})();
</script>"""

MOBILE_CSS = """
    .trk-card{padding:18px 16px 20px}
    .trk-num{font-size:36px; letter-spacing:-1.6px}
    .trk-stat{padding:14px 2px 12px}
    .trk-stat:nth-child(odd){padding-right:12px}
    .trk-stat:nth-child(even){padding-left:12px}
    .trk-note{font-size:10.8px}
    .trk-row{grid-template-columns:50px minmax(0,1fr) auto; gap:8px; font-size:12px}
    .trk-pf{font-size:9.5px; padding:3px 0}
    .trk-d{font-size:10px; padding:3px 7px}
    .trk-banner-main{font-size:14px}
    .hub-card{padding:16px}
    .hub-grid, .hub-grid.three{grid-template-columns:1fr}
    .hub-row{grid-template-columns:76px minmax(0,1fr) auto; gap:7px; font-size:11.5px}
    .hub-reset-i{flex:1 1 100%}
"""

NAV_BTN = ('    <button class="tab" role="tab" id="tab-tracker" aria-controls="panel-tracker" '
           'aria-selected="false" tabindex="-1" data-tab="tracker">트래커</button>\n')

PANEL_TMPL = """  <!-- ═══ 트래커 ═══ -->
  <section class="panel" id="panel-tracker" role="tabpanel" aria-labelledby="tab-tracker">
    <div class="section-head">
      <div>
        <h2>트래커</h2>
        <p>체험단 · 설문 · 응모 · 상품권까지, 실제 기록으로 센 숫자입니다.</p>
      </div>
      <button class="cmd-btn" type="button" data-goto="work">작업실에서 보기</button>
    </div>
    <!-- TRACKER-PANEL:START -->
    %s
    <!-- TRACKER-PANEL:END -->
  </section>

"""

JS_ADD = """
  var trkRefresh = $('#trkRefresh');
  if (trkRefresh) trkRefresh.addEventListener('click', function(){ location.reload(); });
"""


def insert_once(html, anchor, block, after=True):
    if block.strip() and block.split("\n")[1] in html:
        return html, False
    i = html.find(anchor)
    if i < 0:
        raise SystemExit("anchor not found: %r" % anchor[:40])
    if after:
        j = i + len(anchor)
        return html[:j] + block + html[j:], True
    return html[:i] + block + html[i:], True


def build(path):
    html = io.open(path, encoding="utf-8").read()
    body = sections()

    # 1) CSS (미디어쿼리보다 먼저 와야 모바일 덮어쓰기가 먹는다)
    if ".trk-card{" not in html:
        css_anchor = "  @media (max-width:860px){"
        if css_anchor not in html:
            raise SystemExit("css anchor not found")
        html = html.replace(css_anchor, CSS + "\n" + css_anchor, 1)
    if ".hub-card{" not in html:
        html = html.replace("  @media (max-width:860px){", HUB_CSS + "\n  @media (max-width:860px){", 1)
    if ".trk-num{font-size:36px" not in html:
        anchor = "    .tl-time{flex:0 0 62px; font-size:11px}\n  }\n"
        if anchor not in html:
            raise SystemExit("mobile css anchor not found")
        html = html.replace(anchor, "    .tl-time{flex:0 0 62px; font-size:11px}\n" + MOBILE_CSS + "  }\n", 1)

    # 2) 탭 7칸 (트래커 추가 · AI한도 제거 후)
    if 'id="tab-tracker"' not in html:
        html = html.replace("grid-template-columns:repeat(7,minmax(0,1fr))",
                            "grid-template-columns:repeat(8,minmax(0,1fr))", 1)

    # 3) nav 버튼 (오피스 맵 다음)
    if 'id="tab-tracker"' not in html:
        anchor = ('data-tab="map">오피스 맵</button>\n')
        if anchor in html:
            html = html.replace(anchor, anchor + NAV_BTN, 1)
        else:
            raise SystemExit("nav anchor not found")

    # 4) 패널
    if "<!-- TRACKER-PANEL:START -->" in html:
        pre, rest = html.split("<!-- TRACKER-PANEL:START -->", 1)
        _, post = rest.split("<!-- TRACKER-PANEL:END -->", 1)
        html = pre + "<!-- TRACKER-PANEL:START -->\n" + body + "\n    <!-- TRACKER-PANEL:END -->" + post
    else:
        anchor = "  <!-- ═══ 회의실 ═══ -->"
        if anchor not in html:
            raise SystemExit("panel anchor not found")
        html = html.replace(anchor, (PANEL_TMPL % body) + anchor, 1)

    # 5) JS
    if "var trkRefresh" not in html:
        anchor = "  $$('[data-goto]').forEach(function(b){"
        if anchor not in html:
            raise SystemExit("js anchor not found")
        html = html.replace(anchor, JS_ADD.strip("\n") + "\n\n" + anchor, 1)

    io.open(path, "w", encoding="utf-8").write(html)
    print("built %s" % path)


if __name__ == "__main__":
    print("누적 응모 %d (체험단 %d + 설문·응모 %d)" % (cum_total, event_total, survey_total))
    print("발표 대기 %d (오늘 %d + 설문 %d = %d) · 결과 미확인 %d" %
          (pending_total, today_total, today_survey, today_all, unknown_total))
    print("당첨 %d / 확정 %d = %.1f%% · 남은 큐 %d" % (WINS_N, decided, win_rate, queue_total))
    targets = sys.argv[1:] or [os.path.join(BASE, "index.html")]
    for t in targets:
        build(t)
