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
// Базовая версия линтуется из памяти (`ESLint#lintText` с путём оригинала):
// конфиг и tsconfig находятся по этому пути, а на диск не пишется ничего.
// Прежде копии клались рядом с оригиналом, и вотчеры dev-стенда (nodemon
// контроллера, ESLint-плагин Vite) ловили их как правку исходников.

import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { join } from 'node:path';

function countByRule(messages, gateRules) {
  const perRule = new Map();
  for (const m of messages) {
    if (!gateRules.includes(m.ruleId)) continue;
    if (!perRule.has(m.ruleId)) perRule.set(m.ruleId, []);
    perRule.get(m.ruleId).push(m);
  }
  return perRule;
}

function baseContent(repoPrefix, diffFrom, file) {
  try {
    return execFileSync('git', ['show', `${diffFrom}:${repoPrefix}/${file}`], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return undefined; // файла в базе нет — он новый, база пустая
  }
}

/**
 * @param {object} o
 * @param {string} o.componentDir абсолютный путь к компоненту (там запускается eslint)
 * @param {string} o.repoPrefix   префикс пути в репозитории, напр. `components/controller`
 * @param {string} o.diffFrom     ревизия базы сравнения
 * @param {string} o.rules        JSON для `eslint --rule`
 * @param {string[]} o.gateRules  правила, попадания по которым считаются
 * @param {string[]} o.files      пути файлов относительно componentDir
 * @returns {Promise<number>} 0 — рост долга не обнаружен, 1 — обнаружен
 */
export async function ratchet({ componentDir, repoPrefix, diffFrom, rules, gateRules, files }) {
  // eslint компонента, а не корня: у controller и desktop разные версии
  const { ESLint } = createRequire(join(componentDir, 'package.json'))('eslint');
  const eslint = new ESLint({ cwd: componentDir, overrideConfig: { rules: JSON.parse(rules) } });

  let current;
  try {
    current = await eslint.lintFiles(files.map((f) => join(componentDir, f)));
  } catch (e) {
    console.log('  eslint не отработал — гейт не может вынести вердикт');
    console.log('  ' + String(e?.message ?? e).split('\n').slice(0, 5).join('\n  '));
    return 1;
  }

  const byFile = new Map(); // исходный путь -> результат eslint
  for (const entry of current) {
    const rel = entry.filePath.startsWith(componentDir)
      ? entry.filePath.slice(componentDir.length + 1)
      : entry.filePath;
    byFile.set(rel, entry);
  }

  const baseCounts = new Map(); // исходный путь -> {rule -> n}
  for (const file of files) {
    const content = baseContent(repoPrefix, diffFrom, file);
    if (content === undefined) continue;
    const [base] = await eslint.lintText(content, { filePath: join(componentDir, file) });
    const counts = new Map();
    for (const [rule, list] of countByRule(base?.messages ?? [], gateRules)) counts.set(rule, list.length);
    baseCounts.set(file, counts);
  }

  let grew = false;
  let debt = 0;
  let other = 0;

  for (const file of files) {
    const entry = byFile.get(file);
    const perRule = countByRule(entry?.messages ?? [], gateRules);
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
    other += (entry?.messages ?? []).filter((m) => !gateRules.includes(m.ruleId)).length;
  }

  if (debt > 0) {
    console.log(`  вне гейта: ${debt} нарушени(й) канона унаследовано из базы — долг, вердикт не роняют`);
  }
  if (other > 0) {
    console.log(`  вне гейта: ${other} прочих ошибок линта — долг, вердикт не роняют`);
  }
  if (!grew) console.log('  роста долга канона нет');

  return grew ? 1 : 0;
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
    ratchet({
      componentDir: join(process.cwd(), componentDir),
      repoPrefix,
      diffFrom,
      rules,
      gateRules,
      files,
    }).then(process.exit);
  });
}
