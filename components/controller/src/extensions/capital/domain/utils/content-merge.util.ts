import { diff3Merge } from './diff3';

/**
 * Содержимое редакции: заголовок и тело.
 * `description` нормализуем к строке ('' вместо null/undefined), чтобы сравнение было однозначным.
 */
export interface ContentSnapshot {
  title: string;
  description: string;
}

export interface ContentConflictHunks {
  /** Итог с маркерами конфликта (`<<<<<<< ours` … `||||||| base` … `=======` … `>>>>>>> theirs`). */
  marked: string;
}

export type ContentMergeOutcome =
  | { status: 'clean'; result: ContentSnapshot; merged: boolean }
  | { status: 'conflict'; title_conflict: boolean; description_conflict: boolean; hunks: ContentConflictHunks };

/** Форматы, которые безопасно сливать построчно. XML-диаграммы (BPMN/DRAWIO) — нет. */
export function isLineMergeableFormat(contentFormat?: string | null): boolean {
  if (!contentFormat) return true;
  const f = String(contentFormat).toUpperCase();
  return f === 'MARKDOWN' || f === 'MERMAID';
}

export function normalizeDescription(value: string | null | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

/** Трёхстороннее слияние скаляра: кто изменил относительно базы — того и берём; изменили оба по-разному — конфликт. */
function mergeScalar(ours: string, base: string, theirs: string): { value: string; conflict: boolean } {
  if (ours === theirs) return { value: ours, conflict: false };
  if (ours === base) return { value: theirs, conflict: false };
  if (theirs === base) return { value: ours, conflict: false };
  return { value: ours, conflict: true };
}

const LINE_SEPARATOR = /\r?\n/;

function mergeLines(ours: string, base: string, theirs: string): { text: string; conflict: boolean } {
  const res = diff3Merge(ours, base, theirs, {
    excludeFalseConflicts: true,
    stringSeparator: LINE_SEPARATOR,
    label: { a: 'ours', o: 'base', b: 'theirs' },
  });
  return { text: res.result.join('\n'), conflict: res.conflict };
}

/**
 * Слияние правки автора (`ours`, начатой с `base`) с текущим серверным текстом (`theirs`).
 * Markdown/Mermaid — построчный diff3; XML-диаграммы — только скалярное правило «изменил один».
 */
export function mergeContent(
  ours: ContentSnapshot,
  base: ContentSnapshot,
  theirs: ContentSnapshot,
  contentFormat?: string | null
): ContentMergeOutcome {
  const title = mergeScalar(ours.title, base.title, theirs.title);

  let description: { value: string; conflict: boolean };
  let marked = '';
  const scalar = mergeScalar(ours.description, base.description, theirs.description);
  if (!scalar.conflict) {
    description = scalar;
  } else if (isLineMergeableFormat(contentFormat)) {
    const lines = mergeLines(ours.description, base.description, theirs.description);
    description = { value: lines.text, conflict: lines.conflict };
    marked = lines.text;
  } else {
    description = { value: ours.description, conflict: true };
    marked = ours.description;
  }

  if (title.conflict || description.conflict) {
    return {
      status: 'conflict',
      title_conflict: title.conflict,
      description_conflict: description.conflict,
      hunks: { marked },
    };
  }

  const result = { title: title.value, description: description.value };
  const merged = result.title !== ours.title || result.description !== ours.description;
  return { status: 'clean', result, merged };
}
