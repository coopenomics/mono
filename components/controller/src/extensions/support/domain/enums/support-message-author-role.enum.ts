import { registerEnumType } from '@nestjs/graphql';

/**
 * Снимок роли автора записи в ленте на момент её создания.
 *
 * Пишется снимком, а не вычисляется из текущего состава совета: пайщик может
 * позже войти в совет, и вычисление задним числом превратило бы его старые
 * сообщения в «ответы оператора».
 */
export enum SupportMessageAuthorRole {
  MEMBER = 'MEMBER',
  OPERATOR = 'OPERATOR',
  SYSTEM = 'SYSTEM',
}

registerEnumType(SupportMessageAuthorRole, {
  name: 'SupportMessageAuthorRole',
  description: 'Роль автора записи в переписке обращения.',
  valuesMap: {
    MEMBER: { description: 'Пайщик — автор обращения.' },
    OPERATOR: { description: 'Оператор поддержки, отвечающий от лица совета.' },
    SYSTEM: { description: 'Запись самой системы, не человека.' },
  },
});
