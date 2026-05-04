/**
 * Человекочитаемые подписи к техническим именам — контракты и lifecycle-статусы.
 * Используются и в Sidebar, и в HomePage.
 */

export const CONTRACT_HUMAN: Record<string, string> = {
  registrator: 'Регистратор',
  wallet: 'Главный кошелёк',
  capital: '«Благорост»',
  marketplace: '«Стол заказов»',
  soviet: 'Совет',
  meet: 'Общие собрания',
  ledger2: 'Учёт операций',
};

export const STATUS_HUMAN: Record<string, string> = {
  proposed: 'предложен',
  approved: 'утверждён',
  active: 'действующий',
  deprecated: 'устаревший',
};
