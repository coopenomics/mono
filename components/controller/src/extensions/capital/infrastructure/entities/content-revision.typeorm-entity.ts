import { ContentEntityType } from '../../domain/enums/content-entity-type.enum';
import { ContentRevisionOrigin } from '../../domain/enums/content-revision-origin.enum';

export const EntityName = 'capital_content_revisions';

/**
 * Снимок содержимого (title + description) сущности на момент каждой успешной записи.
 * Номер `rev` монотонный в пределах (entity_type, entity_hash); растёт только от содержательной правки,
 * синхронизация из цепи и дочерние мутации его не двигают.
 */
export class ContentRevisionTypeormEntity {
  _id!: string;

  entity_type!: ContentEntityType;

  entity_hash!: string;

  rev!: number;

  /** Редакция, с которой автор начал правку (для трассировки слияний). */
  base_rev?: number | null;

  title!: string;

  description?: string | null;

  content_format?: string | null;

  content_hash!: string;

  author!: string;

  origin!: ContentRevisionOrigin;

  /** Для origin=RESTORE — номер редакции, к которой откатились. */
  restored_from_rev?: number | null;

  /** true — текст получен трёхсторонним слиянием с параллельной правкой. */
  merged!: boolean;

  created_at!: Date;
}
