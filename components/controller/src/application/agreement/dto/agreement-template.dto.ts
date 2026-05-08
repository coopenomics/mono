import { Field, Int, ObjectType } from '@nestjs/graphql';

/**
 * Шаблон документа соглашения (`draft::drafts`). Объединение глобальных
 * шаблонов (scope=draft) и per-coop шаблонов (scope=coopname).
 *
 * Используется фронтом для отображения текста соглашения и для сравнения
 * версии подписи пайщика с актуальной версией шаблона (повторное
 * требование подписи при upversion'е).
 */
@ObjectType('AgreementTemplate')
export class AgreementTemplateDTO {
  @Field(() => Int, { description: 'Идентификатор шаблона в реестре drafts' })
  registry_id!: number;

  @Field(() => Int, { description: 'Версия шаблона (инкрементится при upversion)' })
  version!: number;

  @Field(() => Int, { description: 'Идентификатор перевода по умолчанию' })
  default_translation_id!: number;

  @Field(() => String, { description: 'Заголовок шаблона' })
  title!: string;

  @Field(() => String, { description: 'Описание шаблона' })
  description!: string;

  @Field(() => String, { description: 'Контекст (HTML/markup) шаблона' })
  context!: string;

  @Field(() => String, { description: 'JSON-строка модели данных для подстановки' })
  model!: string;
}
