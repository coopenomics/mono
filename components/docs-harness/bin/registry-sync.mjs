#!/usr/bin/env node
/**
 * Синхронизация UI-случаев реестра тестов с вердиктами прогона.
 *
 *   node bin/registry-sync.mjs            показать, что изменится (по умолчанию)
 *   node bin/registry-sync.mjs --apply    записать в test-registry/*.yaml
 *
 * Зачем машинка, а не руки. `status: passing`, проставленный вручную, живёт
 * своей жизнью: сценарий давно красный, а в реестре он «зелёный». Здесь
 * статус выводится из фактического вердикта последнего прогона:
 *
 *   сценарий зелёный   → passing
 *   сценарий красный   → written  (тест есть, но поведение не подтверждено)
 *   вердикта нет вовсе → written, если файл сценария существует
 *
 * Понижение статуса — тоже работа этой команды: реестр обязан показывать
 * ухудшение, иначе он врёт в самую нужную сторону.
 *
 * Связь сценария со случаями реестра объявляется в самом сценарии:
 *
 *   export const meta = { feature: 'marketplace.order-create',
 *                         cases: ['mkt.order.happy.01'], ... }
 *
 * Скрипт НЕ заводит новые случаи: их формулирует человек, механическое
 * добавление «случая на каждый сценарий» превратило бы реестр в отчёт о
 * самом себе.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const HARNESS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = path.resolve(HARNESS_ROOT, '../..');
const REGISTRY_DIR = path.join(REPO_ROOT, 'test-registry');
const APPLY = process.argv.includes('--apply');

/** Все сценарии на диске с их meta и последним вердиктом. */
async function collectScenarios() {
  const out = [];
  const root = path.join(HARNESS_ROOT, 'scenarios');

  const walk = (dir, prefix) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) {
        walk(full, prefix ? `${prefix}/${name}` : name);
      } else if (name.endsWith('.mjs')) {
        out.push({
          scenario: `${prefix}/${name.replace(/\.mjs$/, '')}`,
          file: path.relative(REPO_ROOT, full),
          abs: full,
        });
      }
    }
  };
  walk(root, '');

  for (const s of out) {
    // meta читаем импортом, а не регэкспом: сценарий может собирать её из
    // констант, и текстовый разбор тихо соврёт.
    try {
      const mod = await import(`file://${s.abs}`);
      s.meta = mod.meta ?? {};
    } catch (e) {
      s.meta = {};
      s.metaError = e.message;
    }
    const resultFile = path.join(HARNESS_ROOT, 'shots', s.scenario, 'result.json');
    try {
      s.verdict = JSON.parse(fs.readFileSync(resultFile, 'utf8'));
    } catch {
      s.verdict = null;
    }
  }
  return out;
}

const scenarios = await collectScenarios();

// Случай → сценарий, который его закрывает.
const byCase = new Map();
for (const s of scenarios) {
  for (const c of s.meta?.cases ?? []) {
    if (byCase.has(c)) {
      console.warn(`⚠ случай ${c} заявлен двумя сценариями: ${byCase.get(c).scenario} и ${s.scenario}`);
    }
    byCase.set(c, s);
  }
}

if (!fs.existsSync(REGISTRY_DIR)) {
  console.error(`Нет каталога ${path.relative(REPO_ROOT, REGISTRY_DIR)}`);
  process.exit(2);
}

const changes = [];
const orphanCases = [];

for (const file of fs.readdirSync(REGISTRY_DIR).filter((f) => f.endsWith('.yaml') && !f.startsWith('_'))) {
  const full = path.join(REGISTRY_DIR, file);
  // parseDocument, а не parse: комментарии в реестре несут обоснование
  // случаев, и переписывать файл с их потерей нельзя.
  const doc = YAML.parseDocument(fs.readFileSync(full, 'utf8'));
  const cases = doc.get('cases');
  if (!cases?.items) continue;

  let touched = false;

  for (const node of cases.items) {
    const id = node.get('id');
    const level = node.get('level');
    if (level !== 'ui' || !id) continue;

    const s = byCase.get(id);
    if (!s) {
      orphanCases.push({ file, id });
      continue;
    }

    const wantTest = s.file;
    const wantStatus = s.verdict?.status === 'passed' ? 'passing' : 'written';
    const haveTest = node.get('test') ?? null;
    const haveStatus = node.get('status') ?? null;

    if (haveTest !== wantTest || haveStatus !== wantStatus) {
      changes.push({
        file, id,
        test: [haveTest, wantTest],
        status: [haveStatus, wantStatus],
        why: s.verdict ? `прогон ${s.verdict.at?.slice(0, 16)}: ${s.verdict.status}` : 'прогона не было',
      });
      node.set('test', wantTest);
      node.set('status', wantStatus);
      touched = true;
    }
  }

  if (touched && APPLY) fs.writeFileSync(full, doc.toString({ lineWidth: 0 }));
}

// ── Отчёт ──────────────────────────────────────────────────────────────────
if (!changes.length) {
  console.log('Реестр совпадает с вердиктами прогона — менять нечего.');
} else {
  console.log(`${APPLY ? 'Записано' : 'Будет записано'} изменений: ${changes.length}\n`);
  for (const c of changes) {
    console.log(`  ${c.file} · ${c.id}`);
    if (c.status[0] !== c.status[1]) console.log(`      status: ${c.status[0] ?? '—'} → ${c.status[1]}   (${c.why})`);
    if (c.test[0] !== c.test[1]) console.log(`      test:   ${c.test[0] ?? '—'} → ${c.test[1]}`);
  }
  if (!APPLY) console.log('\nЗапись: node bin/registry-sync.mjs --apply');
}

if (orphanCases.length) {
  console.log(`\nUI-случаи без сценария (${orphanCases.length}) — их закрывать некому:`);
  for (const o of orphanCases.slice(0, 30)) console.log(`  ${o.file} · ${o.id}`);
  if (orphanCases.length > 30) console.log(`  …ещё ${orphanCases.length - 30}`);
}

const unlinked = scenarios.filter((s) => s.meta?.feature && !(s.meta?.cases ?? []).length);
if (unlinked.length) {
  console.log(`\nСценарии с feature, но без cases (${unlinked.length}) — вердикт никуда не едет:`);
  for (const s of unlinked) console.log(`  ${s.scenario} → ${s.meta.feature}`);
}
