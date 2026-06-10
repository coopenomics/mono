import { Zeus } from '@coopenomics/sdk';

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
      return 'К выполнению';
    case Zeus.IssueStatus.IN_PROGRESS:
      return 'В работе';
    case Zeus.IssueStatus.BACKLOG:
      return 'Бэклог';
    case Zeus.IssueStatus.ON_REVIEW:
      return 'На проверке';
    case Zeus.IssueStatus.DONE:
      return 'Выполнена';
    case Zeus.IssueStatus.CANCELED:
      return 'Отменена';
    default:
      return status;
  }
};
