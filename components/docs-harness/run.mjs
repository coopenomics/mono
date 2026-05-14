#!/usr/bin/env node
// Runner: `node run.mjs <scenario>` — например `node run.mjs auth/signin`.
// Загружает сценарий из ./scenarios/<arg>.mjs, прогоняет, пишет скриншоты и manifest
// в ./shots/<arg>/.

import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { openBrowser, makeShotContext, expect, env, HARNESS_ROOT } from './lib/harness.mjs';

const arg = process.argv[2];
if (!arg) {
  console.error('Usage: node run.mjs <scenario-name>  (e.g. auth/signin)');
  process.exit(2);
}

const scenarioPath = path.join(HARNESS_ROOT, 'scenarios', `${arg}.mjs`);
const outDir = path.join(HARNESS_ROOT, 'shots', arg);

await fs.rm(outDir, { recursive: true, force: true });
await fs.mkdir(outDir, { recursive: true });

console.log(`▶ scenario: ${arg}`);
console.log(`  base=${env.BASE_URL}  coop=${env.COOPNAME}  out=${outDir}`);

const mod = await import(pathToFileURL(scenarioPath));
if (typeof mod.default !== 'function') throw new Error(`Scenario ${arg} must export default async function`);

const { browser, context, page, consoleLog } = await openBrowser();
const { shot, writeManifest } = makeShotContext({ scenarioName: arg, outDir });

let failure = null;
try {
  await mod.default({ page, context, shot, expect, env });
  const manifest = await writeManifest(mod.meta ?? {});
  console.log(`✓ ${manifest.shots.length} shots saved`);
} catch (e) {
  failure = e;
  console.error(`✗ scenario failed: ${e.message}`);
  await page.screenshot({ path: path.join(outDir, 'FAIL.png'), fullPage: true }).catch(() => {});
  await fs.writeFile(path.join(outDir, 'console.log'), consoleLog.join('\n'));
} finally {
  await browser.close();
}

if (failure) process.exit(1);
