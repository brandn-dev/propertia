import "server-only";

import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const HTML_PDF_RENDER_TIMEOUT_MS = 15000;

const CHROME_CANDIDATE_PATHS = [
  process.env.CHROME_BIN,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter((value): value is string => Boolean(value));

function getChromeBinaryPath() {
  return CHROME_CANDIDATE_PATHS[0] ?? null;
}

export async function renderHtmlInvoicePdfBuffer(url: string) {
  const chromeBinaryPath = getChromeBinaryPath();

  if (!chromeBinaryPath) {
    throw new Error("No Chrome binary configured for HTML PDF rendering.");
  }

  const tempDirectory = await mkdtemp(join(tmpdir(), "invoice-pdf-"));
  const profileDirectory = join(tempDirectory, "profile");
  const pdfPath = join(tempDirectory, "invoice.pdf");

  try {
    try {
      await execFileAsync(
        chromeBinaryPath,
        [
          "--headless=new",
          "--disable-gpu",
          "--disable-background-networking",
          "--disable-dev-shm-usage",
          "--no-first-run",
          "--no-default-browser-check",
          "--allow-pre-commit-input",
          "--run-all-compositor-stages-before-draw",
          "--virtual-time-budget=4000",
          `--user-data-dir=${profileDirectory}`,
          "--no-pdf-header-footer",
          `--print-to-pdf=${pdfPath}`,
          url,
        ],
        {
          timeout: HTML_PDF_RENDER_TIMEOUT_MS,
          killSignal: "SIGKILL",
        }
      );
    } catch (error) {
      if (!(await hasWrittenPdf(pdfPath))) {
        throw error;
      }
    }

    return readFile(pdfPath);
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
}

async function hasWrittenPdf(pdfPath: string) {
  try {
    const pdfStat = await stat(pdfPath);
    return pdfStat.size > 0;
  } catch {
    return false;
  }
}
