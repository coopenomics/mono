/**
 * Тип платежа по назначению
 */
export enum PaymentTypeEnum {
  // Входящие платежи (от пользователей к кооперативу)
  REGISTRATION = 'registration', // Регистрационный взнос
  DEPOSIT = 'deposit', // Паевой взнос
  WITHDRAWAL = 'withdrawal', // Возврат паевого взноса
  // Исходящий возврат вступительного и мин. паевого взносов при отказе совета
  // в приёме. Отдельный тип, не WITHDRAWAL — чтобы не путать с возвратом паевого.
  REGISTRATION_REFUND = 'registration_refund',
  // Исходящий возврат всего паевого взноса при выходе пайщика из кооператива.
  // Отдельный тип, не WITHDRAWAL — это полный выход с блокировкой аккаунта,
  // а не частичный возврат паевого действующему пайщику.
  MEMBERSHIP_EXIT = 'membership_exit',
  // Исходящая оплата позиции служебной записки-сметы (шасси expense). Создаётся
  // автоматически после авторизации СЗ советом; подтверждение кассиром проводит
  // on-chain оплату expense::payexp по позиции.
  EXPENSE = 'expense',
  // Входящий возврат неиспользованного аванса под отчёт (недорасход). Создаётся,
  // когда пайщик отчитался о факте меньше выданного аванса: он возвращает разницу
  // на расчётный счёт кооператива; подтверждение кассиром (приём средств)
  // проводит on-chain expense::returnexp и закрывает позицию expense::reportexp.
  EXPENSE_RETURN = 'expense_return',
  // Исходящая доплата при перерасходе аванса под отчёт. Создаётся, когда пайщик
  // отчитался о факте больше выданного аванса: кооператив доплачивает разницу;
  // подтверждение кассиром (выплата) проводит on-chain expense::overspendexp и
  // закрывает позицию expense::reportexp.
  EXPENSE_OVERSPEND = 'expense_overspend',
}

/**
 * Направление платежа
 */
export enum PaymentDirectionEnum {
  INCOMING = 'incoming', // Входящий платеж
  OUTGOING = 'outgoing', // Исходящий платеж
}

/**
 * Человекочитаемые названия типов платежей
 */
export const PAYMENT_TYPE_LABELS: Record<PaymentTypeEnum, string> = {
  [PaymentTypeEnum.REGISTRATION]: 'Вступительный и мин. паевой взносы',
  [PaymentTypeEnum.DEPOSIT]: 'Паевой взнос',
  [PaymentTypeEnum.WITHDRAWAL]: 'Возврат паевого взноса',
  [PaymentTypeEnum.REGISTRATION_REFUND]: 'Возврат вступит. и мин.паевого взноса',
  [PaymentTypeEnum.MEMBERSHIP_EXIT]: 'Возврат паевого взноса при выходе из кооператива',
  [PaymentTypeEnum.EXPENSE]: 'Оплата расхода по служебной записке',
  [PaymentTypeEnum.EXPENSE_RETURN]: 'Возврат неиспользованного аванса под отчёт',
  [PaymentTypeEnum.EXPENSE_OVERSPEND]: 'Доплата по перерасходу аванса',
};

/**
 * Налоговая оговорка для назначения платежа. Взносы пайщика (вступительный,
 * минимальный паевой, паевой) и их возврат НДС не облагаются. Оговорка обязана
 * присутствовать целиком в memo каждого платежа — это единый источник назначения:
 * провайдеры QR (qrpay/sberpoll) её больше НЕ дописывают, чтобы не задвоить.
 */
export const VAT_EXEMPT_NOTE = 'НДС не облагается.';

/**
 * Человекочитаемые названия направлений платежей
 */
export const PAYMENT_DIRECTION_LABELS: Record<PaymentDirectionEnum, string> = {
  [PaymentDirectionEnum.INCOMING]: 'Входящий',
  [PaymentDirectionEnum.OUTGOING]: 'Исходящий',
};

/**
 * Определяет направление платежа по его типу
 */
export function getPaymentDirection(type: PaymentTypeEnum): PaymentDirectionEnum {
  return INCOMING_PAYMENT_TYPES.includes(type) ? PaymentDirectionEnum.INCOMING : PaymentDirectionEnum.OUTGOING;
}

/**
 * Входящие типы платежей
 */
export const INCOMING_PAYMENT_TYPES = [
  PaymentTypeEnum.REGISTRATION,
  PaymentTypeEnum.DEPOSIT,
  PaymentTypeEnum.EXPENSE_RETURN,
];

/**
 * Исходящие типы платежей
 */
export const OUTGOING_PAYMENT_TYPES = [
  PaymentTypeEnum.WITHDRAWAL,
  PaymentTypeEnum.REGISTRATION_REFUND,
  PaymentTypeEnum.MEMBERSHIP_EXIT,
  PaymentTypeEnum.EXPENSE,
  PaymentTypeEnum.EXPENSE_OVERSPEND,
];
