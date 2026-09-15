from pathlib import Path
from PIL import Image

from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader


ROOT = Path(r"C:\Users\user\Desktop\saeng\Saengjonil")
ASSETS = ROOT / "tmp" / "pdfs" / "lg_assets"
OUT_DIR = ROOT / "output" / "pdf"
OUT_DIR.mkdir(parents=True, exist_ok=True)
OUT = OUT_DIR / "김가영_LG생활건강_Home_Care_Daily_Beauty_국내영업_Experience_Map.pdf"

W, H = 960, 540
FONT = "NotoKR"
BOLD = "NotoKRB"
pdfmetrics.registerFont(TTFont(FONT, r"C:\Windows\Fonts\NotoSansKR-Regular.ttf"))
pdfmetrics.registerFont(TTFont(BOLD, r"C:\Windows\Fonts\NotoSansKR-Bold.ttf"))

SIDE = HexColor("#DCEEF4")
CYAN = HexColor("#5CB0CA")
BLUE = HexColor("#4A83B3")
INK = HexColor("#34383B")
MUTED = HexColor("#787E82")
LINE = HexColor("#D2D7DA")
PALE = HexColor("#F2F8FA")
WHITE = HexColor("#FFFFFF")
YELLOW = HexColor("#FFF3A6")
ORANGE = HexColor("#E78832")


def wrap(s, font, size, max_width):
    result = []
    for para in str(s).split("\n"):
        if not para:
            result.append("")
            continue
        cur = ""
        for ch in para:
            trial = cur + ch
            if cur and pdfmetrics.stringWidth(trial, font, size) > max_width:
                result.append(cur.rstrip())
                cur = ch.lstrip()
            else:
                cur = trial
        if cur:
            result.append(cur.rstrip())
    return result


def draw_text(c, s, x, y, w, size=11, color=INK, font=FONT, leading=None):
    leading = leading or size * 1.5
    c.setFillColor(color)
    c.setFont(font, size)
    for line in wrap(s, font, size, w):
        c.drawString(x, y, line)
        y -= leading
    return y


def section_mark(c, title, x, y):
    c.setFillColor(CYAN)
    c.roundRect(x, y - 2, 14, 14, 2, fill=1, stroke=0)
    c.setStrokeColor(WHITE)
    c.setLineWidth(1.6)
    c.line(x + 3, y + 5, x + 6, y + 2)
    c.line(x + 6, y + 2, x + 11, y + 9)
    c.setFillColor(INK)
    c.setFont(BOLD, 12)
    c.drawString(x + 22, y, title)


def bullet(c, s, x, y, w, size=9.4, leading=14):
    c.setStrokeColor(BLUE)
    c.setLineWidth(0.8)
    c.circle(x + 4, y + 3, 4, fill=0, stroke=1)
    c.setFillColor(BLUE)
    c.setFont(BOLD, 7)
    c.drawCentredString(x + 4, y + 0.5, ">")
    return draw_text(c, s, x + 14, y, w - 14, size, MUTED, FONT, leading)


def crop(src, dst, box):
    out = ASSETS / dst
    Image.open(ASSETS / src).convert("RGB").crop(box).save(out, quality=95)
    return out


def img(c, path, x, y, w, h, border=False):
    im = Image.open(path).convert("RGB")
    iw, ih = im.size
    scale = min(w / iw, h / ih)
    dw, dh = iw * scale, ih * scale
    if border:
        c.setStrokeColor(LINE)
        c.setFillColor(WHITE)
        c.roundRect(x, y, w, h, 5, fill=1, stroke=1)
    c.drawImage(ImageReader(im), x + (w - dw) / 2, y + (h - dh) / 2, dw, dh, preserveAspectRatio=True, mask="auto")


def page_num(c, n):
    c.setFillColor(HexColor("#F1F1F1"))
    c.roundRect(874, 500, 40, 16, 8, fill=1, stroke=0)
    c.setFillColor(MUTED)
    c.setFont(FONT, 8)
    c.drawCentredString(894, 505, str(n))


def detail_header(c, n, title, subtitle):
    c.setFillColor(WHITE)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColor(HexColor("#A5A5A5"))
    c.setFont(FONT, 7.5)
    c.drawString(64, 510, "가영의 포트폴리오 | Gayoung’s Portfolio")
    page_num(c, n + 2)
    c.setFillColor(CYAN)
    c.setFont(BOLD, 24)
    c.drawString(64, 475, f"프로젝트 상세 정보 ({n}/7)")
    c.setFillColor(INK)
    c.setFont(BOLD, 18)
    c.drawString(64, 418, f"{n:02d}.")
    c.setFillColor(BLUE)
    c.drawString(105, 418, title)
    c.setFillColor(INK)
    c.setFont(FONT, 15)
    c.drawString(64, 391, f": {subtitle}")


def meta(c, period, form, role):
    c.setStrokeColor(LINE)
    c.setLineWidth(0.7)
    c.line(64, 75, 510, 75)
    c.line(64, 28, 510, 28)
    c.setFillColor(INK)
    c.setFont(FONT, 8.5)
    c.drawString(72, 58, "기간")
    c.drawString(145, 58, period)
    c.drawString(308, 58, "형태")
    c.drawString(355, 58, form)
    c.drawString(72, 39, "역할")
    draw_text(c, role, 145, 39, 355, 8.2, INK, FONT, 11)


def sales_tag(c, s):
    c.setFillColor(PALE)
    c.roundRect(545, 32, 350, 45, 5, fill=1, stroke=0)
    c.setFillColor(CYAN)
    c.setFont(BOLD, 8)
    c.drawString(560, 58, "LG SALES POINT")
    draw_text(c, s, 560, 45, 318, 7.7, MUTED, FONT, 10)


profile = crop("service_profile-02.png", "profile.jpg", (202, 390, 452, 725))
service_main = crop("service-05.png", "tpl_service_main.jpg", (960, 150, 1950, 1025))
service_improve = crop("service-06.png", "tpl_service_improve.jpg", (1000, 120, 1960, 1030))
service_operate = crop("service-07.png", "tpl_service_operate.jpg", (1000, 120, 1960, 1030))
jeju = crop("original_jeju-13.png", "tpl_jeju.jpg", (900, 300, 1950, 1050))
webtoon = crop("original_webtoon-06.png", "tpl_webtoon.jpg", (900, 220, 1960, 900))


c = canvas.Canvas(str(OUT), pagesize=(W, H), pageCompression=1)
c.setTitle("김가영 LG생활건강 Home Care & Daily Beauty 국내영업 Experience Map")
c.setAuthor("김가영")


# 1. Cover — original split layout
c.setFillColor(SIDE)
c.rect(0, 0, 610, H, fill=1, stroke=0)
c.setFillColor(WHITE)
c.rect(610, 0, 350, H, fill=1, stroke=0)
c.setFillColor(WHITE)
c.roundRect(54, 452, 57, 14, 7, fill=1, stroke=0)
c.setFillColor(MUTED)
c.setFont(FONT, 7)
c.drawCentredString(82.5, 457, "2026년")
c.setFillColor(INK)
c.setFont(FONT, 12)
c.drawString(55, 404, "LG생활건강")
c.setFillColor(BLUE)
c.setFont(BOLD, 21)
c.drawString(55, 370, "Home Care & Daily Beauty")
c.setFillColor(INK)
c.setFont(BOLD, 27)
c.drawString(55, 333, "국내영업 Experience Map")
c.setFillColor(WHITE)
c.rect(55, 300, 50, 3, fill=1, stroke=0)
draw_text(c, "고객의 행동을 읽고,\n데이터로 판단하며,\n실행으로 연결하는 사람", 55, 260, 440, 18, INK, BOLD, 27)
c.setFillColor(MUTED)
c.setFont(FONT, 9)
c.drawString(55, 62, "김가영  |  Home Care & Daily Beauty 국내영업 지원")
c.saveState()
c.translate(786, 110)
c.rotate(90)
c.setFillColor(HexColor("#C7DDE5"))
c.setFont(BOLD, 24)
c.drawString(0, 0, "PORTFOLIO")
c.restoreState()
c.showPage()


# 2. Experience Map — original left category layout
c.setFillColor(WHITE)
c.rect(0, 0, W, H, fill=1, stroke=0)
c.setFillColor(SIDE)
c.rect(0, 0, 245, H, fill=1, stroke=0)
c.setFillColor(BLUE)
c.setFont(BOLD, 27)
c.drawString(56, 445, "02")
c.setFillColor(HexColor("#9C9C9C"))
c.setFont(FONT, 7.5)
c.drawString(56, 389, "가영의 포트폴리오 | Gayoung’s Portfolio")
c.setFillColor(INK)
c.setFont(BOLD, 27)
c.drawString(56, 350, "Experience")
c.drawString(56, 318, "Map")
c.setFillColor(WHITE)
c.rect(56, 283, 95, 4, fill=1, stroke=0)
img(c, profile, 76, 76, 92, 125)
c.setFillColor(INK)
c.setFont(BOLD, 10)
c.drawCentredString(122, 58, "김가영")
c.setFillColor(CYAN)
c.setFont(BOLD, 21)
c.drawString(287, 456, "고객 이해에서 실행까지,")
c.setFillColor(INK)
c.drawString(287, 426, "국내영업을 준비해온 경험")
rows = [
    ("01", "고객 관찰", "취업일지", "약 50명 사용자의 실제 이용 흐름과 요구를 반영해 서비스 구조 개선"),
    ("02", "데이터 기반 판단", "웹툰 소비자 분석", "해외 소비자를 5개 유형으로 구분하고 유형별 전략 근거 도출"),
    ("03", "전략 기획·실행", "제주항공 IMC", "2030 구매행동 분석을 기반으로 온·오프라인 캠페인 기획"),
    ("04", "고객 커뮤니케이션", "입학팀", "약 3년간 문의·민원에 대응하고 고객별 맞춤 정보 제공"),
]
for i, (n, ability, exp, desc) in enumerate(rows):
    y = 350 - i * 78
    c.setFillColor(CYAN)
    c.roundRect(288, y, 42, 28, 3, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont(BOLD, 9)
    c.drawCentredString(309, y + 9, n)
    c.setFillColor(INK)
    c.setFont(BOLD, 11)
    c.drawString(350, y + 17, ability)
    c.setFillColor(BLUE)
    c.setFont(BOLD, 10)
    c.drawString(475, y + 17, exp)
    draw_text(c, desc, 610, y + 17, 280, 8.3, MUTED, FONT, 11)
    c.setStrokeColor(LINE)
    c.line(350, y - 12, 900, y - 12)
c.setFillColor(PALE)
c.roundRect(287, 50, 613, 44, 4, fill=1, stroke=0)
c.setFillColor(BLUE)
c.setFont(BOLD, 12)
c.drawString(307, 68, "관찰  →  분석  →  실행  →  개선")
c.setFillColor(MUTED)
c.setFont(FONT, 8.5)
c.drawString(540, 68, "고객의 선택을 이해하고 실행 가능한 전략으로 연결")
c.showPage()


# 3. 취업일지 — WHY
detail_header(c, 1, "취업일지", "50명의 취업준비생, 기록을 지속하게 만드는 방법")
section_mark(c, "프로젝트 개요", 64, 345)
draw_text(c, "취업 준비 활동과 목표를 기록·공유하고, 함께 준비하는 사람들의 활동을 확인하며 성장 과정을 볼 수 있는 환경을 기획·운영했습니다.", 64, 316, 410, 9.7, MUTED, FONT, 15)
section_mark(c, "고객과 나의 역할", 64, 245)
for i, s in enumerate([
    "약 50명 규모 취업 커뮤니티의 참여자와 운영자",
    "사용자·운영자의 이용 흐름과 필요한 정보 정의",
    "기능 우선순위·데이터 저장 기준·운영 정책 설계",
    "구현·테스트·배포·운영 후 사용자 피드백 반영",
]):
    bullet(c, s, 64, 218 - i * 24, 410)
img(c, service_main, 505, 110, 390, 275, border=True)
meta(c, "운영 경험", "개인 기획·운영", "문제 정의 · 요구사항/정책 설계 · 구현 검증 · 배포/운영")
sales_tag(c, "사용자의 행동을 관찰하고 실제 이용 흐름을 기준으로 서비스를 설계했습니다.")
c.showPage()


# 4. 취업일지 — OBSERVATION & ACTION
detail_header(c, 2, "사용자 요구와 서비스 구조 개선", "말보다 행동을 보고, 기록 방식과 참여 구조를 바꾸다")
section_mark(c, "Observation 1 → Action 1", 64, 345)
draw_text(c, "하루 총 활동시간만 입력하던 구조에서, 어떤 활동에 시간을 썼는지 구분해 보고 싶다는 요구를 발견했습니다.", 64, 316, 410, 9.5, MUTED, FONT, 14)
c.setFillColor(PALE); c.roundRect(64, 257, 410, 35, 4, fill=1, stroke=0)
draw_text(c, "활동별로 시간을 입력·확인하도록 기록 구조를 세분화", 78, 271, 380, 9.4, BLUE, BOLD, 13)
section_mark(c, "Observation 2 → Action 2", 64, 218)
draw_text(c, "한 사용자가 여러 프로그램에 참여하는 실제 운영을 확인하고, 단일 그룹 구조를 다중 그룹 참여 구조로 변경했습니다.", 64, 189, 410, 9.5, MUTED, FONT, 14)
c.setFillColor(PALE); c.roundRect(64, 123, 410, 47, 4, fill=1, stroke=0)
draw_text(c, "기존 데이터 호환과 관리자 배정·사용자 선택 흐름까지 함께 수정", 78, 149, 380, 9.2, BLUE, BOLD, 13)
img(c, service_improve, 510, 246, 385, 140, border=True)
img(c, service_operate, 510, 95, 385, 140, border=True)
meta(c, "운영 경험", "개인 기획·운영", "사용자 요구 반영 · 활동별 입력 개선 · 다중 그룹 구조 전환")
sales_tag(c, "실제 행동과 반응을 확인하고 실행 이후의 개선까지 연결했습니다.")
c.showPage()


# 5. 제주항공 — CUSTOMER INSIGHT
detail_header(c, 3, "제주항공 리프레시 포인트", "2030의 구매행동에서 포인트 활성화의 실마리를 찾다")
section_mark(c, "프로젝트 개요", 64, 345)
draw_text(c, "2030 고객의 포인트 인지도와 사용을 높이기 위해, 콘텐츠 제작보다 먼저 고객이 포인트를 어떻게 인식하고 사용하는지 확인했습니다.", 64, 316, 410, 9.7, MUTED, FONT, 15)
section_mark(c, "고객 조사와 판단", 64, 239)
for i, s in enumerate([
    "2030 대상 설문조사를 직접 설계·배포",
    "포인트 인지도·구매행동·소비자 반응 분석",
    "조사 결과를 온·오프라인 전략 방향의 근거로 활용",
]):
    bullet(c, s, 64, 212 - i * 25, 410)
section_mark(c, "나의 역할", 64, 127)
draw_text(c, "조장 · 전략 기획 총괄 · 콘텐츠 기획 및 제작", 64, 101, 410, 9.7, MUTED, FONT, 14)
img(c, jeju, 500, 98, 400, 288, border=True)
meta(c, "2024.10.12 ~ 2025.02.07", "10인 프로젝트", "조장 · 기획 총괄 · 콘텐츠 기획 및 제작")
sales_tag(c, "구매행동을 먼저 확인한 뒤 프로모션 방향을 설계했습니다.")
c.showPage()


# 6. 제주항공 — STRATEGY & EXECUTION
detail_header(c, 4, "분석을 온·오프라인 고객 경험으로", "Insight가 실제 고객 접점에서 실행될 때 비로소 전략이 된다")
section_mark(c, "온라인 실행", 64, 345)
for i, s in enumerate([
    "포인트 적립률을 전달하는 인포머셜 숏폼",
    "오징어게임 패러디 바이럴 영상",
    "앱 기반 고객 참여 이벤트 아이디어",
]):
    bullet(c, s, 64, 318 - i * 25, 410)
section_mark(c, "오프라인 실행", 64, 229)
for i, s in enumerate([
    "대학 대항전과 간식차",
    "럭키드로우 등 체험형 참여 아이디어",
]):
    bullet(c, s, 64, 202 - i * 25, 410)
section_mark(c, "결과", 64, 132)
c.setFillColor(YELLOW); c.roundRect(64, 92, 410, 28, 4, fill=1, stroke=0)
c.setFillColor(INK); c.setFont(BOLD, 10); c.drawString(80, 102, "매경비즈 직무스펙 프로젝트 대상")
img(c, jeju, 500, 98, 400, 288, border=True)
meta(c, "2024.10.12 ~ 2025.02.07", "10인 프로젝트", "소비자 조사 기반 IMC 전략 · 온·오프라인 콘텐츠 기획/제작")
sales_tag(c, "분석을 프로모션과 온·오프라인 고객 접점으로 구체화했습니다.")
c.showPage()


# 7. Webtoon
detail_header(c, 5, "한국 웹툰 소비자 분석", "같은 콘텐츠도 고객마다 선택 이유는 달랐다")
section_mark(c, "프로젝트 개요", 64, 345)
draw_text(c, "한국 웹툰의 글로벌 진출을 위해 여러 데이터 소스를 활용해 해외 소비자의 반응과 흥행 요인을 분석했습니다.", 64, 316, 410, 9.7, MUTED, FONT, 15)
section_mark(c, "고객 세분화와 전략", 64, 239)
for i, s in enumerate([
    "팀: 해외 소비자 반응을 5개 유형으로 구분",
    "팀: 소비자 유형별 마케팅·해외 진출 전략 제안",
    "본인: 댓글 수집·전처리, 로지스틱 회귀분석",
    "본인: 구독자 예측모델 구축과 SHAP 영향요인 해석",
]):
    bullet(c, s, 64, 212 - i * 24, 410)
c.setFillColor(YELLOW); c.roundRect(64, 92, 410, 28, 4, fill=1, stroke=0)
c.setFillColor(INK); c.setFont(BOLD, 9.5); c.drawString(80, 102, "문화데이터 공모전 데이터분석 부문 대상")
img(c, webtoon, 500, 98, 400, 288, border=True)
meta(c, "2024.07", "4인 팀 프로젝트", "댓글 수집·전처리 · 로지스틱 회귀 · 구독자 예측모델 · SHAP")
sales_tag(c, "고객군에 따라 선택 기준이 다르므로 채널별 전략도 달라야 함을 배웠습니다.")
c.showPage()


# 8. Customer communication
detail_header(c, 6, "고객 커뮤니케이션", "고객의 질문을 필요한 해결책으로 바꾸다")
section_mark(c, "약 3년의 고객 접점", 64, 345)
draw_text(c, "대학 입학팀에서 입학전형·제출서류·일정·학교생활 문의와 민원에 대응했습니다.", 64, 316, 410, 9.7, MUTED, FONT, 15)
section_mark(c, "내가 한 일", 64, 239)
for i, s in enumerate([
    "문의 유형과 고객의 상황을 파악해 맞춤 정보 제공",
    "상담 내용을 문서화하고 유사 사례 대응 자료 관리",
    "FAQ와 안내문 정비",
    "신규 인턴의 업무 이해 지원",
]):
    bullet(c, s, 64, 212 - i * 24, 410)
section_mark(c, "배운 점", 64, 112)
draw_text(c, "고객이 표현한 질문보다 그 뒤에 있는 실제 필요를 파악해야 정확한 해결책을 제공할 수 있었습니다.", 64, 86, 410, 9.2, MUTED, FONT, 13)
c.setFillColor(PALE); c.roundRect(515, 112, 375, 270, 6, fill=1, stroke=0)
steps = [("01", "문의 파악", "질문의 상황과 필요한 정보 구분"), ("02", "맞춤 안내", "고객별로 정확한 정보 전달"), ("03", "기록·관리", "상담 내용과 유사 사례 축적"), ("04", "안내 개선", "FAQ·안내문 정비")]
for i, (n, a, b) in enumerate(steps):
    y = 326 - i * 58
    c.setFillColor(CYAN); c.circle(548, y + 9, 13, fill=1, stroke=0)
    c.setFillColor(WHITE); c.setFont(BOLD, 7); c.drawCentredString(548, y + 6.5, n)
    c.setFillColor(INK); c.setFont(BOLD, 10); c.drawString(575, y + 13, a)
    c.setFillColor(MUTED); c.setFont(FONT, 8); c.drawString(575, y - 3, b)
meta(c, "약 3년", "입학팀 근무", "고객 문의·민원 응대 · 문서화 · FAQ/안내문 정비")
sales_tag(c, "내·외부 고객의 요구를 파악하고 필요한 정보를 정확히 전달하는 경험입니다.")
c.showPage()


# 9. Why LG
detail_header(c, 7, "WHY LG생활건강 Home Care & Daily Beauty 국내영업", "경험을 국내영업의 실행과 성과로 연결")
section_mark(c, "지원자 경험", 64, 345)
left = ["사용자 행동 관찰", "고객 세분화·데이터 분석", "제주항공 IMC 기획", "서비스 운영 후 개선", "약 3년 고객 상담"]
right = ["소비자 구매패턴 분석", "채널별 영업전략·포트폴리오 운영", "프로모션·캠페인 기획·집행", "영업정책 사후분석·고도화", "내·외부 고객 커뮤니케이션"]
for i, (a, b) in enumerate(zip(left, right)):
    y = 302 - i * 45
    c.setFillColor(PALE); c.roundRect(64, y, 285, 28, 4, fill=1, stroke=0)
    c.setFillColor(INK); c.setFont(BOLD, 8.7); c.drawString(78, y + 10, a)
    c.setFillColor(CYAN); c.setFont(BOLD, 11); c.drawCentredString(385, y + 8, "→")
    c.setFillColor(SIDE); c.roundRect(420, y, 470, 28, 4, fill=1, stroke=0)
    c.setFillColor(BLUE); c.setFont(BOLD, 8.7); c.drawString(434, y + 10, b)
c.setFillColor(BLUE)
c.roundRect(64, 59, 826, 47, 5, fill=1, stroke=0)
c.setFillColor(WHITE)
c.setFont(BOLD, 11)
c.drawCentredString(477, 85, "고객의 작은 구매 변화를 기회로 읽고")
c.setFont(FONT, 8.5)
c.drawCentredString(477, 69, "채널별 실행으로 연결하는 LG생활건강의 ‘뛰어난 장사꾼’이 되겠습니다.")
c.showPage()


# 10. Closing — original thank-you composition
c.setFillColor(SIDE)
c.rect(0, 0, W, H, fill=1, stroke=0)
c.setFillColor(WHITE)
c.rect(154, 112, 520, 320, fill=1, stroke=0)
c.setFillColor(HexColor("#213E66"))
c.rect(190, 386, 175, 22, fill=1, stroke=0)
c.setFillColor(WHITE)
c.setFont(FONT, 7.5)
c.drawCentredString(277.5, 394, "가영의 포트폴리오 | Gayoung’s Portfolio")
c.setFillColor(HexColor("#203B63"))
c.setFont(BOLD, 27)
c.drawString(190, 337, "감사합니다.")
c.setStrokeColor(HexColor("#203B63"))
c.setLineWidth(1.2)
c.line(190, 321, 365, 321)
draw_text(c, "고객의 선택을 읽고,\n데이터로 기회를 발견하며,\n실행으로 성과를 만드는\n영업사원이 되겠습니다.", 190, 284, 420, 16, INK, BOLD, 24)
c.setFillColor(INK)
c.setFont(BOLD, 15)
c.drawString(190, 150, "김가영입니다.")
c.setFillColor(MUTED)
c.setFont(FONT, 8)
c.drawString(190, 129, "LG생활건강 Home Care & Daily Beauty 국내영업 지원")
c.setFillColor(MUTED)
c.setFont(FONT, 10)
c.drawRightString(900, 112, "Thank you")
c.setFillColor(HexColor("#5F6A70"))
c.setFont(FONT, 7.5)
c.drawString(60, 45, "김가영 | 010-2923-3450 | kk991011@gmail.com")
c.showPage()

c.save()
print(OUT)
