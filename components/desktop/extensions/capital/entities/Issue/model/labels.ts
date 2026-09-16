import type { IIssue } from './types';

/**
 * Метки задачи живут в `metadata.labels`, а не отдельным полем: у `CapitalIssue`
 * поля `labels` нет вовсе. Оверлей задачи попытался писать их напрямую и уронил
 * сборку типов на проде (`error TS2345: '"labels"' is not assignable…`,
 * 04.09.2026) — оба места, где метки правятся, обязаны идти одной дорогой.
 *
 * Возвращает НОВЫЙ объект метаданных: прежние поля сохраняются, а мутировать
 * чужой объект на месте нельзя — он приходит из ответа сервера и переиспользуется.
 */
export function withLabels(metadata: IIssue['metadata'], labels: string[]): IIssue['metadata'] {
  const base: Record<string, unknown> =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? { ...(metadata as Record<string, unknown>) }
      : {};
  base.labels = labels;
  return base as IIssue['metadata'];
}
