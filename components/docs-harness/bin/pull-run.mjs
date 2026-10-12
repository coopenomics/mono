#!/usr/bin/env node
/**
 * Скачивает кадры прогона ui-docs с GitHub Actions в shots/ — как после
 * локального прогона.
 *
 *   node bin/pull-run.mjs --app=marketplace            последний прогон ветки ci/ui-docs-marketplace
 *   node bin/pull-run.mjs --app=marketplace --run=<id>  конкретный прогон
 *
 * После скачивания всё как обычно: `node bin/diff-shots.mjs --app=…`, проза в
 * shots/<сценарий>/draft.md, `node lib/install.mjs <сценарий>`.
 *
 * Артефакт — каталог components/docs-harness/shots целиком, поэтому
 * распаковывается прямо в него. Прежние кадры приложения стираются: кадр от
 * старого прогона рядом со свежими выглядел бы как снятый сейчас.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HARNESS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = process.env.UI_DOCS_REPO || 'coopenomics/mono';
const WORKFLOW = 'ui-docs.yaml';

const args = process.argv.slice(2);
const opt = (name) => (args.find((a) => a.startsWith(`--${name}=`)) ?? '').slice(name.length + 3);
const APP = opt('app');
let RUN = opt('run');
if (!APP) {
  console.error('Usage: node bin/pull-run.mjs --app=<приложение> [--run=<id>]');
  process.exit(2);
}

function gh(...a) {
  const r = spawnSync('gh', a, { encoding: 'utf8' });
  if (r.status !== 0) {
    console.error(`✗ gh ${a.join(' ')}\n${r.stderr}`);
    process.exit(1);
  }
  return r.stdout;
}

if (!RUN) {
  const list = JSON.parse(gh('run', 'list', '-R', REPO, '--workflow', WORKFLOW, '--branch', `ci/ui-docs-${APP}`,
    '--limit', '5', '--json', 'databaseId,status,conclusion,createdAt'));
  const done = list.find((r) => r.status === 'completed');
  if (!done) {
    console.error(`✗ завершённых прогонов ${WORKFLOW} в ветке ci/ui-docs-${APP} нет`);
    if (list[0]) console.error(`  последний: ${list[0].databaseId} — ${list[0].status}`);
    process.exit(1);
  }
  RUN = String(done.databaseId);
  console.log(`▸ прогон ${RUN} (${done.conclusion}, ${done.createdAt})`);
}

const name = `ui-docs-${APP}-${RUN}`;
const appDir = path.join(HARNESS_ROOT, 'shots', APP);
fs.rmSync(appDir, { recursive: true, force: true });
// Сводка сюиты тоже в артефакте; gh отказывается писать поверх существующих файлов.
fs.rmSync(path.join(HARNESS_ROOT, 'shots/_suite'), { recursive: true, force: true });
fs.mkdirSync(path.join(HARNESS_ROOT, 'shots'), { recursive: true });
gh('run', 'download', '-R', REPO, RUN, '-n', name, '-D', path.join(HARNESS_ROOT, 'shots'));

let scenarios = 0;
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.isDirectory()) walk(path.join(d, e.name));
    else if (e.name === 'result.json') scenarios++;
  }
};
if (fs.existsSync(appDir)) walk(appDir);
console.log(`✓ ${name} → shots/ (сценариев с вердиктом: ${scenarios})`);
console.log(`  сравнить с документацией: node bin/diff-shots.mjs --app=${APP}`);
console.log(`  положить кадры в docs:    node lib/install.mjs <сценарий>`);
