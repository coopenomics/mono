import { t } from '../i18n';
/**
 * Маппинг типов одобрений на заголовки и описания для уведомлений
 */
export const APPROVAL_TYPE_MAP = {
  approvecmmt: {
    title: t('chairman.approvalTypes.commit.title'),
    description: t('chairman.approvalTypes.commit.description'),
  },
  approvepjprp: {
    title: t('chairman.approvalTypes.projectContribution.title'),
    description: t('chairman.approvalTypes.projectContribution.description'),
  },
  approvepgprp: {
    title: t('chairman.approvalTypes.programContribution.title'),
    description: t('chairman.approvalTypes.programContribution.description'),
  },
  approvereg: {
    title: t('chairman.approvalTypes.registration.title'),
    description: t('chairman.approvalTypes.registration.description'),
  },
  approveinvst: {
    title: t('chairman.approvalTypes.investment.title'),
    description: t('chairman.approvalTypes.investment.description'),
  },
  apprvappndx: {
    title: t('chairman.approvalTypes.projectAccess.title'),
    description: t('chairman.approvalTypes.projectAccess.description'),
  },
  approverslt: {
    title: t('chairman.approvalTypes.result.title'),
    description: t('chairman.approvalTypes.result.description'),
  },
  apprvcontr: {
    title: t('chairman.approvalTypes.teacherContract.title'),
    description: t('chairman.approvalTypes.teacherContract.description'),
  },
  apprvridact: {
    title: t('chairman.approvalTypes.teacherRidAct.title'),
    description: t('chairman.approvalTypes.teacherRidAct.description'),
  },
} as const;

export type ApprovalType = keyof typeof APPROVAL_TYPE_MAP;

export type ApprovalInfo = (typeof APPROVAL_TYPE_MAP)[ApprovalType];

/**
 * Заголовок и описание одобрения. Запись одобрения в цепи несёт имя действия
 * подачи (`type`) и имя действия одобрения (`callback_action_approve`); карта
 * ведётся по действию одобрения.
 */
export function approvalInfoOf(approval: { type?: string; callback_action_approve?: string }): ApprovalInfo | undefined {
  const map = APPROVAL_TYPE_MAP as Record<string, ApprovalInfo>;
  return map[approval.callback_action_approve ?? ''] ?? map[approval.type ?? ''];
}
