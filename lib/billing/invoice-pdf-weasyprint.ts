import "server-only";

import { execFile } from "node:child_process";

const HTML_PDF_RENDER_TIMEOUT_MS = 15000;
const HTML_PDF_RENDER_MAX_BUFFER_BYTES = 24 * 1024 * 1024;
const WEASYPRINT_CANDIDATE_PATHS = [
  process.env.WEASYPRINT_BIN,
  ".venv/bin/weasyprint",
  "/opt/homebrew/bin/weasyprint",
  "/usr/local/bin/weasyprint",
  "weasyprint",
].filter((value): value is string => Boolean(value));

export async function renderHtmlInvoicePdfBuffer(url: string) {
  try {
    const stdout = await execWeasyPrint(url);

    if (stdout.length === 0) {
      throw new Error("WeasyPrint returned an empty PDF response.");
    }

    return stdout;
  } catch (error) {
    if (isWeasyPrintMissing(error)) {
      throw new Error(
        'WeasyPrint CLI not found. Install `weasyprint` or set `WEASYPRINT_BIN` to its executable path.'
      );
    }

    throw error;
  }
}

function execWeasyPrint(url: string) {
  return execWeasyPrintAt(url, 0);
}

function execWeasyPrintAt(url: string, candidateIndex: number): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const command = WEASYPRINT_CANDIDATE_PATHS[candidateIndex];

    execFile(
      command,
      [
        "--timeout",
        String(Math.ceil(HTML_PDF_RENDER_TIMEOUT_MS / 1000)),
        "--presentational-hints",
        "--media-type",
        "print",
        url,
        "-",
      ],
      {
        encoding: "buffer",
        maxBuffer: HTML_PDF_RENDER_MAX_BUFFER_BYTES,
        timeout: HTML_PDF_RENDER_TIMEOUT_MS,
        killSignal: "SIGKILL",
      },
      (error, stdout, stderr) => {
        if (error) {
          if (isWeasyPrintMissing(error) && candidateIndex < WEASYPRINT_CANDIDATE_PATHS.length - 1) {
            resolve(execWeasyPrintAt(url, candidateIndex + 1));
            return;
          }

          if (stderr.length > 0) {
            error.message = `${error.message}\n${stderr.toString("utf8").trim()}`;
          }

          reject(error);
          return;
        }

        resolve(Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout));
      }
    );
  });
}

function isWeasyPrintMissing(error: unknown) {
  return (
    error instanceof Error &&
    "code" in error &&
    typeof error.code === "string" &&
    error.code === "ENOENT"
  );
}
