import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const workspaceDir = String.raw`C:\Users\user\Desktop\saeng\Saengjonil`;
const SKILL_DIR = String.raw`C:\Users\user\.codex\plugins\cache\openai-primary-runtime\presentations\26.909.12148\skills\presentations`;
const TMP_DIR = path.join(workspaceDir, "tmp", "pptx", "lg_editable");
const FINAL_PPTX = path.join(workspaceDir, "output", "pptx", "김가영_LG생활건강_국내영업_편집가능_v6.pptx");
const RUNTIME_PYTHON = String.raw`C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe`;
const assetDir = path.join(workspaceDir, "tmp", "pdfs", "lg_assets");
const extractedDir = path.join(workspaceDir, "tmp", "pptx", "lg_editable", "extracted");

const C = {
  side: "#DCEEF4", cyan: "#5CB0CA", blue: "#4A83B3", ink: "#34383B",
  muted: "#787E82", line: "#D2D7DA", pale: "#F2F8FA", white: "#FFFFFF",
  yellow: "#FFF3A6", softGray: "#F1F1F1",
};
const FONT = "Noto Sans KR";
const p = Presentation.create({ slideSize: { width: 1280, height: 720 } });

function box(slide, x, y, w, h, fill, radius = 0, line = "none") {
  return slide.shapes.add({
    geometry: radius ? "roundRect" : "rect",
    position: { left: x, top: y, width: w, height: h },
    fill,
    line: line === "none" ? { fill: "none", width: 0 } : { fill: line, width: 1 },
    ...(radius ? { borderRadius: radius } : {}),
  });
}

function text(slide, value, x, y, w, h, size, color = C.ink, bold = false, align = "left") {
  const s = slide.shapes.add({
    geometry: "textbox",
    position: { left: x, top: y, width: w, height: h },
    fill: "none",
    line: { fill: "none", width: 0 },
  });
  s.text = value;
  s.text.style = { typeface: FONT, fontSize: size, color, bold, alignment: align, autoFit: "shrinkText" };
  return s;
}

function line(slide, x, y, w, color = C.line, width = 1) {
  slide.shapes.add({ geometry: "rect", position: { left: x, top: y, width: w, height: width }, fill: color, line: { fill: "none", width: 0 } });
}

async function addImage(slide, filename, x, y, w, h, alt) {
  const bytes = await fs.readFile(path.join(assetDir, filename));
  slide.images.add({ blob: bytes, contentType: "image/png", alt, fit: "contain", position: { left: x, top: y, width: w, height: h } });
}

async function addJpeg(slide, filename, x, y, w, h, alt) {
  const bytes = await fs.readFile(path.join(assetDir, filename));
  slide.images.add({ blob: bytes, contentType: "image/jpeg", alt, fit: "contain", position: { left: x, top: y, width: w, height: h } });
}

async function addImageCrop(slide, filename, x, y, w, h, crop, alt) {
  const bytes = await fs.readFile(path.join(assetDir, filename));
  slide.images.add({
    blob: bytes,
    contentType: "image/png",
    alt,
    fit: "contain",
    crop,
    position: { left: x, top: y, width: w, height: h },
  });
}

async function addExtracted(slide, filename, x, y, w, h, alt) {
  const bytes = await fs.readFile(path.join(extractedDir, filename));
  slide.images.add({
    blob: bytes,
    contentType: "image/png",
    alt,
    fit: "contain",
    position: { left: x, top: y, width: w, height: h },
  });
}

function pageNumber(slide, n) {
  box(slide, 1160, 26, 54, 22, C.softGray, 11);
  text(slide, String(n), 1160, 27, 54, 18, 10, C.muted, false, "center");
}

function detailHeader(slide, index, titleValue, subtitle) {
  slide.background.fill = C.white;
  text(slide, "가영의 포트폴리오 | Gayoung’s Portfolio", 78, 25, 380, 18, 10, "#A5A5A5");
  pageNumber(slide, index + 2);
  text(slide, `프로젝트 상세 정보 (${index}/7)`, 78, 58, 560, 50, 31, C.cyan, true);
  text(slide, `${String(index).padStart(2, "0")}.`, 78, 150, 58, 34, 22, C.ink, true);
  text(slide, titleValue, 140, 150, 990, 38, 22, C.blue, true);
  text(slide, `: ${subtitle}`, 78, 188, 1080, 34, 18, C.ink);
}

function section(slide, label, y) {
  box(slide, 78, y + 1, 19, 19, C.cyan, 2);
  text(slide, "✓", 79, y - 1, 18, 20, 13, C.white, true, "center");
  text(slide, label, 108, y - 2, 460, 27, 17, C.ink, true);
}

function bullets(slide, items, x, y, w, gap = 30) {
  items.forEach((item, i) => {
    text(slide, "○", x, y + i * gap, 18, 22, 13, C.blue, true);
    text(slide, item, x + 25, y + i * gap, w - 25, 26, 15, C.muted);
  });
}

function meta(slide, period, form, role) {
  line(slide, 78, 630, 548);
  text(slide, "기간", 90, 642, 48, 22, 12, C.ink);
  text(slide, period, 160, 642, 220, 22, 12, C.ink);
  text(slide, "형태", 396, 642, 48, 22, 12, C.ink);
  text(slide, form, 460, 642, 170, 22, 12, C.ink);
  text(slide, "역할", 90, 671, 48, 22, 12, C.ink);
  text(slide, role, 160, 668, 466, 30, 11, C.ink);
  line(slide, 78, 707, 548);
}

function sales(slide, value) {
  box(slide, 690, 635, 500, 62, C.pale, 6);
  text(slide, "LG SALES POINT", 713, 648, 170, 20, 11, C.cyan, true);
  text(slide, value, 713, 670, 450, 22, 11, C.muted);
}

// Slide 1
{
  const s = p.slides.add();
  s.background.fill = C.white;
  box(s, 0, 0, 812, 720, C.side);
  box(s, 72, 105, 76, 20, C.white, 10);
  text(s, "2026년", 72, 107, 76, 16, 9, C.muted, false, "center");
  text(s, "LG생활건강", 72, 170, 440, 30, 18, C.ink);
  text(s, "국내영업 Experience Map", 72, 215, 650, 58, 38, C.ink, true);
  box(s, 72, 305, 95, 5, C.white);
  text(s, "고객의 행동을 읽고,\n데이터로 판단하며,\n실행으로 연결하는 사람", 72, 342, 550, 148, 25, C.ink, true);
  text(s, "김가영  |  LG생활건강 국내영업 지원", 72, 652, 560, 22, 12, C.muted);
  text(s, "P\nO\nR\nT\nF\nO\nL\nI\nO", 1030, 185, 70, 350, 20, "#C7DDE5", true, "center");
}

// Slide 2
{
  const s = p.slides.add();
  s.background.fill = C.white;
  box(s, 0, 0, 325, 720, C.side);
  text(s, "02", 72, 80, 90, 50, 32, C.blue, true);
  text(s, "가영의 포트폴리오 | Gayoung’s Portfolio", 72, 178, 230, 18, 9, "#9C9C9C");
  text(s, "Experience\nMap", 72, 215, 220, 90, 30, C.ink, true);
  box(s, 72, 330, 122, 5, C.white);
  await addExtracted(s, "service_p02_01_354x472.png", 97, 420, 122, 164, "김가영 증명사진");
  text(s, "김가영", 97, 592, 122, 24, 13, C.ink, true, "center");
  text(s, "고객 이해에서 실행까지", 380, 75, 600, 38, 28, C.cyan, true);
  text(s, "국내영업을 준비해온 경험", 380, 112, 660, 45, 28, C.ink, true);
  const rows = [
    ["01", "고객 관찰", "취업일지", "약 50명 사용자의 이용 흐름과 요구를 반영해 서비스 구조 개선"],
    ["02", "데이터 기반 판단", "웹툰 소비자 분석", "해외 소비자를 5개 유형으로 구분하고 유형별 전략 근거 도출"],
    ["03", "전략 기획·실행", "제주항공 IMC", "2030 구매행동 분석을 기반으로 온·오프라인 캠페인 기획"],
    ["04", "고객 커뮤니케이션", "입학팀", "약 3년간 문의·민원에 대응하고 고객별 맞춤 정보 제공"],
  ];
  rows.forEach((r, i) => {
    const y = 200 + i * 92;
    box(s, 380, y, 48, 32, C.cyan, 3);
    text(s, r[0], 380, y + 5, 48, 22, 11, C.white, true, "center");
    text(s, r[1], 455, y + 3, 155, 26, 14, C.ink, true);
    text(s, r[2], 625, y + 3, 175, 26, 13, C.blue, true);
    text(s, r[3], 805, y - 2, 390, 38, 12, C.muted);
    line(s, 455, y + 56, 740);
  });
  box(s, 380, 607, 815, 52, C.pale, 5);
  text(s, "관찰   분석   실행   개선", 405, 620, 270, 24, 16, C.blue, true);
  text(s, "고객의 선택을 이해하고 실행 가능한 전략으로 연결", 700, 621, 450, 22, 12, C.muted);
}

// Slide 3
{
  const s = p.slides.add();
  detailHeader(s, 1, "취업일지", "50명의 취업준비생, 기록을 지속하게 만드는 방법");
  section(s, "프로젝트 개요", 250);
  text(s, "취업 준비 활동과 목표를 기록하고 공유하는 서비스입니다. 참여자는 함께 준비하는 사람들의 활동을 확인하며 자신의 성장 과정을 볼 수 있습니다.", 78, 286, 548, 74, 15, C.muted);
  section(s, "고객과 나의 역할", 385);
  bullets(s, ["약 50명 규모 취업 커뮤니티의 참여자와 운영자", "사용자와 운영자의 이용 흐름과 필요한 정보 정의", "기능 우선순위와 운영 정책 설계", "구현 검증과 배포 후 사용자 피드백 반영"], 78, 425, 548, 31);
  await addExtracted(s, "service_p05_01_961x187.png", 680, 275, 520, 120, "취업일지 활동 기록 화면");
  await addExtracted(s, "service_p05_02_1010x230.png", 675, 425, 525, 145, "취업일지 주차별 활동 그래프");
  meta(s, "운영 경험", "개인 기획·운영", "문제 정의 · 요구사항/정책 설계 · 구현 검증 · 배포/운영");
  sales(s, "사용자의 행동을 관찰하고 실제 이용 흐름을 기준으로 서비스를 설계했습니다.");
}

// Slide 4
{
  const s = p.slides.add();
  detailHeader(s, 2, "취업일지", "사용자 요구와 서비스 구조 개선");
  section(s, "활동 기록 개선", 250);
  text(s, "총 활동시간만 입력하던 구조에서 활동별 시간을 확인하고 싶다는 요구를 반영했습니다.", 78, 286, 548, 58, 15, C.muted);
  box(s, 78, 350, 548, 42, C.pale, 4);
  text(s, "활동별 시간을 입력하고 확인하도록 기록 항목을 세분화", 94, 358, 510, 26, 14, C.blue, true);
  section(s, "조 세분화 기능", 420);
  text(s, "참여자를 조별로 세분화해 같은 조의 활동 기록을 한눈에 비교할 수 있도록 개선했습니다. 운영자는 조별 참여 현황을 더 쉽게 확인할 수 있습니다.", 78, 456, 548, 76, 15, C.muted);
  await addExtracted(s, "service_p06_01_962x270.png", 680, 245, 520, 145, "활동별 시간 입력 화면");
  await addExtracted(s, "service_p06_02_965x390.png", 680, 410, 520, 175, "조별 활동 비교 화면");
  meta(s, "운영 경험", "개인 기획·운영", "사용자 요구 반영 · 활동별 입력 개선 · 조별 활동 기록 비교");
  sales(s, "실제 행동과 반응을 확인하고 실행 이후의 개선까지 연결했습니다.");
}

// Slide 5
{
  const s = p.slides.add();
  detailHeader(s, 3, "제주항공 리프레시 포인트", "2030의 구매행동에서 포인트 활성화의 실마리를 찾다");
  section(s, "프로젝트 개요", 250);
  text(s, "2030 고객의 포인트 인지도와 사용을 높이기 위해 콘텐츠를 만들기 전에 고객이 포인트를 어떻게 인식하고 사용하는지 확인했습니다.", 78, 286, 548, 78, 15, C.muted);
  section(s, "고객 조사와 판단", 395);
  bullets(s, ["2030 대상 설문조사를 직접 설계하고 배포", "포인트 인지도와 구매행동, 소비자 반응 분석", "조사 결과를 온·오프라인 전략 방향의 근거로 활용"], 78, 435, 548, 34);
  section(s, "나의 역할", 555);
  text(s, "조장 · 전략 기획 총괄 · 콘텐츠 기획 및 제작", 78, 590, 548, 28, 15, C.muted);
  await addExtracted(s, "original_p13_01_694x390.png", 675, 265, 525, 295, "제주항공 3C 분석과 전략 수립 자료");
  meta(s, "2024.10.12 ~ 2025.02.07", "10인 프로젝트", "조장 · 기획 총괄 · 콘텐츠 기획 및 제작");
  sales(s, "구매행동을 먼저 확인한 뒤 프로모션 방향을 설계했습니다.");
}

// Slide 6
{
  const s = p.slides.add();
  detailHeader(s, 4, "제주항공 리프레시 포인트", "온·오프라인 고객 경험으로 전략 실행");
  section(s, "온라인 실행", 250);
  bullets(s, ["포인트 적립률을 전달하는 인포머셜 숏폼", "오징어게임 패러디 바이럴 영상", "앱 기반 고객 참여 이벤트 아이디어"], 78, 290, 548, 33);
  section(s, "오프라인 실행", 420);
  bullets(s, ["대학 대항전과 간식차", "럭키드로우 등 고객 참여 아이디어"], 78, 460, 548, 33);
  section(s, "결과", 555);
  box(s, 78, 590, 548, 34, C.yellow, 4);
  text(s, "매경비즈 직무스펙 프로젝트 대상", 96, 595, 500, 24, 15, C.ink, true);
  await addExtracted(s, "original_p13_02_696x390.png", 675, 245, 525, 180, "제주항공 숏폼 콘텐츠 기획안");
  await addExtracted(s, "original_p13_03_223x384.png", 720, 435, 180, 165, "제주항공 바이럴 영상 이미지");
  await addExtracted(s, "original_p13_04_203x375.png", 970, 435, 180, 165, "제주항공 인포머셜 숏폼 이미지");
  meta(s, "2024.10.12 ~ 2025.02.07", "10인 프로젝트", "소비자 조사 기반 IMC 전략 · 온·오프라인 콘텐츠 기획/제작");
  sales(s, "분석을 프로모션과 고객 접점의 실행안으로 구체화했습니다.");
}

// Slide 7
{
  const s = p.slides.add();
  detailHeader(s, 5, "한국 웹툰 소비자 분석", "고객마다 다른 선택 기준을 유형별 전략으로 연결");
  section(s, "프로젝트 개요", 250);
  text(s, "한국 웹툰의 글로벌 진출을 위해 여러 데이터 소스를 활용해 해외 소비자의 반응과 흥행 요인을 분석했습니다.", 78, 286, 548, 64, 15, C.muted);
  section(s, "고객 세분화와 전략", 385);
  bullets(s, ["팀: 해외 소비자 반응을 5개 유형으로 구분", "팀: 소비자 유형별 마케팅과 해외 진출 전략 제안", "본인: 댓글 수집과 전처리, 로지스틱 회귀분석", "본인: 구독자 예측모델과 SHAP 영향요인 해석"], 78, 425, 548, 31);
  box(s, 78, 566, 548, 40, C.yellow, 4);
  text(s, "문화데이터 공모전 데이터분석 부문 대상", 96, 574, 500, 26, 15, C.ink, true);
  await addExtracted(s, "original_p06_01_601x334.png", 675, 245, 250, 150, "웹툰 해외 소비자 연구 필요성 도표");
  await addExtracted(s, "original_p06_02_620x343.png", 945, 245, 250, 150, "웹툰 댓글 네트워크 분석 도표");
  await addExtracted(s, "original_p06_03_625x342.png", 675, 420, 250, 165, "웹툰 소비자 유형 분석 도표");
  await addExtracted(s, "original_p06_04_617x336.png", 945, 420, 250, 165, "웹툰 구독자 예측 결과 도표");
  meta(s, "2024.07", "4인 팀 프로젝트", "댓글 수집·전처리 · 로지스틱 회귀 · 구독자 예측모델 · SHAP");
  sales(s, "고객군에 따라 선택 기준이 달라 채널별 전략도 달라야 함을 배웠습니다.");
}

// Slide 8
{
  const s = p.slides.add();
  detailHeader(s, 6, "고객 커뮤니케이션", "고객의 질문을 필요한 해결책으로 바꾸다");
  section(s, "약 3년의 고객 접점", 250);
  text(s, "대학 입학팀에서 입학전형과 제출서류, 일정, 학교생활 문의와 민원에 대응했습니다.", 78, 286, 548, 58, 15, C.muted);
  section(s, "내가 한 일", 385);
  bullets(s, ["문의 유형과 고객의 상황을 파악해 맞춤 정보 제공", "상담 내용을 문서화하고 유사 사례 대응 자료 관리", "FAQ와 안내문 정비", "신규 인턴의 업무 이해 지원"], 78, 425, 548, 31);
  section(s, "배운 점", 560);
  text(s, "질문 뒤에 있는 실제 필요를 파악해야 정확한 해결책을 제공할 수 있었습니다.", 78, 596, 548, 30, 14, C.muted);
  box(s, 690, 245, 500, 345, C.pale, 6);
  const steps = [["01", "문의 파악", "질문의 상황과 필요한 정보 구분"], ["02", "맞춤 안내", "고객별로 정확한 정보 전달"], ["03", "기록과 관리", "상담 내용과 유사 사례 축적"], ["04", "안내 개선", "FAQ와 안내문 정비"]];
  steps.forEach((r, i) => {
    const y = 285 + i * 72;
    box(s, 720, y, 38, 38, C.cyan, 19);
    text(s, r[0], 720, y + 8, 38, 22, 10, C.white, true, "center");
    text(s, r[1], 785, y, 135, 25, 15, C.ink, true);
    text(s, r[2], 785, y + 27, 340, 24, 12, C.muted);
  });
  meta(s, "약 3년", "입학팀 근무", "고객 문의·민원 응대 · 문서화 · FAQ/안내문 정비");
  sales(s, "내·외부 고객의 요구를 파악하고 필요한 정보를 정확히 전달하는 경험입니다.");
}

// Slide 9
{
  const s = p.slides.add();
  detailHeader(s, 7, "LG생활건강 국내영업", "지원자 경험과 국내영업 업무의 연결");
  section(s, "경험과 업무", 250);
  const left = ["사용자 행동 관찰", "고객 세분화와 데이터 분석", "제주항공 IMC 기획", "서비스 운영 후 개선", "약 3년 고객 상담"];
  const right = ["소비자 구매패턴 분석", "채널별 영업전략과 상품 운영", "프로모션과 캠페인 기획", "영업정책 사후분석과 고도화", "내·외부 고객 커뮤니케이션"];
  left.forEach((v, i) => {
    const y = 300 + i * 58;
    box(s, 78, y, 440, 38, C.pale, 4);
    text(s, v, 96, y + 7, 400, 24, 14, C.ink, true);
    line(s, 530, y + 19, 55, C.cyan, 2);
    box(s, 600, y, 590, 38, C.side, 4);
    text(s, right[i], 618, y + 7, 550, 24, 14, C.blue, true);
  });
  box(s, 78, 610, 1112, 70, C.blue, 6);
  text(s, "고객의 작은 구매 변화를 기회로 읽고", 100, 620, 1068, 28, 18, C.white, true, "center");
  text(s, "채널별 실행으로 연결하는 LG생활건강의 ‘뛰어난 장사꾼’이 되겠습니다.", 100, 650, 1068, 24, 13, C.white, false, "center");
}

// Slide 10
{
  const s = p.slides.add();
  s.background.fill = C.side;
  box(s, 205, 150, 690, 425, C.white);
  box(s, 255, 192, 235, 28, "#203B63");
  text(s, "가영의 포트폴리오 | Gayoung’s Portfolio", 255, 198, 235, 16, 9, C.white, false, "center");
  text(s, "감사합니다.", 255, 252, 280, 50, 34, "#203B63", true);
  line(s, 255, 316, 235, "#203B63", 2);
  text(s, "고객의 선택을 읽고,\n데이터로 기회를 발견하며,\n실행으로 성과를 만드는\n영업사원이 되겠습니다.", 255, 345, 550, 145, 23, C.ink, true);
  text(s, "김가영입니다.", 255, 510, 220, 32, 20, C.ink, true);
  text(s, "LG생활건강 국내영업 지원", 255, 545, 530, 22, 11, C.muted);
  text(s, "Thank you", 1040, 560, 150, 22, 12, C.muted, false, "right");
  text(s, "김가영 | 010-2923-3450 | kk991011@gmail.com", 78, 660, 430, 20, 10, C.muted);
}

const requirements = {
  explicitTotalSlideCount: 10,
  requiredNativeTableOwnerSlides: [],
  requiredNativeChartOwnerSlides: [],
};
const fontPolicy = { basis: "design", families: [FONT] };
const expectedSlideSizeEmu = "12192000,6858000";
const { finalizePresentation } = await import(pathToFileURL(path.join(SKILL_DIR, "container_tools/artifact_tool_utils.mjs")).href);
const stagingDir = path.join(workspaceDir, ".codex-finalizer", "lg_editable_v6");
await fs.mkdir(stagingDir, { recursive: true });
await fs.mkdir(path.dirname(FINAL_PPTX), { recursive: true });
const candidatePath = path.join(stagingDir, "candidate.pptx");
await (await PresentationFile.exportPptx(p)).save(candidatePath);
await finalizePresentation({
  ...requirements,
  workspaceDir,
  candidatePath,
  finalPath: FINAL_PPTX,
  pythonExecutable: RUNTIME_PYTHON,
  integrityValidatorPath: path.join(SKILL_DIR, "container_tools/inspect_presentation_package_integrity.py"),
  layoutValidatorPath: path.join(SKILL_DIR, "container_tools/inspect_presentation_layout_geometry.py"),
  layoutArgs: ["--expected-slide-size-emu", expectedSlideSizeEmu, "--validate-heading-fit"],
  requiredNativeTableOwnerSlides: [],
  fontPolicy,
  verifyArtifactToolImport: true,
  receiptPath: path.join(stagingDir, "validation.json"),
});
console.log(FINAL_PPTX);
