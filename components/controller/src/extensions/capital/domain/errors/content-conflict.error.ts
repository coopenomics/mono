import { GraphQLError } from 'graphql';
import type { ContentEntityType } from '../enums/content-entity-type.enum';

export const CONTENT_CONFLICT_CODE = 'CONTENT_CONFLICT';

export interface ContentConflictPayload {
  entity_type: ContentEntityType;
  entity_hash: string;
  /** Редакция, с которой начал автор. */
  base_rev: number;
  /** Текущая редакция на сервере. */
  current_rev: number;
  title_conflict: boolean;
  description_conflict: boolean;
  ours: { title: string; description: string };
  theirs: { title: string; description: string };
  base: { title: string; description: string } | null;
  /** Тело с маркерами конфликта (ours/base/theirs), пусто для XML-форматов. */
  marked: string;
}

/**
 * Конфликт редакций, который не удалось слить автоматически.
 * Уходит клиенту как GraphQLError с `extensions.code = CONTENT_CONFLICT` и обеими версиями:
 * ничего не сохранено, правка автора не потеряна.
 */
export class ContentConflictError extends GraphQLError {
  constructor(public readonly payload: ContentConflictPayload) {
    super('Документ изменён параллельно: автоматическое слияние невозможно, разрешите конфликт и сохраните снова', {
      extensions: { code: CONTENT_CONFLICT_CODE, conflict: payload },
    });
    this.name = 'ContentConflictError';
  }
}
