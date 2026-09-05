import type { BaseBadgeVariant } from 'src/shared/ui/base';

/** Этап решения в журнале робота → подпись и вариант бейджа. Ключи — enum RobotDecisionStage бэкенда. */
export function robotStageMeta(stage: string): { label: string; variant: BaseBadgeVariant } {
  // GraphQL отдаёт имя перечисления (EXECUTED), бэкенд хранит значение (executed) — сравниваем без учёта регистра
  switch (String(stage).toLowerCase()) {
    case 'new':
      return { label: 'Получено', variant: 'info' };
    case 'awaiting_followed':
      return { label: 'Ждёт голоса', variant: 'warn' };
    case 'voted':
      return { label: 'Голоса поданы', variant: 'info' };
    case 'awaiting_quorum':
      return { label: 'Ждёт ручных голосов', variant: 'warn' };
    case 'awaiting_chairman':
      return { label: 'Ждёт председателя', variant: 'warn' };
    case 'awaiting_protocol':
      return { label: 'Собирает протокол', variant: 'info' };
    case 'executed':
      return { label: 'Исполнено', variant: 'pos' };
    case 'closed':
      return { label: 'Закрыто вне робота', variant: 'neutral' };
    case 'failed':
      return { label: 'Застряло', variant: 'neg' };
    default:
      return { label: stage, variant: 'neutral' };
  }
}
