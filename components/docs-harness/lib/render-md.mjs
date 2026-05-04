// Собирает черновик MD из manifest.json. Пользователь потом правит прозу.
// Usage: node lib/render-md.mjs shots/auth/signin/manifest.json [--stdout]

import fs from 'node:fs/promises';
import path from 'node:path';

const manifestPath = process.argv[2];
if (!manifestPath) { console.error('Usage: render-md.mjs <manifest.json>'); process.exit(2); }

const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
const { meta, shots } = manifest;
const assetsPrefix = meta.assetsDir ? `/${meta.assetsDir}` : '/assets';

const lines = [];
lines.push('---');
if (meta.title) lines.push(`title: ${meta.title}`);
lines.push(`generated_by: docs-harness`);
lines.push(`scenario: ${manifest.scenario}`);
lines.push('---');
lines.push('');
if (meta.title) lines.push(`# ${meta.title}`);
lines.push('');

shots.forEach((s, i) => {
  lines.push(`## Шаг ${i + 1}. ${s.description}`);
  lines.push('');
  lines.push(`![${s.description}](${assetsPrefix}/${s.file})`);
  lines.push('');
  lines.push(`<!-- TODO: описать шаг, url=${s.url} -->`);
  lines.push('');
});

const md = lines.join('\n');
if (process.argv.includes('--stdout')) {
  process.stdout.write(md);
} else {
  const outPath = path.join(path.dirname(manifestPath), 'draft.md');
  const exists = await fs.access(outPath).then(() => true).catch(() => false);
  const force = process.argv.includes('--force');
  if (exists && !force) {
    console.log(`↷ ${outPath} уже существует — НЕ перезаписываю (используйте --force чтобы перегенерировать скелет).`);
    console.log('  Проза остаётся; если поменялся состав скриншотов — смержите вручную.');
  } else {
    await fs.writeFile(outPath, md);
    console.log(`✓ draft MD → ${outPath}`);
  }
}
