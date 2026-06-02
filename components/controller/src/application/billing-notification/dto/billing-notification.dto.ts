import { IsEnum, IsObject, IsString } from 'class-validator';

/**
 * Типы биллинговых оповещений Epic 14. Провайдер шлёт `kind` (стабильный
 * строковый код), coopback маппит его на конкретный Novu-workflow id.
 * Провайдер НЕ зависит от slug-id workflow'ов (они живут в @coopenomics/notifications).
 */
export enum BillingNotificationKind {
  TRIAL_ENDING = 'trial_ending', // пробный период скоро закончится
  PAYMENT_DUE = 'payment_due', // приближается дата оплаты
  PAST_DUE = 'past_due', // оплата просрочена (past_due, идёт grace)
  SUSPENDED = 'suspended', // сервис приостановлен (grace истёк)
}

/**
 * Входящий notification-intent от провайдера (Вариант А).
 * `coopname` — username аккаунта кооператива-пайщика, по нему coopback
 * резолвит subscriber_id/email получателя (NotificationSenderService).
 * `payload` — данные для шаблона workflow (daysLeft/amount/dueDate/...),
 * валидируются на стороне Novu по zod-схеме конкретного workflow.
 */
export class BillingNotificationRequestDTO {
  @IsEnum(BillingNotificationKind)
  kind: BillingNotificationKind;

  @IsString()
  coopname: string;

  @IsObject()
  payload: Record<string, any>;
}
