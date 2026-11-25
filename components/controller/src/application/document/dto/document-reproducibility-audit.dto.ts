import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

@InputType('DocumentReproducibilityAuditInput')
export class DocumentReproducibilityAuditInputDTO {
  @Field(() => Int, { nullable: true, description: 'Номер вида документа в реестре; без него проверяются все виды' })
  @IsOptional()
  @IsInt()
  registry_id?: number;

  @Field(() => Int, { nullable: true, description: 'Сколько сохранённых документов пропустить от начала', defaultValue: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;

  @Field(() => Int, { nullable: true, description: 'Сколько документов проверить за один вызов (не больше 500)', defaultValue: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}

@ObjectType('DocumentReproducibilityAuditRow')
export class DocumentReproducibilityAuditRowDTO {
  @Field(() => Int, { description: 'Номер вида документа в реестре' })
  registry_id!: number;

  @Field(() => String, { description: 'Версия сборщика, записанная в документе' })
  version!: string;

  @Field(() => Int, { description: 'Проверено документов' })
  total!: number;

  @Field(() => Int, { description: 'Пересобрались с тем же HTML и тем же хэшем PDF' })
  reproduced!: number;

  @Field(() => Int, { description: 'HTML совпал, хэш PDF разошёлся' })
  pdf_mismatch!: number;

  @Field(() => Int, { description: 'HTML разошёлся' })
  html_mismatch!: number;

  @Field(() => Int, { description: 'Пересборка завершилась ошибкой' })
  failed!: number;
}

@ObjectType('DocumentReproducibilityAuditMismatch')
export class DocumentReproducibilityAuditMismatchDTO {
  @Field(() => String, { description: 'Хэш сохранённого документа' })
  hash!: string;

  @Field(() => Int, { description: 'Номер вида документа в реестре' })
  registry_id!: number;

  @Field(() => String, { description: 'Версия сборщика, записанная в документе' })
  version!: string;

  @Field(() => Int, { description: 'Блок документа' })
  block_num!: number;

  @Field(() => String, { description: 'Что разошлось: html, pdf или текст ошибки пересборки' })
  reason!: string;
}

@ObjectType('DocumentReproducibilityAudit')
export class DocumentReproducibilityAuditDTO {
  @Field(() => Int, { description: 'Всего сохранённых документов под отбором' })
  stored!: number;

  @Field(() => Int, { description: 'Проверено в этом вызове' })
  checked!: number;

  @Field(() => Int, { description: 'Смещение для следующего вызова; равно stored, когда проверено всё' })
  next_offset!: number;

  @Field(() => [DocumentReproducibilityAuditRowDTO], { description: 'Итоги по видам документов и версиям сборщика' })
  rows!: DocumentReproducibilityAuditRowDTO[];

  @Field(() => [DocumentReproducibilityAuditMismatchDTO], { description: 'Документы, которые не пересобрались; без содержимого' })
  mismatches!: DocumentReproducibilityAuditMismatchDTO[];
}
