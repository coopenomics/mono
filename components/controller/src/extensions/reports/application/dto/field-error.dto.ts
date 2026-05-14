import { Field, ObjectType } from '@nestjs/graphql';

/**
 * Ошибка валидации поля edits-формы.
 *
 * `path` — точечный JSONPath совпадает с теми, что трекает клиент в
 * `editedFields` (пример: `organization.inn`, `balance.assetsTotal.otch`).
 * На фронте по path находим q-input и подсвечиваем красным.
 *
 * `message` — человекочитаемое сообщение от class-validator
 * («ИНН ЮЛ — 10 цифр», «1..1000 символов», и т.п.).
 */
@ObjectType('FieldError')
export class FieldErrorDTO {
  @Field(() => String)
  path!: string;

  @Field(() => String)
  message!: string;
}
