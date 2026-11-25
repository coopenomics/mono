/**
 * Материалы занятия в поле ввода — по ссылке на строку. Один разбор у окна
 * отчёта и у окна повторной подачи: пустые строки и пробелы по краям не в счёт.
 */
export const materialsToText = (links: readonly string[] | null | undefined): string => (links ?? []).join('\n');

export const parseMaterials = (text: string): string[] =>
  text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
