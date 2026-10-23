/**
 * Обёртка над node-diff3. Пакет публикует типы только через `exports.types` (без top-level
 * `types`/`main`), поэтому при `moduleResolution: node` TypeScript его не находит, а ts-node не
 * грузит ambient-декларации без `--files`. Берём модуль через require (Node резолвит по
 * `exports.require`) и описываем используемую часть API здесь.
 */
export interface Diff3MergeResult {
  conflict: boolean;
  result: string[];
}

export interface Diff3MergeOptions {
  excludeFalseConflicts?: boolean;
  stringSeparator?: string | RegExp;
  label?: { a?: string; o?: string; b?: string };
}

type Diff3Module = {
  merge: (a: string, o: string, b: string, options?: Diff3MergeOptions) => Diff3MergeResult;
};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const diff3 = require('node-diff3') as Diff3Module;

export const diff3Merge = diff3.merge;
