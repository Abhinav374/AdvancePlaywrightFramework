import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';

interface CustomReporterOptions {
  outputFile?: string;
}

interface ReportedTest {
  title: string;
  file: string;
  line: number;
  status: string;
  duration: number;
  error: string;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character];
  });
}

export default class CustomReporter implements Reporter {
  private readonly outputFile: string;
  private readonly tests = new Map<string, ReportedTest>();
  private startedAt = new Date();

  constructor(options: CustomReporterOptions = {}) {
    this.outputFile = resolve(options.outputFile ?? 'playwright-report/custom-report.html');
  }

  onBegin(_config: FullConfig, _suite: Suite): void {
    this.startedAt = new Date();
    this.tests.clear();
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    this.tests.set(test.id, {
      title: test.titlePath().filter(Boolean).join(' › '),
      file: test.location.file,
      line: test.location.line,
      status: result.status,
      duration: result.duration,
      error: result.errors.map((error) => error.message ?? String(error)).join('\n'),
    });
  }

  async onEnd(result: FullResult): Promise<void> {
    const tests = Array.from(this.tests.values());
    const counts = {
      passed: tests.filter((test) => test.status === 'passed').length,
      failed: tests.filter((test) => test.status === 'failed' || test.status === 'timedOut').length,
      skipped: tests.filter((test) => test.status === 'skipped').length,
      other: tests.filter(
        (test) => !['passed', 'failed', 'timedOut', 'skipped'].includes(test.status),
      ).length,
    };
    const rows = tests.map((test) => `
      <tr>
        <td><span class="badge ${escapeHtml(test.status)}">${escapeHtml(test.status)}</span></td>
        <td>${escapeHtml(test.title)}</td>
        <td>${escapeHtml(test.file)}:${test.line}</td>
        <td>${(test.duration / 1000).toFixed(2)}s</td>
        <td><pre>${escapeHtml(test.error || '—')}</pre></td>
      </tr>`).join('');

    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Playwright Custom Report</title>
  <style>
    :root { color-scheme: light; font: 15px/1.5 system-ui, sans-serif; color: #172033; background: #f3f5f9; }
    body { max-width: 1200px; margin: 40px auto; padding: 0 20px; }
    h1 { margin-bottom: 4px; }
    .meta { color: #596579; margin-top: 0; }
    .summary { display: flex; gap: 12px; flex-wrap: wrap; margin: 24px 0; }
    .card { background: white; border-radius: 8px; padding: 14px 20px; box-shadow: 0 1px 4px #18243a1a; }
    .card strong { display: block; font-size: 24px; }
    table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; }
    th, td { padding: 12px; text-align: left; vertical-align: top; border-bottom: 1px solid #e5e9f0; }
    th { background: #e9edf5; }
    pre { white-space: pre-wrap; overflow-wrap: anywhere; margin: 0; color: #9a2634; }
    .badge { display: inline-block; border-radius: 12px; padding: 2px 9px; background: #e8edf5; }
    .passed { color: #176b3a; background: #e2f5e9; }
    .failed, .timedOut { color: #a32332; background: #fde7e8; }
    .skipped { color: #725500; background: #fff3cd; }
    .empty { padding: 20px; color: #596579; }
  </style>
</head>
<body>
  <h1>Playwright Custom Report</h1>
  <p class="meta">Run status: ${escapeHtml(result.status)} · Started: ${escapeHtml(this.startedAt.toLocaleString())}</p>
  <section class="summary" aria-label="Test summary">
    <div class="card">Total<strong>${tests.length}</strong></div>
    <div class="card">Passed<strong>${counts.passed}</strong></div>
    <div class="card">Failed<strong>${counts.failed}</strong></div>
    <div class="card">Skipped<strong>${counts.skipped}</strong></div>
    <div class="card">Other<strong>${counts.other}</strong></div>
  </section>
  ${tests.length
    ? `<table><thead><tr><th>Status</th><th>Test</th><th>Location</th><th>Duration</th><th>Error</th></tr></thead><tbody>${rows}</tbody></table>`
    : '<p class="empty">No tests were executed. Check the Playwright output for collection or configuration errors.</p>'}
</body>
</html>`;

    await mkdir(dirname(this.outputFile), { recursive: true });
    await writeFile(this.outputFile, html, 'utf8');
    console.log(`Custom HTML report written to ${this.outputFile}`);
  }
}
