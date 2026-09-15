from pathlib import Path

from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas


WORKSPACE = Path(r"C:/Users/user/Desktop/saeng/Saengjonil")
PAGES_DIR = WORKSPACE / "tmp" / "pdfs" / "lg_portfolio_v6_pages"
OUTPUT = WORKSPACE / "output" / "pdf" / "김가영_LG생활건강_국내영업_포트폴리오.pdf"

PAGE_WIDTH = 13.3333 * 72
PAGE_HEIGHT = 7.5 * 72

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
page_images = sorted(PAGES_DIR.glob("slide-*.png"), key=lambda p: int(p.stem.split("-")[-1]))
if len(page_images) != 10:
    raise RuntimeError(f"Expected 10 rendered slides, found {len(page_images)}")

pdf = canvas.Canvas(str(OUTPUT), pagesize=(PAGE_WIDTH, PAGE_HEIGHT), pageCompression=1)
pdf.setTitle("김가영 LG생활건강 국내영업 포트폴리오")
pdf.setAuthor("김가영")
pdf.setSubject("LG생활건강 국내영업 지원 포트폴리오")

for page_image in page_images:
    pdf.drawImage(
        ImageReader(str(page_image)),
        0,
        0,
        width=PAGE_WIDTH,
        height=PAGE_HEIGHT,
        preserveAspectRatio=True,
        anchor="c",
        mask="auto",
    )
    pdf.showPage()

pdf.save()
print(OUTPUT)
