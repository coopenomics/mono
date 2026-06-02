/**
 * Story 6.2 contract test (Epic 6).
 *
 * Mapper, у которого `signedDocumentFields = [...]` с непустым массивом,
 * обязан в `mapDeltaToBlockchainData` вызвать `this.normalizeSignedDocuments(...)`.
 *
 * Иначе новый mapper заведёт декларацию подписанных полей, но фактически они
 * никогда не нормализуются — silent data corruption (meta остаётся JSON-string'ой,
 * вместо распарсенного объекта; checksum Story 6.4 не сходится).
 *
 * Эвристика — text-scan по содержимому файла; игнорируем JSDoc/однострочные комменты.
 */

import fs from 'fs';
import path from 'path';

const ROOT_DIR = path.resolve(__dirname, '../../..', 'src');

function walk(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, acc);
    else if (e.isFile() && full.endsWith('-delta.mapper.ts')) acc.push(full);
  }
  return acc;
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n');
}

function declaresNonEmptySignedDocs(code: string): boolean {
  // matches `signedDocumentFields[: ...] = [ {...}, ... ]` with at least one entry
  // (т.е. символ `{` или `[` после `=`, а не сразу `[]`).
  const match = code.match(/signedDocumentFields[^=]*=\s*\[\s*([^\]])/);
  return !!match && match[1].trim() !== '';
}

function callsNormalize(code: string): boolean {
  return /this\.normalizeSignedDocuments\s*\(/.test(code);
}

describe('Delta-mapper signed-doc contract (Story 6.2)', () => {
  const MAPPER_FILES = walk(ROOT_DIR);

  it('найдены delta-mapper-файлы для проверки', () => {
    expect(MAPPER_FILES.length).toBeGreaterThan(0);
  });

  it.each(MAPPER_FILES)('%s: signedDocumentFields непустой → нормализация вызывается', (file) => {
    const raw = fs.readFileSync(file, 'utf8');
    const code = stripComments(raw);

    if (!declaresNonEmptySignedDocs(code)) return; // декларации нет — guard не применим

    expect(callsNormalize(code)).toBe(true);
  });
});
