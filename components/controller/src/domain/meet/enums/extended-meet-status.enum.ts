import { registerEnumType } from '@nestjs/graphql';
import { ExtendedMeetStatus } from '@coopenomics/innercoop';

/**
 * Сам перечень статусов живёт в `@coopenomics/innercoop`: расширения сравнивают
 * с его значениями, а этого пути за пределами монолита нет. Здесь остаётся
 * регистрация в схеме GraphQL — она нужна только ядру, которое отдаёт статус
 * полем, и тянет за собой `@nestjs/graphql`, которого в контрактном пакете нет.
 */
export { ExtendedMeetStatus };

// Регистрируем перечисление для GraphQL
registerEnumType(ExtendedMeetStatus, {
  name: 'ExtendedMeetStatus',
  description: 'Расширенный статус собрания на основе дат и состояния',
  valuesMap: {
    NONE: {
      description: 'Неопределенное состояние',
    },
    CREATED: {
      description: 'Создано',
    },
    AUTHORIZED: {
      description: 'Авторизовано',
    },
    PRECLOSED: {
      description: 'Предварительно закрыто',
    },
    CLOSED: {
      description: 'Закрыто',
    },
    ONRESTART: {
      description: 'Ожидаем утверждения новой даты собрания',
    },
    WAITING_FOR_OPENING: {
      description: 'Ожидает открытия',
    },
    VOTING_IN_PROGRESS: {
      description: 'Голосование идет',
    },
    EXPIRED_NO_QUORUM: {
      description: 'Истекло без кворума',
    },
    VOTING_COMPLETED: {
      description: 'Голосование завершено, ожидает подписей',
    },
  },
});
