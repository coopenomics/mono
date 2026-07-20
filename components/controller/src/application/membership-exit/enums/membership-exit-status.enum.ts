import { registerEnumType } from '@nestjs/graphql';

/**
 * Статус процесса выхода пайщика из кооператива (registrator::exits.status).
 */
export enum MembershipExitStatus {
  // Заявление подписано и принято, но в блокчейн ещё не отправлено —
  // ожидает подтверждения пайщиком по ссылке из письма (off-chain фаза).
  AWAITING_CONFIRMATION = 'awaiting_confirmation',
  // Заявление подано в блокчейн, ожидает решения совета.
  PENDING = 'pending',
  // Совет одобрил, идёт возврат паевого взноса (зарезервирован, исходящий платёж).
  AUTHORIZED = 'authorized',
  // Выход завершён: возврат оплачен, аккаунт заблокирован, пайщик вышел.
  // exits-строка на цепи уже стёрта (терминал=erase) — статус восстанавливаем
  // по blocked-аккаунту и завершённому MEMBERSHIP_EXIT-платежу.
  COMPLETED = 'completed',
}

registerEnumType(MembershipExitStatus, {
  name: 'MembershipExitStatus',
  description: 'Статус процесса выхода пайщика из кооператива',
});
