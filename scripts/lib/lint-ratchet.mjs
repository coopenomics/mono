// Храповик канона: правило не ослабляется, но гейт роняет только РОСТ долга.
//
// Зачем. Прежний ярус был пофайловым: тронул файл — он обязан быть чист
// целиком. На новом коде это работает, на легаси — нет. Первое же касание
// result-submission.service.ts (правка одной проверки прав) потребовало бы
// разобрать generateCombinedData со сложностью 32 и без единого теста.
// Гейт, который требует несвязанного рефакторинга, обходят — и он перестаёт
// защищать даже там, где работал.
//
// Что делает. Для каждого изменённого файла берёт его версию из базы
// сравнения, линтует обе тем же набором правил и сравнивает количество
// попаданий по каждому правилу:
//   стало > было  → нарушение, вердикт красный;
//   стало ≤ было  → долг, печатается и вердикт не роняет.
// Новый файл сравнивается с пустой базой, поэтому для него правило работает
// в полную силу — ровно как раньше.
//
// Копии базовых версий кладутся рядом с оригиналом (префикс `__lintbase__`),
// иначе eslint не найдёт нужный .eslintrc и tsconfig. Удаляются всегда.

import { execFileSync, spawnSync } from 'node:child_process';
import { writeFileSync, rmSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';

const PREFIX = '__lintbase__';

/**
 * @param {object} o
 * @param {string} o.componentDir абсолютный путь к компоненту (там запускается eslint)
 * @param {string} o.repoPrefix   префикс пути в репозитории, напр. `components/controller`
 * @param {string} o.diffFrom     ревизия базы сравнения
 * @param {string} o.rules        JSON для `eslint --rule`
 * @param {string[]} o.gateRules  правила, попадания по которым считаются
 * @param {string[]} o.files      пути файлов относительно componentDir
 * @returns {number} 0 — рост долга не обнаружен, 1 — обнаружен
 */
export function ratchet({ componentDir, repoPrefix, diffFrom, rules, gateRules, files }) {
  const temps = [];
  const baseOf = new Map(); // временный путь -> исходный путь

  try {
    for (const file of files) {
      const tmpRel = join(dirname(file), PREFIX + basename(file));
      const tmpAbs = join(componentDir, tmpRel);
      let content;
      try {
        content = execFileSync('git', ['show', `${diffFrom}:${repoPrefix}/${file}`], {
          encoding: 'utf8',
          maxBuffer: 64 * 1024 * 1024,
          stdio: ['ignore', 'pipe', 'ignore'],
        });
      } catch {
        continue; // файла в базе нет — он новый, база пустая
      }
      mkdirSync(dirname(tmpAbs), { recursive: true });
      writeFileSync(tmpAbs, content);
      temps.push(tmpAbs);
      baseOf.set(tmpRel, file);
    }

    const targets = [...files, ...baseOf.keys()];
    const res = spawnSync(
      'pnpm',
      ['exec', 'eslint', ...targets, '-f', 'json', '--rule', rules],
      { cwd: componentDir, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }
    );

    let report;
    try {
      report = JSON.parse(res.stdout || '[]');
    } catch {
      console.log('  не удалось разобрать вывод eslint — гейт не может вынести вердикт');
      if (res.stderr) console.log('  ' + res.stderr.trim().split('\n').slice(0, 5).join('\n  '));
      return 1;
    }

    // filePath -> {rule -> messages[]}
    const byFile = new Map();
    for (const entry of report) {
      const rel = entry.filePath.startsWith(componentDir)
        ? entry.filePath.slice(componentDir.length + 1)
        : entry.filePath;
      const perRule = new Map();
      for (const m of entry.messages) {
        if (!gateRules.includes(m.ruleId)) continue;
        if (!perRule.has(m.ruleId)) perRule.set(m.ruleId, []);
        perRule.get(m.ruleId).push(m);
      }
      byFile.set(rel, perRule);
    }

    const baseCounts = new Map(); // исходный путь -> {rule -> n}
    for (const [tmpRel, origin] of baseOf) {
      const perRule = byFile.get(tmpRel) ?? new Map();
      const counts = new Map();
      for (const [rule, list] of perRule) counts.set(rule, list.length);
      baseCounts.set(origin, counts);
    }

    let grew = false;
    let debt = 0;
    let other = 0;

    for (const file of files) {
      const perRule = byFile.get(file) ?? new Map();
      const base = baseCounts.get(file) ?? new Map();
      for (const [rule, list] of perRule) {
        const was = base.get(rule) ?? 0;
        if (list.length > was) {
          grew = true;
          console.log(`  ✗ ${file} — ${rule}: было ${was}, стало ${list.length}`);
          for (const m of list) console.log(`      ${m.line}:${m.column} ${m.message}`);
        } else {
          debt += list.length;
        }
      }
      // прочие ошибки линта в этом файле вердикт не роняют
      for (const e of report) {
        if (!e.filePath.endsWith('/' + file)) continue;
        other += e.messages.filter((m) => !gateRules.includes(m.ruleId)).length;
      }
    }

    if (debt > 0) {
      console.log(`  вне гейта: ${debt} нарушени(й) канона унаследовано из базы — долг, вердикт не роняют`);
    }
    if (other > 0) {
      console.log(`  вне гейта: ${other} прочих ошибок линта — долг, вердикт не роняют`);
    }
    if (!grew) console.log('  роста долга канона нет');

    return grew ? 1 : 0;
  } finally {
    for (const t of temps) if (existsSync(t)) rmSync(t, { force: true });
  }
}

// CLI: node lint-ratchet.mjs <componentDir> <repoPrefix> <diffFrom> <rulesJson> <rule...>
// Список файлов (относительно componentDir) читается со stdin.
if (process.argv[1] && process.argv[1].endsWith('lint-ratchet.mjs')) {
  const [componentDir, repoPrefix, diffFrom, rules, ...gateRules] = process.argv.slice(2);
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (d) => (input += d));
  process.stdin.on('end', () => {
    const files = input.split('\n').map((s) => s.trim()).filter(Boolean);
    if (files.length === 0) {
      console.log('  проверять нечего');
      process.exit(0);
    }
    process.exit(
      ratchet({
        componentDir: join(process.cwd(), componentDir),
        repoPrefix,
        diffFrom,
        rules,
        gateRules,
        files,
      })
    );
  });
}
