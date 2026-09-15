from pathlib import Path
from PIL import Image

from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor, Color
from reportlab.lib.utils import ImageReader


ROOT = Path(r"C:\Users\user\Desktop\saeng\Saengjonil")
ASSET_DIR = ROOT / "tmp" / "pdfs" / "lg_assets"
OUT_DIR = ROOT / "output" / "pdf"
OUT_DIR.mkdir(parents=True, exist_ok=True)
OUT = OUT_DIR / "김가영_LG생활건강_HDB_국내영업_Experience_Map.pdf"

W, H = 960, 540

NAVY = HexColor("#132B45")
BLUE = HexColor("#2E82A6")
CYAN = HexColor("#56B5C8")
PALE = HexColor("#EAF5F8")
PALE2 = HexColor("#F4F9FB")
INK = HexColor("#1B2733")
MUTED = HexColor("#667988")
LINE = HexColor("#CFDFE6")
WHITE = HexColor("#FFFFFF")
RED = HexColor("#B52B3B")
GOLD = HexColor("#E7B74C")
GREEN = HexColor("#4B9B88")

FONT_R = "NotoKR"
FONT_B = "NotoKRB"
pdfmetrics.registerFont(TTFont(FONT_R, r"C:\Windows\Fonts\NotoSansKR-Regular.ttf"))
pdfmetrics.registerFont(TTFont(FONT_B, r"C:\Windows\Fonts\NotoSansKR-Bold.ttf"))


def wrap(text, font, size, max_width):
    lines = []
    for para in str(text).split("\n"):
        if para == "":
            lines.append("")
            continue
        current = ""
        for ch in para:
            trial = current + ch
            if current and pdfmetrics.stringWidth(trial, font, size) > max_width:
                lines.append(current.rstrip())
                current = ch.lstrip()
            else:
                current = trial
        if current:
            lines.append(current.rstrip())
    return lines


def text(c, s, x, y, w, size=12, color=INK, font=FONT_R, leading=None, max_lines=None):
    leading = leading or size * 1.45
    lines = wrap(s, font, size, w)
    if max_lines:
        lines = lines[:max_lines]
    c.setFillColor(color)
    c.setFont(font, size)
    yy = y
    for line in lines:
        c.drawString(x, yy, line)
        yy -= leading
    return yy


def label(c, s, x, y, color=BLUE, bg=PALE, size=9, pad=7):
    tw = pdfmetrics.stringWidth(s, FONT_B, size)
    c.setFillColor(bg)
    c.roundRect(x, y - 3, tw + pad * 2, size + 10, 8, fill=1, stroke=0)
    c.setFillColor(color)
    c.setFont(FONT_B, size)
    c.drawString(x + pad, y + 1, s)
    return tw + pad * 2


def card(c, x, y, w, h, fill=WHITE, stroke=LINE, radius=14, shadow=True):
    if shadow:
        c.setFillColor(Color(0.05, 0.15, 0.22, alpha=0.07))
        c.roundRect(x + 3, y - 3, w, h, radius, fill=1, stroke=0)
    c.setFillColor(fill)
    c.setStrokeColor(stroke)
    c.setLineWidth(0.8)
    c.roundRect(x, y, w, h, radius, fill=1, stroke=1)


def header(c, page_no, section, title, subtitle=None):
    c.setFillColor(PALE2)
    c.rect(0, H - 74, W, 74, fill=1, stroke=0)
    c.setFillColor(CYAN)
    c.rect(0, H - 74, 8, 74, fill=1, stroke=0)
    c.setFillColor(BLUE)
    c.setFont(FONT_B, 9)
    c.drawString(38, H - 24, section)
    c.setFillColor(INK)
    c.setFont(FONT_B, 23)
    c.drawString(38, H - 53, title)
    if subtitle:
        c.setFillColor(MUTED)
        c.setFont(FONT_R, 9.5)
        c.drawRightString(W - 42, H - 50, subtitle)
    c.setFillColor(MUTED)
    c.setFont(FONT_R, 8)
    c.drawRightString(W - 28, 20, f"{page_no:02d}  |  LG생활건강 HDB 국내영업 Experience Map")


def sales_point(c, s, y=35):
    c.setFillColor(NAVY)
    c.roundRect(38, y, W - 76, 34, 10, fill=1, stroke=0)
    c.setFillColor(CYAN)
    c.setFont(FONT_B, 9)
    c.drawString(54, y + 12, "LG SALES POINT")
    c.setFillColor(WHITE)
    c.setFont(FONT_R, 10.5)
    c.drawString(155, y + 11.5, s)


def crop_asset(src_name, out_name, box):
    src = ASSET_DIR / src_name
    out = ASSET_DIR / out_name
    im = Image.open(src).convert("RGB")
    im.crop(box).save(out, quality=94)
    return out


def img_fit(c, path, x, y, w, h, border=True):
    im = Image.open(path)
    iw, ih = im.size
    scale = min(w / iw, h / ih)
    dw, dh = iw * scale, ih * scale
    if border:
        c.setFillColor(WHITE)
        c.setStrokeColor(LINE)
        c.roundRect(x, y, w, h, 10, fill=1, stroke=1)
    c.drawImage(ImageReader(im), x + (w - dw) / 2, y + (h - dh) / 2, dw, dh, preserveAspectRatio=True, mask='auto')


def pill(c, s, x, y, w, color=BLUE, bg=PALE):
    c.setFillColor(bg)
    c.roundRect(x, y, w, 28, 14, fill=1, stroke=0)
    c.setFillColor(color)
    c.setFont(FONT_B, 9)
    c.drawCentredString(x + w / 2, y + 9.5, s)


service_main = crop_asset("service-05.png", "crop_service_main.jpg", (1030, 90, 1980, 1040))
service_improve = crop_asset("service-06.png", "crop_service_improve.jpg", (1050, 90, 1980, 1040))
service_operate = crop_asset("service-07.png", "crop_service_operate.jpg", (1040, 95, 1980, 1030))
webtoon_1 = crop_asset("service-08.png", "crop_webtoon_1.jpg", (1020, 90, 1980, 1035))
webtoon_2 = crop_asset("service-09.png", "crop_webtoon_2.jpg", (1020, 90, 1980, 1035))
jeju = crop_asset("original_jeju-13.png", "crop_jeju.jpg", (930, 70, 1980, 1050))


c = canvas.Canvas(str(OUT), pagesize=(W, H), pageCompression=1)
c.setTitle("김가영 LG생활건강 HDB 국내영업 Experience Map")
c.setAuthor("김가영")
c.setSubject("고객 행동을 읽고 데이터로 판단해 실행으로 연결한 경험")


# PAGE 1 — COVER
c.setFillColor(WHITE)
c.rect(0, 0, W, H, fill=1, stroke=0)
c.setFillColor(NAVY)
c.rect(0, 0, 590, H, fill=1, stroke=0)
c.setFillColor(PALE)
c.circle(785, 425, 150, fill=1, stroke=0)
c.setFillColor(CYAN)
c.circle(900, 120, 76, fill=1, stroke=0)
c.setStrokeColor(BLUE)
c.setLineWidth(2)
c.circle(760, 170, 92, fill=0, stroke=1)
label(c, "2026 EXPERIENCE MAP", 58, 468, color=CYAN, bg=Color(1,1,1,alpha=.1), size=9)
c.setFillColor(WHITE)
c.setFont(FONT_B, 31)
c.drawString(58, 390, "LG생활건강")
c.setFont(FONT_B, 27)
c.drawString(58, 350, "HDB 국내영업 Experience Map")
c.setFillColor(CYAN)
c.rect(58, 319, 54, 4, fill=1, stroke=0)
text(c, "고객의 행동을 읽고,\n데이터로 판단하며,\n실행으로 연결하는 사람", 58, 275, 450, 20, WHITE, FONT_B, 30)
c.setFillColor(WHITE)
c.setFont(FONT_R, 10)
c.drawString(58, 66, "김가영  |  Home Care & Daily Beauty 국내영업 지원")
for i, (kw, desc) in enumerate([("Customer Insight", "선택 이유를 관찰"), ("Data", "근거로 판단"), ("Execution", "고객 접점에서 실행")]):
    yy = 390 - i * 100
    c.setFillColor(WHITE)
    c.roundRect(650, yy, 240, 68, 14, fill=1, stroke=0)
    c.setFillColor(BLUE)
    c.setFont(FONT_B, 13)
    c.drawString(670, yy + 38, kw)
    c.setFillColor(MUTED)
    c.setFont(FONT_R, 9.5)
    c.drawString(670, yy + 18, desc)
c.showPage()


# PAGE 2 — EXPERIENCE MAP
header(c, 2, "MY EXPERIENCE MAP", "고객 이해에서 실행까지, 국내영업을 준비해온 경험")
c.setStrokeColor(LINE)
c.setLineWidth(2)
c.line(155, 290, 805, 290)
items = [
    ("01", "고객 관찰", "취업일지", "약 50명 사용자의 실제 이용 흐름과 요구를 반영해 서비스 구조 개선", BLUE),
    ("02", "데이터 기반 판단", "웹툰 소비자 분석", "해외 소비자를 5개 유형으로 구분하고 유형별 전략 근거 도출", CYAN),
    ("03", "전략 기획·실행", "제주항공 IMC", "2030 구매행동 분석을 기반으로 온·오프라인 캠페인 기획", RED),
    ("04", "고객 커뮤니케이션", "입학팀", "약 3년간 다양한 문의·민원에 대응하고 고객별 맞춤 정보 제공", GREEN),
]
xs = [45, 270, 495, 720]
for x, (num, cap, exp, body, col) in zip(xs, items):
    c.setFillColor(col)
    c.circle(x + 86, 290, 24, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont(FONT_B, 10)
    c.drawCentredString(x + 86, 286.5, num)
    card(c, x, 120, 180, 125)
    c.setFillColor(col)
    c.setFont(FONT_B, 12)
    c.drawString(x + 16, 215, cap)
    c.setFillColor(INK)
    c.setFont(FONT_B, 13)
    c.drawString(x + 16, 188, exp)
    text(c, body, x + 16, 162, 148, 9.2, MUTED, FONT_R, 13.3)
c.setFillColor(NAVY)
c.roundRect(220, 360, 520, 66, 18, fill=1, stroke=0)
c.setFillColor(WHITE)
c.setFont(FONT_B, 20)
c.drawCentredString(480, 389, "관찰  →  분석  →  실행  →  개선")
text(c, "네 경험은 서로 다른 분야에 있었지만, 문제를 푸는 방식은 한 방향으로 이어졌습니다.", 210, 84, 560, 11, MUTED, FONT_R, 16)
c.showPage()


# PAGE 3 — JOB DIARY WHY
header(c, 3, "취업일지  |  CUSTOMER OBSERVATION", "사용자 행동에서 시작한 서비스 기획")
label(c, "PROBLEM", 38, 430)
text(c, "50명의 취업준비생,\n기록을 지속하게 만드는 방법", 38, 396, 400, 22, INK, FONT_B, 30)
text(c, "반복되는 취업 준비에서 참여자가 자신의 활동과 성장을 체감하고, 함께 준비를 이어갈 환경이 필요했습니다.", 38, 312, 380, 11.5, MUTED, FONT_R, 17)
card(c, 38, 120, 190, 115, fill=PALE2)
c.setFillColor(BLUE)
c.setFont(FONT_B, 32)
c.drawString(56, 188, "약 50명")
c.setFillColor(MUTED)
c.setFont(FONT_R, 9.5)
c.drawString(56, 160, "취업 커뮤니티 참여자·운영자")
card(c, 245, 120, 210, 115, fill=WHITE)
c.setFillColor(INK)
c.setFont(FONT_B, 11)
c.drawString(263, 203, "MY ROLE")
text(c, "문제 정의 · 이용 흐름 정의\n기능 우선순위 · 운영 정책 설계\n구현 검증 · 배포 · 피드백 반영", 263, 178, 175, 9.6, MUTED, FONT_R, 14)
img_fit(c, service_main, 500, 120, 420, 320)
sales_point(c, "고객이 실제로 행동하는 흐름을 먼저 보고, 필요한 경험과 운영 기준을 설계했습니다.")
c.showPage()


# PAGE 4 — OBSERVATION & ACTION
header(c, 4, "취업일지  |  OBSERVATION & ACTION", "말보다 행동을 보고, 서비스 구조를 바꾸다")
rows = [
    ("01", "하루 총 활동시간만 입력", "활동별 시간을 구분해 보고 싶다는 요구", "기록 항목을 세분화해 활동별 입력·확인이 가능하도록 개선"),
    ("02", "한 사용자 = 하나의 그룹", "여러 프로그램에 동시에 참여하는 실제 운영", "다중 그룹 구조로 전환하고 기존 데이터·관리자 배정·사용자 선택 흐름까지 수정"),
]
for i, (n, before, obs, action) in enumerate(rows):
    y = 285 - i * 145
    card(c, 38, y, 535, 120, fill=WHITE)
    c.setFillColor(BLUE)
    c.circle(70, y + 83, 18, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont(FONT_B, 9)
    c.drawCentredString(70, y + 79.5, n)
    label(c, "BEFORE", 101, y + 91, color=MUTED, bg=PALE2, size=8)
    text(c, before, 101, y + 70, 190, 10, INK, FONT_B, 14)
    label(c, "OBSERVATION", 295, y + 91, color=RED, bg=HexColor("#FCECEF"), size=8)
    text(c, obs, 295, y + 70, 245, 9.5, MUTED, FONT_R, 13)
    c.setFillColor(CYAN)
    c.roundRect(91, y + 12, 449, 32, 9, fill=1, stroke=0)
    c.setFillColor(NAVY)
    c.setFont(FONT_B, 9.5)
    c.drawString(105, y + 23, "ACTION")
    c.setFillColor(WHITE)
    c.setFont(FONT_R, 9.3)
    c.drawString(160, y + 22.5, action)
img_fit(c, service_improve, 600, 270, 320, 135)
img_fit(c, service_operate, 600, 120, 320, 135)
sales_point(c, "추측보다 실제 행동과 반응을 확인하고, 실행 이후 다음 개선으로 연결하는 태도를 익혔습니다.")
c.showPage()


# PAGE 5 — JEJU CUSTOMER INSIGHT
header(c, 5, "JEJU AIR  |  CUSTOMER INSIGHT", "2030의 구매행동에서 포인트 활성화의 실마리를 찾다")
card(c, 38, 118, 340, 305, fill=PALE2)
label(c, "PROBLEM", 58, 386)
text(c, "리프레시 포인트의\n인지도와 사용을 높일 전략", 58, 350, 286, 18, INK, FONT_B, 25)
label(c, "MY ROLE", 58, 275)
text(c, "조장 · 전략 기획 총괄\n콘텐츠 기획 및 제작", 58, 244, 280, 10.5, MUTED, FONT_R, 16)
label(c, "ACTION", 58, 184)
text(c, "2030 대상 설문을 직접 설계·배포하고, 인지도·구매행동·소비자 반응을 전략 방향의 근거로 활용했습니다.", 58, 153, 286, 10.5, MUTED, FONT_R, 15.5)
c.setFillColor(NAVY)
c.roundRect(415, 332, 505, 91, 16, fill=1, stroke=0)
c.setFillColor(WHITE)
c.setFont(FONT_B, 18)
c.drawString(440, 382, "콘텐츠보다 먼저, 고객의 인식과 행동을 확인")
c.setFillColor(CYAN)
c.setFont(FONT_R, 10)
c.drawString(440, 354, "Survey  →  Insight  →  Strategy")
topics = [("인지도", "포인트를 알고 있는가"), ("구매행동", "어떻게 선택·사용하는가"), ("소비자 반응", "무엇에 참여하는가")]
for i, (a,b) in enumerate(topics):
    x = 415 + i * 170
    card(c, x, 190, 155, 110, fill=WHITE)
    c.setFillColor([BLUE, CYAN, RED][i])
    c.circle(x + 28, 268, 10, fill=1, stroke=0)
    c.setFillColor(INK)
    c.setFont(FONT_B, 11)
    c.drawString(x + 18, 239, a)
    text(c, b, x + 18, 217, 120, 9, MUTED, FONT_R, 13)
process = [("01", "설문 설계·배포"), ("02", "구매행동 분석"), ("03", "전략 방향 결정")]
for i, (n, s) in enumerate(process):
    x = 415 + i * 170
    c.setFillColor(PALE2)
    c.roundRect(x, 118, 150, 55, 10, fill=1, stroke=0)
    c.setFillColor([BLUE, CYAN, RED][i])
    c.setFont(FONT_B, 8.5)
    c.drawString(x + 12, 150, n)
    c.setFillColor(INK)
    c.setFont(FONT_B, 9.5)
    c.drawString(x + 12, 132, s)
    if i < 2:
        c.setFillColor(MUTED)
        c.setFont(FONT_B, 13)
        c.drawString(x + 155, 137, "→")
sales_point(c, "구매행동을 먼저 확인한 뒤 프로모션 방향을 설계하는 데이터 기반 영업 사고를 보여줍니다.")
c.showPage()


# PAGE 6 — JEJU STRATEGY & EXECUTION
header(c, 6, "JEJU AIR  |  STRATEGY & EXECUTION", "분석을 온·오프라인 고객 경험으로 연결")
c.setFillColor(NAVY)
c.roundRect(38, 345, 884, 75, 18, fill=1, stroke=0)
c.setFillColor(WHITE)
c.setFont(FONT_B, 18)
c.drawString(65, 390, "Customer Insight")
c.setFont(FONT_R, 10)
c.drawString(65, 365, "2030의 포인트 인지도·구매행동·반응")
c.setFillColor(CYAN)
c.setFont(FONT_B, 22)
c.drawCentredString(480, 374, "→")
c.setFillColor(WHITE)
c.setFont(FONT_B, 18)
c.drawString(590, 390, "IMC Execution")
c.setFont(FONT_R, 10)
c.drawString(590, 365, "온라인 콘텐츠 + 오프라인 참여 경험")
card(c, 38, 122, 410, 195, fill=PALE2)
label(c, "ONLINE", 58, 283, color=BLUE, bg=WHITE)
online = [("인포머셜 숏폼", "포인트 적립률을 쉽게 전달"), ("바이럴 영상", "오징어게임 패러디로 관심 유도"), ("앱 이벤트", "디지털 접점의 참여 아이디어")]
for i,(a,b) in enumerate(online):
    yy=246-i*48
    c.setFillColor(BLUE); c.circle(66, yy+4, 5, fill=1, stroke=0)
    c.setFillColor(INK); c.setFont(FONT_B, 10.5); c.drawString(82, yy, a)
    c.setFillColor(MUTED); c.setFont(FONT_R, 9.2); c.drawString(190, yy, b)
card(c, 472, 122, 300, 195, fill=WHITE)
label(c, "OFFLINE", 492, 283, color=RED, bg=HexColor("#FCECEF"))
for i,s in enumerate(["대학 대항전", "간식차", "럭키드로우"]):
    y=238-i*48
    pill(c, s, 495, y, 250, color=RED, bg=HexColor("#FCECEF"))
card(c, 795, 122, 127, 195, fill=GOLD, stroke=GOLD)
c.setFillColor(NAVY)
c.setFont(FONT_B, 11)
c.drawCentredString(858.5, 273, "RESULT")
c.setFont(FONT_B, 29)
c.drawCentredString(858.5, 219, "대상")
text(c, "매경비즈\n직무스펙 프로젝트", 816, 181, 90, 8.5, NAVY, FONT_R, 13)
sales_point(c, "데이터를 보는 데서 끝내지 않고 프로모션과 고객 접점 전략으로 구체화했습니다.")
c.showPage()


# PAGE 7 — WEBTOON
header(c, 7, "WEBTOON  |  DATA TO CUSTOMER STRATEGY", "같은 콘텐츠도 고객마다 선택 이유는 달랐다")
card(c, 38, 122, 250, 302, fill=NAVY, stroke=NAVY)
c.setFillColor(CYAN)
c.setFont(FONT_B, 42)
c.drawString(62, 357, "5")
c.setFillColor(WHITE)
c.setFont(FONT_B, 18)
c.drawString(107, 369, "Customer Types")
text(c, "여러 데이터 소스를 결합해 해외 소비자의 반응을 5개 유형으로 구분했습니다.", 62, 318, 200, 10.5, WHITE, FONT_R, 16)
c.setStrokeColor(CYAN)
c.setLineWidth(1.5)
c.line(63, 265, 257, 265)
c.setFillColor(WHITE)
c.setFont(FONT_B, 10)
c.drawString(62, 242, "MY CONTRIBUTION")
text(c, "댓글 수집·전처리\n로지스틱 회귀분석\n구독자 예측모델·SHAP 해석", 62, 216, 200, 9.4, HexColor("#DCEAF1"), FONT_R, 15)
c.setFillColor(GOLD)
c.setFont(FONT_B, 10)
c.drawString(62, 149, "RESULT  |  데이터분석 부문 대상")
card(c, 315, 286, 605, 138, fill=PALE2)
c.setFillColor(INK)
c.setFont(FONT_B, 16)
c.drawString(340, 391, "분석 → 고객 세분화 → 유형별 전략")
for i, t in enumerate(["반응", "유형화", "선택 기준", "전략"]):
    x = 340 + i*135
    col=[BLUE,CYAN,GREEN,RED][i]
    c.setFillColor(col); c.circle(x+35, 339, 26, fill=1, stroke=0)
    c.setFillColor(WHITE); c.setFont(FONT_B, 9.5); c.drawCentredString(x+35, 335.5, t)
    if i<3:
        c.setFillColor(MUTED); c.setFont(FONT_B, 15); c.drawString(x+87, 334, "→")
img_fit(c, webtoon_1, 315, 122, 292, 145)
img_fit(c, webtoon_2, 628, 122, 292, 145)
sales_point(c, "채널별 고객 특성과 구매패턴을 구분해 상품 구성과 프로모션을 달리 설계하는 업무와 연결됩니다.")
c.showPage()


# PAGE 8 — CUSTOMER COMMUNICATION
header(c, 8, "CUSTOMER COMMUNICATION", "고객의 질문을 필요한 해결책으로 바꾸다")
card(c, 38, 120, 210, 305, fill=NAVY, stroke=NAVY)
c.setFillColor(CYAN)
c.setFont(FONT_B, 38)
c.drawString(60, 349, "약 3년")
c.setFillColor(WHITE)
c.setFont(FONT_B, 14)
c.drawString(60, 316, "대학 입학팀 근무")
text(c, "고객이 표현한 질문보다 그 뒤의 실제 필요를 파악해야 정확한 해결책을 제공할 수 있었습니다.", 60, 273, 166, 11, WHITE, FONT_R, 17)
contacts=["입학전형", "제출서류", "일정", "학교생활", "민원 접수"]
for i,s in enumerate(contacts):
    pill(c,s,60,145+i*30,145,color=NAVY,bg=WHITE)
steps=[("01","문의 유형 파악","상황과 필요한 정보를 구분"),("02","맞춤 정보 제공","고객별로 정확한 안내 전달"),("03","문서화·자료 관리","상담 내용과 유사 사례 축적"),("04","안내 개선","FAQ와 안내문 정비·신규 인턴 지원")]
for i,(n,a,b) in enumerate(steps):
    y=345-i*73
    c.setFillColor([BLUE,CYAN,GREEN,RED][i]); c.circle(302,y+15,18,fill=1,stroke=0)
    c.setFillColor(WHITE); c.setFont(FONT_B,8.5); c.drawCentredString(302,y+11.5,n)
    card(c, 335, y-8, 585, 48, fill=WHITE)
    c.setFillColor(INK); c.setFont(FONT_B,11); c.drawString(355,y+15,a)
    c.setFillColor(MUTED); c.setFont(FONT_R,9.5); c.drawString(510,y+15,b)
sales_point(c, "소비자·유통채널·내부 유관부서의 요구를 정확히 파악하고 필요한 정보를 전달하는 기반입니다.")
c.showPage()


# PAGE 9 — WHY LG SALES
header(c, 9, "WHY LG H&H SALES", "경험을 LG생활건강 국내영업의 성과로")
mappings = [
    ("사용자 행동 관찰", "소비자 구매패턴 분석"),
    ("고객 세분화·데이터 분석", "채널별 영업전략·포트폴리오 운영"),
    ("제주항공 IMC 기획", "프로모션·캠페인 기획·집행"),
    ("서비스 운영 후 개선", "영업정책 사후분석·고도화"),
    ("약 3년 고객 상담", "내·외부 고객 커뮤니케이션"),
]
for i,(left,right) in enumerate(mappings):
    y=376-i*57
    c.setFillColor(PALE2); c.roundRect(38,y,345,40,10,fill=1,stroke=0)
    c.setFillColor(INK); c.setFont(FONT_B,10.5); c.drawString(58,y+14,left)
    c.setFillColor(CYAN); c.setFont(FONT_B,18); c.drawCentredString(438,y+10,"→")
    c.setFillColor(NAVY); c.roundRect(492,y,430,40,10,fill=1,stroke=0)
    c.setFillColor(WHITE); c.setFont(FONT_B,10.5); c.drawString(512,y+14,right)
c.setFillColor(RED)
c.roundRect(92, 62, 776, 64, 18, fill=1, stroke=0)
c.setFillColor(WHITE)
c.setFont(FONT_B, 15)
c.drawCentredString(480, 98, "고객의 작은 구매 변화를 기회로 읽고")
c.setFont(FONT_R, 12)
c.drawCentredString(480, 76, "채널별 실행으로 연결하는 LG생활건강의 ‘뛰어난 장사꾼’이 되겠습니다.")
c.showPage()


# PAGE 10 — CLOSING
c.setFillColor(PALE)
c.rect(0, 0, W, H, fill=1, stroke=0)
c.setFillColor(NAVY)
c.rect(0, 0, 340, H, fill=1, stroke=0)
c.setFillColor(CYAN)
c.circle(170, 405, 78, fill=1, stroke=0)
c.setFillColor(WHITE)
c.setFont(FONT_B, 14)
c.drawCentredString(170, 410, "CUSTOMER")
c.setFont(FONT_R, 9)
c.drawCentredString(170, 388, "고객의 선택에서 시작")
c.setStrokeColor(WHITE)
c.setLineWidth(2)
c.line(170, 327, 170, 278)
c.setFillColor(WHITE)
c.setFont(FONT_B, 11)
c.drawCentredString(170, 305, "DATA  →  DECISION  →  EXECUTION")
c.setFillColor(WHITE)
c.setFont(FONT_R, 9)
c.drawCentredString(170, 70, "김가영  |  LG생활건강 HDB 국내영업 지원")
label(c, "CLOSING", 405, 440, color=BLUE, bg=WHITE)
text(c, "고객의 선택을 읽고,\n데이터로 기회를 발견하며,\n실행으로 성과를 만드는\n영업사원이 되겠습니다.", 405, 385, 475, 25, INK, FONT_B, 38)
c.setFillColor(CYAN)
c.rect(405, 205, 75, 5, fill=1, stroke=0)
text(c, "고객을 관찰하고 숫자로 판단하며,\n현장의 실행과 다음 개선까지 책임지겠습니다.", 405, 170, 450, 12, MUTED, FONT_R, 19)
c.setFillColor(NAVY)
c.setFont(FONT_B, 12)
c.drawString(405, 65, "LG생활건강  |  Home Care & Daily Beauty  |  국내영업")
c.showPage()

c.save()
print(OUT)
