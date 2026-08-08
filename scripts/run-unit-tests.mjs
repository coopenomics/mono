#!/usr/bin/env node
/**
 * Прогон юнит-тестов монорепы с общей сводкой.
 *
 * Зачем отдельный скрипт вместо цепочки `pnpm --filter ... run test` в
 * workflow: цепочка обрывается на первом упавшем пакете, а в Job Summary
 * попадает отчёт того раннера, который отработал последним. В итоге на вкладке
 * с результатами видно «1 файл, 7 тестов», хотя реально в прогоне их больше
 * тысячи — по такому отчёту нельзя понять ни объём, ни где сломалось.
 *
 * Здесь каждый пакет гоняется своим раннером с JSON-отчётом (формат у vitest и
 * jest общий), после чего собирается одна таблица: сколько тестов в каждом
 * пакете, сколько упало, и поимённый список падений. Прогоняются ВСЕ пакеты —
 * красный cooptypes больше не прячет состояние controller'а. Код возврата — 1,
 * если упал хоть один.
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPORT_DIR = join(ROOT, 'node_modules', '.cache', 'unit-reports');

const PACKAGES = [
  { title: 'cooptypes', filter: 'cooptypes', runner: 'vitest' },
  { title: 'parser', filter: '@coopenomics/parser', runner: 'vitest' },
  { title: 'notifications', filter: '@coopenomics/notifications', runner: 'vitest' },
  { title: 'controller', filter: '@coopenomics/controller', runner: 'jest' },
];

/** Аргументы раннера: JSON-отчёт в файл, читаемый лог — по-прежнему в консоль. */
function runnerArgs(runner, reportFile) {
  if (runner === 'vitest') {
    return ['exec', 'vitest', 'run', '--reporter=default', '--reporter=json', `--outputFile=${reportFile}`];
  }
  return ['exec', 'jest', '-i', '--json', `--outputFile=${reportFile}`];
}

/** vitest и jest пишут json одного формата — разбираем одинаково. */
function readReport(reportFile) {
  try {
    const raw = JSON.parse(readFileSync(reportFile, 'utf8'));
    const failures = [];
    for (const suite of raw.testResults ?? []) {
      // Сьют, упавший на импорте, не доходит до тестов — у него только message.
      if (!suite.assertionResults?.length && suite.status === 'failed') {
        failures.push({ file: suite.name, title: 'сьют не запустился' });
        continue;
      }
      for (const test of suite.assertionResults ?? []) {
        if (test.status === 'failed') failures.push({ file: suite.name, title: test.fullName || test.title });
      }
    }
    return {
      files: raw.numTotalTestSuites ?? 0,
      tests: raw.numTotalTests ?? 0,
      passed: raw.numPassedTests ?? 0,
      failed: raw.numFailedTests ?? 0,
      failures,
    };
  } catch {
    return null;
  }
}

mkdirSync(REPORT_DIR, { recursive: true });
const results = [];

for (const pkg of PACKAGES) {
  const reportFile = join(REPORT_DIR, `${pkg.title}.json`);
  rmSync(reportFile, { force: true });

  console.log(`\n─── ${pkg.title} ───`);
  const started = Date.now();
  const proc = spawnSync('pnpm', ['--filter', pkg.filter, ...runnerArgs(pkg.runner, reportFile)], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, FORCE_COLOR: '1' },
  });

  results.push({
    ...pkg,
    seconds: Math.round((Date.now() - started) / 1000),
    exitCode: proc.status ?? 1,
    report: readReport(reportFile),
  });
}

const relative = (file) => String(file || '').replace(`${ROOT}/`, '');
const totals = results.reduce(
  (acc, r) => ({
    files: acc.files + (r.report?.files ?? 0),
    tests: acc.tests + (r.report?.tests ?? 0),
    passed: acc.passed + (r.report?.passed ?? 0),
    failed: acc.failed + (r.report?.failed ?? 0),
  }),
  { files: 0, tests: 0, passed: 0, failed: 0 }
);

const lines = ['## Юнит-тесты', '', '| Пакет | Файлы | Тестов | Прошло | Упало | Время |', '|---|---:|---:|---:|---:|---:|'];
for (const r of results) {
  const mark = r.exitCode === 0 ? '✅' : '❌';
  const rep = r.report;
  lines.push(
    rep
      ? `| ${mark} ${r.title} | ${rep.files} | ${rep.tests} | ${rep.passed} | ${rep.failed} | ${r.seconds} c |`
      : `| ${mark} ${r.title} | — | — | — | — | ${r.seconds} c | `
  );
}
lines.push(`| **итого** | **${totals.files}** | **${totals.tests}** | **${totals.passed}** | **${totals.failed}** | |`);

const failed = results.filter((r) => r.exitCode !== 0);
if (failed.length) {
  lines.push('', '### Что упало', '');
  for (const r of failed) {
    // Пакет мог упасть и без единого проваленного теста — например, раннер не
    // стартовал вовсе. Такой случай в таблице виден по крестику, здесь честно
    // говорим, что поимённого списка нет.
    const failures = r.report?.failures ?? [];
    if (!failures.length) {
      lines.push(`- **${r.title}** — прогон завершился с ошибкой, отчёт не собран (смотри лог шага)`);
      continue;
    }
    for (const f of failures.slice(0, 30)) lines.push(`- **${r.title}** \`${relative(f.file)}\` — ${f.title}`);
    if (failures.length > 30) lines.push(`- **${r.title}** … и ещё ${failures.length - 30}`);
  }
}

const summary = lines.join('\n');
console.log(`\n${summary}\n`);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);

process.exit(failed.length ? 1 : 0);
