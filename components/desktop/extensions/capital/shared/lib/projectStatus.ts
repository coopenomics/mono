import { Zeus } from '@coopenomics/sdk';

/**
 * Получение цвета статуса проекта
 */
export const getProjectStatusColor = (status: string) => {
  switch (status) {
    case Zeus.ProjectStatus.UNDEFINED:
      return 'grey-6';
    case Zeus.ProjectStatus.PENDING:
      return 'warning';
    case Zeus.ProjectStatus.ACTIVE:
      return 'positive';
    case Zeus.ProjectStatus.CANCELLED:
      return 'negative';
    case Zeus.ProjectStatus.RESULT:
      return 'info';
    case Zeus.ProjectStatus.FINALIZED:
      return 'positive';
    case Zeus.ProjectStatus.VOTING:
      return 'primary';
    default:
      return 'grey-6';
  }
};

/**
 * Получение текста статуса проекта
 */
export const getProjectStatusLabel = (status: string) => {
  switch (status) {
    case Zeus.ProjectStatus.ACTIVE:
      return 'Активен';
    case Zeus.ProjectStatus.PENDING:
      return 'Ожидает';
    case Zeus.ProjectStatus.RESULT:
      return 'Приёмка';
    case Zeus.ProjectStatus.FINALIZED:
      return 'Завершен';
    case Zeus.ProjectStatus.CANCELLED:
      return 'Отменён';
    case Zeus.ProjectStatus.UNDEFINED:
      return 'Неопределен';
    case Zeus.ProjectStatus.VOTING:
      return 'Голосование';
    default:
      return status;
  }
};

/**
 * Получение иконки статуса проекта для отображения в виде кругляшка
 */
export const getProjectStatusIcon = (status: string) => {
  switch (status) {
    case Zeus.ProjectStatus.PENDING:
    case 'pending':
      return 'pause';
    case Zeus.ProjectStatus.ACTIVE:
    case 'active':
      return 'play_arrow';
    case Zeus.ProjectStatus.VOTING:
      return 'how_to_vote';
    case Zeus.ProjectStatus.RESULT:
    case 'result':
      return 'check';
    case Zeus.ProjectStatus.FINALIZED:
      return 'check_circle';
    case Zeus.ProjectStatus.CANCELLED:
      return 'lock';
    case Zeus.ProjectStatus.UNDEFINED:
    case 'cancelled':
    default:
      return 'radio_button_unchecked';
  }
};

/**
 * Получение цвета кругляшка статуса проекта
 */
export const getProjectStatusDotColor = (status: string) => {
  switch (status) {
    case Zeus.ProjectStatus.PENDING:
      return 'grey-6';
    case Zeus.ProjectStatus.ACTIVE:
      return 'positive';
    case Zeus.ProjectStatus.VOTING:
      return 'positive';
    case Zeus.ProjectStatus.RESULT:
      return 'positive';
    case Zeus.ProjectStatus.FINALIZED:
      return 'positive';
    case Zeus.ProjectStatus.CANCELLED:
      return 'grey-6';
    case Zeus.ProjectStatus.UNDEFINED:
    default:
      return 'grey-6';
  }
};
