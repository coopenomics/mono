#!/usr/bin/env node
/**
 * Сравнение свежих кадров с кадрами, которые лежат в документации.
 *
 *   node bin/diff-shots.mjs --app=marketplace            отчёт в shots/_suite/diff.md и diff.json
 *   node bin/diff-shots.mjs --app=marketplace --summary  плюс в $GITHUB_STEP_SUMMARY (CI)
 *   node bin/diff-shots.mjs --app=… --threshold=0.002    доля изменившихся пикселей, с которой кадр считается изменившимся
 *   node bin/diff-shots.mjs --app=… --docs-root=<path>   другой клон components/docs/docs
 *
 * Зачем. После повторного прогона сюиты нужно знать, какие кадры разошлись с
 * тем, что уже в документации, — и читать прозу только к ним. Без этого
 * вычитка после каждой правки вёрстки означала бы просмотр всех кадров
 * подряд. Отчёт — список для вычитки: красные сценарии, изменившиеся кадры с
 * долей изменившихся пикселей, новые кадры (в документации их ещё нет) и
 * кадры документации, которых сценарий больше не снимает.
 *
 * Прежний кадр берётся из components/docs/docs/<meta.assetsDir>/<file> — то
 * есть из git, а не из прошлого прогона: каталог shots в git не хранится.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const HARNESS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_DOCS_ROOT = path.resolve(HARNESS_ROOT, '..', 'docs', 'docs');

const args = process.argv.slice(2);
const opt = (name, def) => (args.find((a) => a.startsWith(`--${name}=`)) ?? '').slice(name.length + 3) || def;
const APP = opt('app', '');
const DOCS_ROOT = opt('docs-root', DEFAULT_DOCS_ROOT);
const THRESHOLD = Number(opt('threshold', '0.002'));
const TO_SUMMARY = args.includes('--summary');
// Порог различия одного пикселя по любому каналу: сглаживание шрифтов и
// сжатие дают шум в единицы, смысловое изменение — десятки.
const PIXEL_TOLERANCE = 32;

if (!APP) {
  console.error('Usage: node bin/diff-shots.mjs --app=<приложение> [--summary] [--threshold=0.002] [--docs-root=…]');
  process.exit(2);
}

const shotsRoot = path.join(HARNESS_ROOT, 'shots', APP);
if (!fs.existsSync(shotsRoot)) {
  console.error(`✗ нет каталога ${path.relative(HARNESS_ROOT, shotsRoot)} — сюита не прогонялась`);
  process.exit(2);
}

function* manifests(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* manifests(full);
    else if (entry.name === 'manifest.json') yield full;
  }
}

/** Доля пикселей, различающихся сильнее допуска; 1 — если размеры разные. */
async function diffFraction(fileA, fileB) {
  const [a, b] = await Promise.all(
    [fileA, fileB].map((f) => sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true })),
  );
  if (a.info.width !== b.info.width || a.info.height !== b.info.height) return 1;
  const total = a.info.width * a.info.height;
  let changed = 0;
  const da = a.data;
  const db = b.data;
  for (let i = 0; i < da.length; i += 4) {
    if (
      Math.abs(da[i] - db[i]) > PIXEL_TOLERANCE ||
      Math.abs(da[i + 1] - db[i + 1]) > PIXEL_TOLERANCE ||
      Math.abs(da[i + 2] - db[i + 2]) > PIXEL_TOLERANCE
    ) changed++;
  }
  return changed / total;
}

const report = { app: APP, at: new Date().toISOString(), threshold: THRESHOLD, scenarios: [] };

for (const manifestPath of manifests(shotsRoot)) {
  const scenarioDir = path.dirname(manifestPath);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const resultPath = path.join(scenarioDir, 'result.json');
  const result = fs.existsSync(resultPath) ? JSON.parse(fs.readFileSync(resultPath, 'utf8')) : null;
  const assetsDir = manifest.meta?.assetsDir;
  const entry = {
    scenario: manifest.scenario,
    mode: manifest.meta?.mode ?? 'docs',
    status: result?.status ?? 'unknown',
    reason: result?.reason ?? null,
    docPath: manifest.meta?.docPath ?? null,
    changed: [],
    unchanged: 0,
    added: [],
    removed: [],
  };
  report.scenarios.push(entry);

  // Кадры без места в документации (режимы shots/test) сравнивать не с чем.
  if (!assetsDir) continue;
  const docsAssets = path.join(DOCS_ROOT, assetsDir);
  const seen = new Set();
  for (const s of manifest.shots) {
    if (s.skipped) continue;
    seen.add(s.file);
    const fresh = path.join(scenarioDir, s.file);
    const prior = path.join(docsAssets, s.file);
    if (!fs.existsSync(fresh)) continue;
    if (!fs.existsSync(prior)) { entry.added.push(s.file); continue; }
    const fraction = await diffFraction(fresh, prior);
    if (fraction > THRESHOLD) entry.changed.push({ file: s.file, fraction, description: s.description });
    else entry.unchanged++;
  }
  if (fs.existsSync(docsAssets)) {
    for (const f of fs.readdirSync(docsAssets)) {
      if (f.endsWith('.png') && !seen.has(f)) entry.removed.push(f);
    }
  }
}

// ── Отчёт ──────────────────────────────────────────────────────────────────
const pct = (x) => `${(x * 100).toFixed(1).replace('.', ',')} %`;
const red = report.scenarios.filter((s) => s.status !== 'passed');
const withChanges = report.scenarios.filter((s) => s.changed.length);
const withAdded = report.scenarios.filter((s) => s.added.length);
const withRemoved = report.scenarios.filter((s) => s.removed.length);
const unchangedTotal = report.scenarios.reduce((n, s) => n + s.unchanged, 0);

const lines = [];
lines.push(`## Кадры «${APP}» против документации`);
lines.push('');
lines.push(`Сценариев ${report.scenarios.length}, кадров без изменений ${unchangedTotal}, порог ${pct(THRESHOLD)} пикселей.`);
lines.push('');
if (red.length) {
  lines.push('### Красные сценарии — кадры неполные');
  lines.push('');
  for (const s of red) lines.push(`- \`${s.scenario}\` — ${s.status}${s.reason ? `: ${s.reason.slice(0, 200)}` : ''}`);
  lines.push('');
}
if (withChanges.length) {
  lines.push('### Изменившиеся кадры — прочитать абзац к каждому');
  lines.push('');
  lines.push('| сценарий | кадр | изменилось | страница |');
  lines.push('|---|---|---|---|');
  for (const s of withChanges) {
    for (const c of s.changed) lines.push(`| \`${s.scenario}\` | ${c.file} | ${pct(c.fraction)} | ${s.docPath ?? '—'} |`);
  }
  lines.push('');
}
if (withAdded.length) {
  lines.push('### Новые кадры — в документации их ещё нет');
  lines.push('');
  for (const s of withAdded) lines.push(`- \`${s.scenario}\`: ${s.added.join(', ')}`);
  lines.push('');
}
if (withRemoved.length) {
  lines.push('### Кадры документации, которых сценарий больше не снимает');
  lines.push('');
  for (const s of withRemoved) lines.push(`- \`${s.scenario}\`: ${s.removed.join(', ')}`);
  lines.push('');
}
if (!red.length && !withChanges.length && !withAdded.length && !withRemoved.length) {
  lines.push('Все кадры совпадают с документацией, вычитывать нечего.');
  lines.push('');
}

const md = lines.join('\n');
const suiteDir = path.join(HARNESS_ROOT, 'shots/_suite');
fs.mkdirSync(suiteDir, { recursive: true });
fs.writeFileSync(path.join(suiteDir, 'diff.json'), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(suiteDir, 'diff.md'), md);
process.stdout.write(md);
if (TO_SUMMARY && process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n');
console.log(`\nотчёт: ${path.relative(process.cwd(), path.join(suiteDir, 'diff.md'))}`);
