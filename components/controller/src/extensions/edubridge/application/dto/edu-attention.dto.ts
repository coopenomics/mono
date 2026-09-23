import { Field, Int, ObjectType } from '@nestjs/graphql';

/**
 * Сколько дел ждёт администратора — числа на пунктах меню стола. Раздел, к
 * которому у пользователя нет доступа, даёт ноль.
 */
@ObjectType('EduAttention')
export class EduAttentionDTO {
  @Field(() => Int, { description: 'Преподаватели: договоры и приложения на подписи у председателя' })
  teachers!: number;

  @Field(() => Int, { description: 'Ученики: задачи выдачи или отзыва доступа, которые требуют вмешательства' })
  learners!: number;
}
