import { createHash } from 'crypto';

/**
 * Стабильный идентификатор содержимого коммита — аналог `git patch-id --stable`.
 *
 * Канонизация: из склейки patch-фрагментов (формат `GitHubService.getCommitPatchesConcat`:
 * блоки `--- <filename>\n<hunks>`) берутся только строки, начинающиеся с `+` или `-` —
 * то есть заголовки файлов и сами правки. Заголовки hunk'ов (`@@ -a,b +c,d @@`) и
 * контекстные строки отбрасываются, хвостовые пробелы обрезаются. Поэтому идентификатор
 * переживает rebase (сдвиг номеров строк и дрейф контекста), amend без изменения правок
 * и cherry-pick — и меняется, когда меняется сама правка.
 *
 * @returns sha256 (hex, 64 символа) канонической формы; null — если в диффе нет строк
 * правок (пустой коммит, только бинарные файлы) — вызывающий подставляет фолбэк.
 */
export function computeGitPatchId(diffText: string): string | null {
  if (!diffText) {
    return null;
  }
  const canonicalLines: string[] = [];
  for (const rawLine of diffText.split('\n')) {
    if (rawLine.startsWith('+') || rawLine.startsWith('-')) {
      canonicalLines.push(rawLine.replace(/\s+$/, ''));
    }
  }
  if (canonicalLines.length === 0) {
    return null;
  }
  return createHash('sha256').update(canonicalLines.join('\n'), 'utf8').digest('hex');
}
