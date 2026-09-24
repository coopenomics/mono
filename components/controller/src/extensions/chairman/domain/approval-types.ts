import { t, t as i18nT } from '../i18n';
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
    title: i18nT('chairman.approvalTypes.teacherContract.title'),
    description: i18nT('chairman.approvalTypes.teacherContract.description'),
  },
  apprvannex: {
    title: i18nT('chairman.approvalTypes.courseAnnex.title'),
    description: i18nT('chairman.approvalTypes.courseAnnex.description'),
  },
} as const;

export type ApprovalType = keyof typeof APPROVAL_TYPE_MAP;

export type ApprovalInfo = (typeof APPROVAL_TYPE_MAP)[ApprovalType];
