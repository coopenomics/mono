import { Field, ObjectType } from '@nestjs/graphql';

/** Документ преподавателя, который ждёт подписи председателя. */
@ObjectType('EduApproval')
export class EduApprovalDTO {
  @Field(() => String, { description: 'Хэш одобрения — по нему председатель подписывает или отклоняет' })
  approval_hash!: string;

  @Field(() => String, { description: 'Пайщик, чей документ ждёт подписи' })
  username!: string;

  @Field(() => String, { description: 'Тип одобрения — действие контракта образования' })
  action!: string;

  @Field(() => String, { description: 'Что подписывается: договор или приложение к нему на курс' })
  title!: string;

  @Field(() => Date, { description: 'Когда документ отправлен на подпись' })
  created_at!: Date;
}
