import type { BaseBadgeVariant } from 'src/shared/ui/base';
import { t } from '../i18n';

/** Этап решения в журнале робота → подпись и вариант бейджа. Ключи — enum RobotDecisionStage бэкенда. */
export function robotStageMeta(stage: string): { label: string; variant: BaseBadgeVariant } {
  // GraphQL отдаёт имя перечисления (EXECUTED), бэкенд хранит значение (executed) — сравниваем без учёта регистра
  switch (String(stage).toLowerCase()) {
    case 'new':
      return { label: t('robot.action.status.new'), variant: 'info' };
    case 'awaiting_followed':
      return { label: t('robot.action.status.awaitingFollowed'), variant: 'warn' };
    case 'voted':
      return { label: t('robot.action.status.voted'), variant: 'info' };
    case 'awaiting_quorum':
      return { label: t('robot.action.status.awaitingQuorum'), variant: 'warn' };
    case 'awaiting_chairman':
      return { label: t('robot.action.status.awaitingChairman'), variant: 'warn' };
    case 'awaiting_protocol':
      return { label: t('robot.action.status.awaitingProtocol'), variant: 'info' };
    case 'executed':
      return { label: t('robot.action.status.executed'), variant: 'pos' };
    case 'closed':
      return { label: t('robot.action.status.closed'), variant: 'neutral' };
    case 'failed':
      return { label: t('robot.action.status.failed'), variant: 'neg' };
    default:
      return { label: stage, variant: 'neutral' };
  }
}
