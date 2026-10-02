import { Field, InputType, Int, ObjectType, registerEnumType } from '@nestjs/graphql';

/** Исход отзыва ключа. */
export enum KeyRevocationStatus {
  /** Ключ отозван, сессии пайщика закрыты */
  Revoked = 'revoked',
}

registerEnumType(KeyRevocationStatus, {
  name: 'KeyRevocationStatus',
  description: 'Исход отзыва ключа пайщика',
});

/** Результат отзыва ключа пайщика председателем. */
@ObjectType('RevokeKeyResult')
export class RevokeKeyResultDTO {
  @Field(() => KeyRevocationStatus, { description: 'Исход отзыва' })
  status!: KeyRevocationStatus;

  @Field(() => String, { description: 'Пайщик, чей ключ отозван' })
  target_id!: string;

  @Field(() => Int, { description: 'Сколько активных сессий пайщика отозвано' })
  sessions_revoked!: number;

  @Field(() => Boolean, { description: 'Пайщик обязан пройти recovery для получения нового ключа' })
  must_recover!: boolean;
}

/** Вход на отзыв ключа пайщика. */
@InputType('RevokeParticipantKeyInput')
export class RevokeParticipantKeyInputDTO {
  @Field(() => String, { description: 'Пайщик, чей ключ отзывается' })
  target_id!: string;

  @Field(() => String, { description: 'Обоснование отзыва' })
  reason!: string;
}
