from pathlib import Path
from pypdf import PdfReader

out = Path(r"C:\Users\user\Desktop\saeng\Saengjonil\tmp\pptx\lg_editable\extracted")
out.mkdir(parents=True, exist_ok=True)

sources = [
    ("service", Path(r"C:\Users\user\Desktop\취업\포트폴리오\최종 포트폴리오\2026\김가영_서비스사업기획.pdf"), [2, 5, 6, 7, 8, 9]),
    ("original", Path(r"C:\Users\user\Desktop\취업\포트폴리오\최종 포트폴리오\2026\포트폴리오.pdf"), [6, 13]),
]

for prefix, pdf_path, pages in sources:
    reader = PdfReader(str(pdf_path))
    for page_no in pages:
        page = reader.pages[page_no - 1]
        seen = set()
        kept = 0
        for idx, image_file in enumerate(page.images):
            data = image_file.data
            if len(data) < 3000:
                continue
            key = (len(data), data[:32])
            if key in seen:
                continue
            seen.add(key)
            im = image_file.image.convert("RGB")
            if im.width < 120 or im.height < 80:
                continue
            kept += 1
            target = out / f"{prefix}_p{page_no:02d}_{kept:02d}_{im.width}x{im.height}.png"
            im.save(target)
            print(target.name, len(data))
