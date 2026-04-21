// Копирует PNG + draft.md в docs-репозиторий (по умолчанию /home/admin/mono-ai-2/components/docs).
// Usage: node lib/install.mjs <scenario> [--docs-root=...]

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HARNESS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scenario = process.argv[2];
if (!scenario) { console.error('Usage: install.mjs <scenario>'); process.exit(2); }

// По умолчанию пишем в соседнюю components/docs того же клона, где лежит harness.
// У каждого разработчика своя папка — путь вычисляем относительно HARNESS_ROOT.
const DEFAULT_DOCS_ROOT = path.resolve(HARNESS_ROOT, '..', 'components', 'docs', 'docs');
const docsRoot = (process.argv.find(a => a.startsWith('--docs-root=')) ?? '').split('=')[1]
  || DEFAULT_DOCS_ROOT;

const manifestPath = path.join(HARNESS_ROOT, 'shots', scenario, 'manifest.json');
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));

const assetsDir = manifest.meta?.assetsDir;
const docPath = manifest.meta?.docPath;
if (!assetsDir) { console.error('meta.assetsDir не задан в сценарии'); process.exit(2); }

const srcShotsDir = path.join(HARNESS_ROOT, 'shots', scenario);
const destAssetsDir = path.join(docsRoot, assetsDir);

await fs.mkdir(destAssetsDir, { recursive: true });
for (const s of manifest.shots) {
  await fs.copyFile(path.join(srcShotsDir, s.file), path.join(destAssetsDir, s.file));
  console.log(`  img  ${s.file} → ${destAssetsDir}/`);
}

if (docPath) {
  const draftSrc = path.join(srcShotsDir, 'draft.md');
  const destDoc = path.join(docsRoot, docPath);
  const exists = await fs.access(destDoc).then(() => true).catch(() => false);
  const forceMd = process.argv.includes('--md') || process.argv.includes('--force');
  if (exists && !forceMd) {
    console.log(`  md   ${docPath} уже существует — не перезаписываю (PNG обновлены).`);
    console.log(`       Если правил прозу в ${draftSrc} — прогони ещё раз с флагом --md.`);
  } else {
    await fs.mkdir(path.dirname(destDoc), { recursive: true });
    await fs.copyFile(draftSrc, destDoc);
    console.log(`  md   ${draftSrc} → ${destDoc}${exists ? ' (--md: перезаписан)' : ''}`);
  }
}

console.log('✓ installed');
