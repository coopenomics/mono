#!/usr/bin/env node
// Фильтр отчёта ESLint: оставляет только те правила, которые объявлены гейтом.
//
// Зачем: в компонентах есть накопленные ошибки линта, не относящиеся к границам.
// Гейт должен падать ровно от того, что мы объявили гейтом, а остальное —
// показывать как долг, не роняя вердикт.
//
// Использование: eslint ... -f json | node eslint-gate.mjs <правило> [<правило>...]
// Exit 1, если есть нарушения перечисленных правил.

const gateRules = process.argv.slice(2);

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => (raw += chunk));
process.stdin.on('end', () => {
  if (!raw.trim()) {
    console.error('  ! eslint не вернул отчёт (упал до анализа)');
    process.exit(2);
  }

  let report;
  try {
    report = JSON.parse(raw);
  } catch {
    console.error('  ! отчёт eslint не разобрался как JSON');
    process.exit(2);
  }

  const hits = [];
  let otherErrors = 0;

  for (const file of report) {
    for (const msg of file.messages) {
      if (msg.severity !== 2) continue;
      if (gateRules.includes(msg.ruleId)) {
        hits.push({ file: file.filePath, line: msg.line, rule: msg.ruleId, text: msg.message });
      } else {
        otherErrors += 1;
      }
    }
  }

  const cwd = process.cwd();
  for (const h of hits) {
    const rel = h.file.startsWith(cwd) ? h.file.slice(cwd.length + 1) : h.file;
    console.log(`    ${rel}:${h.line}  [${h.rule}]`);
    console.log(`      ${h.text}`);
  }

  if (otherErrors > 0) {
    console.log(`    (вне гейта: ${otherErrors} прочих ошибок линта — долг, вердикт не роняют)`);
  }

  process.exit(hits.length > 0 ? 1 : 0);
});
