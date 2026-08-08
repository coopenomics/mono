#!/usr/bin/env node
// Runner: `node run.mjs <scenario>` — например `node run.mjs auth/signin`.
// Загружает сценарий из ./scenarios/<arg>.mjs, прогоняет, пишет скриншоты,
// manifest и ВЕРДИКТ в ./shots/<arg>/.
//
// Сценарий — один артефакт на три задачи (см. GOAL.md): тест, кадры для
// документации, запись в test-registry/. Вердикт выносится не только по
// ассертам сценария: JS-исключение на странице и 400/5xx от сервера роняют
// прогон сами по себе, поэтому даже сценарий без единого expect работает как
// смоук-тест.
//
// result.json потребляет bin/registry-sync.mjs — из него в реестр едет
// status (passing только для зелёного прогона).

import path from 'node:path';
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { openBrowser, makeShotContext, expect, env, HARNESS_ROOT } from './lib/harness.mjs';

const arg = process.argv[2];
if (!arg) {
  console.error('Usage: node run.mjs <scenario-name>  (e.g. auth/signin)');
  process.exit(2);
}

const scenarioPath = path.join(HARNESS_ROOT, 'scenarios', `${arg}.mjs`);
const outDir = path.join(HARNESS_ROOT, 'shots', arg);

const mod = await import(pathToFileURL(scenarioPath));
if (typeof mod.default !== 'function') throw new Error(`Scenario ${arg} must export default async function`);
const meta = mod.meta ?? {};
const mode = meta.mode ?? 'docs';

// В режиме test прошлые артефакты не копим: там кроме вердикта и FAIL.png
// хранить нечего. В остальных — каталог пересоздаётся, чтобы кадры не
// смешивались со снятыми прошлой версией сценария.
await fs.rm(outDir, { recursive: true, force: true });
await fs.mkdir(outDir, { recursive: true });

console.log(`▶ scenario: ${arg}  [mode=${mode}]`);
console.log(`  base=${env.BASE_URL}  coop=${env.COOPNAME}  out=${outDir}`);

const startedAt = Date.now();
const { browser, context, page, consoleLog, failures } = await openBrowser();
const { shot, shotElement, writeManifest } = makeShotContext({ scenarioName: arg, outDir, mode });

let failure = null;
try {
  await mod.default({ page, context, shot, shotElement, expect, env });

  // Ассерты прошли — но страница могла молча сыпать исключениями или получать
  // 5xx. Это дефект ровно того же веса, что и упавший expect.
  if (failures.length) {
    const summary = failures.slice(0, 5).map((f) => `${f.kind}: ${f.detail}`).join('; ');
    throw new Error(`страница сообщила об ошибках (${failures.length}): ${summary}`);
  }

  const manifest = await writeManifest(meta);
  const kept = manifest.shots.filter((s) => !s.skipped).length;
  console.log(`✓ пройден${kept ? `, кадров ${kept}` : ''}`);
} catch (e) {
  failure = e;
  console.error(`✗ scenario failed: ${e.message}`);
  await page.screenshot({ path: path.join(outDir, 'FAIL.png'), fullPage: true }).catch(() => {});
  await fs.writeFile(path.join(outDir, 'console.log'), consoleLog.join('\n'));
} finally {
  await browser.close();
}

await fs.writeFile(
  path.join(outDir, 'result.json'),
  JSON.stringify(
    {
      scenario: arg,
      status: failure ? 'failed' : 'passed',
      mode,
      feature: meta.feature ?? null,
      cases: meta.cases ?? [],
      reason: failure ? failure.message.slice(0, 500) : null,
      // Признаки, найденные браузером сами по себе — попадают в отчёт даже
      // когда сценарий упал раньше по ассерту.
      browserFailures: failures.slice(0, 20),
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      at: new Date().toISOString(),
    },
    null,
    2,
  ),
);

if (failure) process.exit(1);
