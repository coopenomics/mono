import { registerEnumType } from '@nestjs/graphql';

/**
 * Зона ответственности за обращение. Задел на будущее — в первой версии не
 * используется, всегда `COOPERATIVE`.
 */
export enum SupportResponsibilityZone {
  COOPERATIVE = 'COOPERATIVE',
  PLATFORM = 'PLATFORM',
}

registerEnumType(SupportResponsibilityZone, {
  name: 'SupportResponsibilityZone',
  description: 'Зона ответственности за обращение.',
  valuesMap: {
    COOPERATIVE: { description: 'Ответственность несёт кооператив.' },
    PLATFORM: { description: 'Ответственность несёт платформа.' },
  },
});
