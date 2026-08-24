import { registerEnumType } from '@nestjs/graphql';

/**
 * Роль, к которой пайщик получает допуск на компоненте.
 * Значения совпадают с именами ролей в контракте (Capital::RoleRequests::Role).
 */
export enum ProjectRole {
  CREATOR = 'creator', // Исполнитель — ведёт работы и создаёт коммиты
  AUTHOR = 'author', // Соавтор результата
  MASTER = 'master', // Мастер компонента — принимает работы и утверждает ставку
}

registerEnumType(ProjectRole, {
  name: 'ProjectRole',
  description: 'Роль пайщика на компоненте',
});

/**
 * Кто начал: пайщик просит допуск сам либо мастер приглашает кандидата.
 */
export enum RoleRequestDirection {
  REQUEST = 'request', // Заявка пайщика
  INVITE = 'invite', // Приглашение от мастера
}

registerEnumType(RoleRequestDirection, {
  name: 'RoleRequestDirection',
  description: 'Заявка пайщика или приглашение мастера',
});

/**
 * О чём заявка: о допуске к роли либо об изменении ставки часа.
 */
export enum RoleRequestType {
  ROLE = 'role', // Допуск к роли на компоненте
  RATE_UPDATE = 'rateupdate', // Изменение утверждённой ставки часа
}

registerEnumType(RoleRequestType, {
  name: 'RoleRequestType',
  description: 'Предмет заявки: допуск к роли или изменение ставки часа',
});

/**
 * Состояние заявки. Отклонённая заявка остаётся в реестре с причиной отказа.
 */
export enum RoleRequestStatus {
  PENDING = 'pending', // Ожидает решения
  APPROVED = 'approved', // Одобрена
  DECLINED = 'declined', // Отклонена
}

registerEnumType(RoleRequestStatus, {
  name: 'RoleRequestStatus',
  description: 'Состояние заявки на допуск',
});
