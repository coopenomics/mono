import { computeGitPatchId } from '../../../src/extensions/capital/application/utils/git-patch-id';

const patchOf = (hunkHeader: string, lines: string[]) => `--- src/example.ts\n${hunkHeader}\n${lines.join('\n')}`;

describe('computeGitPatchId', () => {
  it('стабилен при сдвиге номеров строк в hunk-заголовках (rebase без изменения правки)', () => {
    const before = patchOf('@@ -10,3 +10,4 @@', [' context', '+added line', ' context2']);
    const after = patchOf('@@ -42,3 +43,4 @@', [' context', '+added line', ' context2']);
    expect(computeGitPatchId(before)).toBe(computeGitPatchId(after));
  });

  it('стабилен при дрейфе контекстных строк вокруг правки', () => {
    const before = patchOf('@@ -1,3 +1,4 @@', [' old context', '+added line', ' tail']);
    const after = patchOf('@@ -1,3 +1,4 @@', [' completely different context', '+added line', ' other tail']);
    expect(computeGitPatchId(before)).toBe(computeGitPatchId(after));
  });

  it('игнорирует хвостовые пробелы в строках правок', () => {
    const a = patchOf('@@ -1,1 +1,2 @@', ['+added line']);
    const b = patchOf('@@ -1,1 +1,2 @@', ['+added line   ']);
    expect(computeGitPatchId(a)).toBe(computeGitPatchId(b));
  });

  it('меняется при изменении содержимого правки', () => {
    const a = patchOf('@@ -1,1 +1,2 @@', ['+added line']);
    const b = patchOf('@@ -1,1 +1,2 @@', ['+another line']);
    expect(computeGitPatchId(a)).not.toBe(computeGitPatchId(b));
  });

  it('меняется при переносе той же правки в другой файл', () => {
    const a = `--- src/a.ts\n@@ -1,1 +1,2 @@\n+added line`;
    const b = `--- src/b.ts\n@@ -1,1 +1,2 @@\n+added line`;
    expect(computeGitPatchId(a)).not.toBe(computeGitPatchId(b));
  });

  it('различает добавление и удаление одной и той же строки', () => {
    const added = patchOf('@@ -1,1 +1,2 @@', ['+shared line']);
    const removed = patchOf('@@ -1,2 +1,1 @@', ['-shared line']);
    expect(computeGitPatchId(added)).not.toBe(computeGitPatchId(removed));
  });

  it('возвращает null для пустого диффа и диффа без строк правок', () => {
    expect(computeGitPatchId('')).toBeNull();
    expect(computeGitPatchId('@@ -1,1 +1,1 @@\n context only')).toBeNull();
  });

  it('учитывает многофайловую склейку целиком', () => {
    const single = `--- src/a.ts\n@@ -1,1 +1,2 @@\n+line a`;
    const multi = `--- src/a.ts\n@@ -1,1 +1,2 @@\n+line a\n\n--- src/b.ts\n@@ -1,1 +1,2 @@\n+line b`;
    expect(computeGitPatchId(single)).not.toBe(computeGitPatchId(multi));
  });
});
