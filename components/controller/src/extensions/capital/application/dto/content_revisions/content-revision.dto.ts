import { ObjectType, Field, Int } from '@nestjs/graphql';
import { ContentEntityType } from '../../../domain/enums/content-entity-type.enum';
import { ContentRevisionOrigin } from '../../../domain/enums/content-revision-origin.enum';

/**
 * Запись истории редакций без тела — для списка в окне «Редакции».
 */
@ObjectType('CapitalContentRevisionSummary', {
  description: 'Редакция содержимого проекта/задачи/артефакта (без тела)',
})
export class ContentRevisionSummaryDTO {
  @Field(() => ContentEntityType, { description: 'Тип сущности' })
  entity_type!: ContentEntityType;

  @Field(() => String, { description: 'Хэш сущности' })
  entity_hash!: string;

  @Field(() => Int, { description: 'Номер редакции (монотонный в пределах сущности)' })
  rev!: number;

  @Field(() => Int, { nullable: true, description: 'Редакция, с которой автор начал правку' })
  base_rev?: number | null;

  @Field(() => String, { description: 'Заголовок на момент редакции' })
  title!: string;

  @Field(() => String, { description: 'SHA-256 содержимого (title + description)' })
  content_hash!: string;

  @Field(() => String, { description: 'Автор редакции (username)' })
  author!: string;

  @Field(() => ContentRevisionOrigin, { description: 'Источник редакции' })
  origin!: ContentRevisionOrigin;

  @Field(() => Int, { nullable: true, description: 'Для RESTORE — номер редакции, к которой откатились' })
  restored_from_rev?: number | null;

  @Field(() => Boolean, { description: 'Текст получен слиянием с параллельной правкой' })
  merged!: boolean;

  @Field(() => Int, { description: 'Размер тела в символах' })
  description_length!: number;

  @Field(() => Int, { description: 'Изменение размера тела относительно предыдущей редакции' })
  description_delta!: number;

  @Field(() => Date, { description: 'Момент записи редакции' })
  created_at!: Date;
}

/**
 * Редакция с телом — для просмотра и сравнения.
 */
@ObjectType('CapitalContentRevision', {
  description: 'Редакция содержимого проекта/задачи/артефакта с телом',
})
export class ContentRevisionDTO extends ContentRevisionSummaryDTO {
  @Field(() => String, { description: 'Тело (description) на момент редакции' })
  description!: string;

  @Field(() => String, { nullable: true, description: 'Формат тела (для артефактов)' })
  content_format?: string | null;
}
