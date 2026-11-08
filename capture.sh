#!/usr/bin/env bash
set -euo pipefail
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"
: "${CAPTURE_URL:?Set CAPTURE_URL to the exact preview URL.}"
: "${CAPTURE_DIR:?Set CAPTURE_DIR to an output directory outside the project.}"
case "$CAPTURE_DIR/" in
  "$PROJECT_DIR/"*) echo "CAPTURE_DIR must be outside the source project: $CAPTURE_DIR" >&2; exit 1 ;;
esac
/usr/bin/time -p mkdir -p "$CAPTURE_DIR"
/usr/bin/time -p node --input-type=module - "$CAPTURE_URL" "$CAPTURE_DIR" <<'NODE'
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const [url, output] = process.argv.slice(2);
const runtime = join(process.env.HOME, '.local/share/omgithub-playwright');
const require = createRequire(join(runtime, 'package.json'));
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (error) {
  console.error(`Browser automation is unavailable: ${error.message}`);
  process.exit(75);
}
let config;
try {
  config = JSON.parse(readFileSync(join(runtime, 'linux.json'), 'utf8'));
  if (process.platform === 'linux') process.env.DISPLAY ||= ':' + readFileSync(join(runtime, 'display'), 'utf8').trim();
} catch (error) {
  console.error(`Browser runtime configuration is unavailable: ${error.message}`);
  process.exit(75);
}
const transient = error => Object.assign(error instanceof Error ? error : new Error(String(error)), { exitCode: 75 });
let browser;
let exitCode = 0;
try {
  browser = await chromium.launch({ ...config.browser.launchOptions, timeout: 30000 }).catch(error => { throw transient(error); });
  for (const [name, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 }).catch(error => { throw transient(error); });
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    let response;
    try {
      response = await page.goto(url, { waitUntil: 'load', timeout: 45000 });
    } catch (error) {
      await page.close().catch(() => {});
      throw transient(new Error(`Navigation to ${url} failed: ${error.message}`));
    }
    if (!response?.ok()) {
      const status = response?.status();
      await page.close().catch(() => {});
      const code = !response || [408, 425, 429, 500, 502, 503, 504].includes(status) ? 75 : 1;
      throw Object.assign(new Error(`Preview returned HTTP ${status ?? 'no response'}: ${url}`), { exitCode: code });
    }
    try {
      await page.locator('#game canvas').waitFor({ state: 'visible', timeout: 30000 });
      await page.waitForFunction(() => {
        const canvas = document.querySelector('#game canvas');
        return document.title.includes('BUSCADOS') && canvas && canvas.width >= 300 && canvas.height >= 200 && canvas.getBoundingClientRect().width > 0;
      }, { timeout: 30000 });
      await page.evaluate(() => document.fonts.ready);
      const start = page.locator('#start-btn');
      if (await start.count()) await start.click({ timeout: 5000 });
      await page.waitForTimeout(1400);
      if (pageErrors.length) throw new Error(`JavaScript rendering error: ${pageErrors.join('; ')}`);
      await page.screenshot({ path: join(output, `final-${name}.png`), timeout: 30000 });
      console.log(`Saved ${name} screenshot (${width}x${height}) to ${join(output, `final-${name}.png`)}`);
    } catch (error) {
      if (!browser.isConnected()) throw transient(error);
      throw Object.assign(error, { exitCode: error.exitCode || 1 });
    } finally {
      await page.close().catch(() => {});
    }
  }
} catch (error) {
  console.error(error);
  exitCode = error.exitCode || 1;
} finally {
  if (browser) {
    try { await browser.close(); }
    catch (error) { console.error(`Could not close capture browser cleanly: ${error.message}`); exitCode ||= 75; }
  }
}
process.exitCode = exitCode;
NODE
