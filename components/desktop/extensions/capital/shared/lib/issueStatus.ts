import { Zeus } from '@coopenomics/sdk';
import { t } from '../../i18n';

/**
 * Получение цвета статуса задачи
 */
export const getIssueStatusColor = (status: string) => {
  switch (status) {
    case Zeus.IssueStatus.TODO:
      return 'negative';
    case Zeus.IssueStatus.IN_PROGRESS:
      return 'info';
    case Zeus.IssueStatus.BACKLOG:
      return 'warning';
    case Zeus.IssueStatus.ON_REVIEW:
      return 'primary';
    case Zeus.IssueStatus.DONE:
      return 'positive';
    case Zeus.IssueStatus.CANCELED:
      return 'grey-6';
    default:
      return 'grey-6';
  }
};

/**
 * Получение текста статуса задачи
 */
export const getIssueStatusLabel = (status: string) => {
  switch (status) {
    case Zeus.IssueStatus.TODO:
      return t('capital.issue.status.todo');
    case Zeus.IssueStatus.IN_PROGRESS:
      return t('capital.issue.status.inProgress');
    case Zeus.IssueStatus.BACKLOG:
      return t('capital.issue.status.backlog');
    case Zeus.IssueStatus.ON_REVIEW:
      return t('capital.issue.status.onReview');
    case Zeus.IssueStatus.DONE:
      return t('capital.issue.status.done');
    case Zeus.IssueStatus.CANCELED:
      return t('capital.issue.status.canceled');
    default:
      return status;
  }
};
