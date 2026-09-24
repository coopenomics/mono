// Общее устройство гейтов «ответ по факту из цепи» (решение владельца 23.09.2026).
//
// Три гейта — «пауза вместо факта», «транзакция мимо факта», «экран без
// зеркала» — устроены одинаково: считают нарушения по файлам и сверяют со
// снимком долга в scripts/lib/<гейт>-baseline.json.
//
// Режим «тронул — перевёл». Снимок помнит коммит, на котором снят. Файл,
// изменённый после этого коммита (или новый), обязан быть чист: правишь файл —
// переводишь его на новый подход. Нетронутые файлы ждут своей очереди в
// снимке, но их долг не может расти. Сравнение с коммитом снимка, а не с
// origin/dev: в долгой ветке «тронуто» всё, что сделано до гейта, и он упал бы
// на прошлом, а не на новой правке.
//
// `--update` переснимает снимок на текущий коммит и отказывается, если долг
// какого-то файла вырос: поднять планку обновлением нельзя.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

export const REPO_ROOT = new URL('../..', import.meta.url).pathname.replace(/\/$/, '');

/** Файлы под корнями с нужными расширениями, пути от корня репозитория. */
export function listFiles(roots, { exts, exclude = [] }) {
  const out = [];
  const walk = (dir) => {
    if (!existsSync(dir)) return;
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === 'dist' || name.startsWith('__lintbase__')) continue;
      const abs = join(dir, name);
      const st = statSync(abs);
      if (st.isDirectory()) walk(abs);
      else if (exts.some((e) => name.endsWith(e))) {
        const rel = relative(REPO_ROOT, abs);
        if (!exclude.some((re) => re.test(rel))) out.push(rel);
      }
    }
  };
  roots.forEach((r) => walk(join(REPO_ROOT, r)));
  return out.sort();
}

/**
 * Строки файла с отделённым кодом и комментарием. Блочные комментарии и
 * однострочные `//` уходят в `comment`; строковые литералы грубо учитываются —
 * `//` внутри кавычек (адреса) комментарием не считается.
 */
export function splitLines(text) {
  const lines = text.split('\n');
  const out = [];
  let inBlock = false;
  for (const raw of lines) {
    let code = '';
    let comment = '';
    let i = 0;
    let quote = null;
    while (i < raw.length) {
      const two = raw.slice(i, i + 2);
      if (inBlock) {
        if (two === '*/') {
          inBlock = false;
          i += 2;
          continue;
        }
        comment += raw[i];
        i++;
        continue;
      }
      if (quote) {
        code += raw[i];
        if (raw[i] === '\\') {
          code += raw[i + 1] ?? '';
          i += 2;
          continue;
        }
        if (raw[i] === quote) quote = null;
        i++;
        continue;
      }
      if (raw[i] === '"' || raw[i] === "'" || raw[i] === '`') {
        quote = raw[i];
        code += raw[i];
        i++;
        continue;
      }
      if (two === '/*') {
        inBlock = true;
        i += 2;
        continue;
      }
      if (two === '//') {
        comment += raw.slice(i + 2);
        break;
      }
      code += raw[i];
      i++;
    }
    out.push({ code, comment, raw });
  }
  return out;
}

/** Пометка `<тег>:` в комментарии этой строки или до трёх строк выше. */
export function annotationNear(lines, index, tag) {
  const re = new RegExp(`\\b${tag}:\\s*(\\S.*)?$`);
  for (let j = index; j >= Math.max(0, index - 3); j--) {
    const m = lines[j].comment.match(re);
    if (m) return (m[1] ?? '').trim();
    // Выше — только сплошной блок комментариев; код прерывает поиск.
    if (j < index && lines[j].code.trim()) break;
  }
  return null;
}

function git(args) {
  return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

/**
 * Файлы, которые ветка сама тронула после коммита снимка: её собственные
 * коммиты (линия первого родителя, без коммитов слияния) плюс незакоммиченное
 * и новое. Код, влитый слиянием из другой ветки, тронутым не считается —
 * иначе каждое слияние dev требовало бы переводить чужие файлы.
 */
export function changedSince(commit) {
  const files = new Set();
  const add = (out) => out.split('\n').filter(Boolean).forEach((f) => files.add(f));
  try {
    add(git(['log', '--first-parent', '--no-merges', '--format=', '--name-only', '--diff-filter=ACMR', `${commit}..HEAD`]));
  } catch {
    return null; // коммита снимка нет в истории — сравнивать не с чем
  }
  add(git(['diff', '--name-only', '--diff-filter=ACMR', 'HEAD']));
  add(git(['ls-files', '--others', '--exclude-standard']));
  return files;
}

export function readBaseline(path) {
  if (!existsSync(path)) return { commit: null, files: {} };
  const json = JSON.parse(readFileSync(path, 'utf8'));
  return { commit: json._commit ?? null, files: json.files ?? {} };
}

export function writeBaseline(path, counts, note) {
  const files = Object.fromEntries(Object.entries(counts).filter(([, n]) => n > 0).sort(([a], [b]) => a.localeCompare(b)));
  const json = { _комментарий: note, _commit: git(['rev-parse', 'HEAD']), files };
  writeFileSync(path, JSON.stringify(json, null, 2) + '\n');
}

/**
 * Вердикт гейта. `found` — { файл: [{ line, text }] } нарушений.
 * Возвращает код выхода.
 */
export function verdict({ title, baselinePath, found, note, hint }) {
  const update = process.argv.includes('--update');
  const baseline = readBaseline(baselinePath);
  const counts = Object.fromEntries(Object.entries(found).map(([f, v]) => [f, v.length]));

  if (update) {
    const grown = Object.entries(counts).filter(([f, n]) => n > (baseline.files[f] ?? 0));
    if (grown.length && baseline.commit && !process.argv.includes('--force')) {
      console.log(`  ✖ ${title}: снимок не обновлён — долг вырос:`);
      grown.forEach(([f, n]) => console.log(`      ${f}: было ${baseline.files[f] ?? 0}, стало ${n}`));
      return 1;
    }
    writeBaseline(baselinePath, counts, note);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    console.log(`  снимок записан: ${relative(REPO_ROOT, baselinePath)} (${total} в ${Object.keys(counts).filter((f) => counts[f]).length} файлах)`);
    return 0;
  }

  const touched = baseline.commit ? changedSince(baseline.commit) : null;
  const failures = [];
  for (const [file, hits] of Object.entries(found)) {
    if (!hits.length) continue;
    const allowed = touched?.has(file) ? 0 : (baseline.files[file] ?? 0);
    if (hits.length > allowed) failures.push({ file, hits, allowed, touched: touched?.has(file) ?? false });
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const baseTotal = Object.values(baseline.files).reduce((a, b) => a + b, 0);
  if (!failures.length) {
    console.log(`  долг ${total} (в снимке ${baseTotal})${total < baseTotal ? ' — опустите снимок: --update' : ''}`);
    return 0;
  }
  for (const f of failures) {
    const why = f.touched || !(f.file in baseline.files)
      ? 'файл тронут после снимка — переведите его'
      : `было ${f.allowed}, стало ${f.hits.length}`;
    console.log(`  ✖ ${f.file} — ${why}`);
    f.hits.slice(0, 8).forEach((h) => console.log(`      ${h.line}: ${h.text.trim().slice(0, 140)}`));
  }
  if (hint) console.log(`\n  ${hint}`);
  return 1;
}
