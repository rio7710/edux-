import puppeteer, { type Browser } from 'puppeteer';
import * as path from 'path';
import * as fs from 'fs/promises';
import { logger } from './logger.js';

// ─── 설정 ────────────────────────────────────────────────────────────────────
const PDF_OUTPUT_DIR = path.resolve(process.cwd(), 'public', 'pdf');

// 브라우저당 처리 가능한 최대 job 수. 초과 시 재시작(메모리 누수 방지)
const BROWSER_MAX_JOBS = parseInt(process.env.PDF_BROWSER_MAX_JOBS || '50', 10);

// ─── 브라우저 싱글톤 ──────────────────────────────────────────────────────────
let _browser: Browser | null = null;
let _jobCount = 0;
let _launching = false;

const LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
];

async function getBrowser(): Promise<Browser> {
  // 이미 기동 중이면 대기
  while (_launching) {
    await new Promise((r) => setTimeout(r, 100));
  }

  // 재시작 조건: 브라우저 없음 OR 연결 끊김 OR max jobs 초과
  const needRestart =
    !_browser ||
    !_browser.connected ||
    _jobCount >= BROWSER_MAX_JOBS;

  if (needRestart) {
    _launching = true;
    try {
      if (_browser) {
        try {
          await _browser.close();
        } catch {
          // 강제 종료 실패 무시
        }
        _browser = null;
      }
      _browser = await puppeteer.launch({
        headless: true,
        args: LAUNCH_ARGS,
      });
      _jobCount = 0;
      logger.info('pdf.browser.launched', { maxJobs: BROWSER_MAX_JOBS });
    } finally {
      _launching = false;
    }
  }

  return _browser!;
}

// ─── PDF 변환 ─────────────────────────────────────────────────────────────────
async function ensurePdfOutputDir() {
  await fs.mkdir(PDF_OUTPUT_DIR, { recursive: true });
}

export async function convertHtmlToPdf(htmlContent: string, pdfFileName: string): Promise<string> {
  await ensurePdfOutputDir();

  const browser = await getBrowser();
  _jobCount += 1;
  const page = await browser.newPage();

  try {
    // 콘텐츠 로드: DOM + 네트워크 안정 후 폰트까지 대기
    await page.setContent(htmlContent, { waitUntil: ['load', 'networkidle0'] });
    await page.evaluate(() => (document as any).fonts.ready);

    const pdfPath = path.join(PDF_OUTPUT_DIR, pdfFileName);
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
    });

    return `/pdf/${pdfFileName}`;
  } finally {
    // 페이지는 항상 닫아서 리소스 해제
    await page.close().catch(() => undefined);
  }
}

// ─── 워커 종료 시 브라우저 정리 ───────────────────────────────────────────────
export async function closeBrowser(): Promise<void> {
  if (_browser) {
    try {
      await _browser.close();
    } catch {
      // 무시
    }
    _browser = null;
  }
}
