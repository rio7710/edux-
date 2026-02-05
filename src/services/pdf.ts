import puppeteer from 'puppeteer';
import * as path from 'path';
import * as fs from 'fs/promises';

// Ensure the PDF output directory exists
const PDF_OUTPUT_DIR = path.resolve(process.cwd(), 'public', 'pdf');

async function ensurePdfOutputDir() {
  await fs.mkdir(PDF_OUTPUT_DIR, { recursive: true });
}

export async function convertHtmlToPdf(htmlContent: string, pdfFileName: string): Promise<string> {
  await ensurePdfOutputDir();
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Set content and wait for it to load
  await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

  const pdfPath = path.join(PDF_OUTPUT_DIR, pdfFileName);
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
  });

  await browser.close();
  return `/pdf/${pdfFileName}`; // Return relative URL for client
}