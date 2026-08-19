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
    case Zeus.ProjectStatus.UNDEFINED:
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
    case Zeus.ProjectStatus.UNDEFINED:
    default:
      return 'grey-6';
  }
};

/**
 * Вариант BaseChip для статуса проекта/компонента (инлайн-чип в строках списков)
 */
export const getProjectStatusChipVariant = (status: string) => {
  switch (status) {
    case Zeus.ProjectStatus.PENDING:
      return 'warn' as const;
    case Zeus.ProjectStatus.ACTIVE:
      return 'pos' as const;
    case Zeus.ProjectStatus.VOTING:
      return 'accent' as const;
    case Zeus.ProjectStatus.RESULT:
      return 'info' as const;
    case Zeus.ProjectStatus.FINALIZED:
      return 'pos' as const;
    default:
      return 'neutral' as const;
  }
};

/**
 * Единый список статусов проекта для инлайн-меню и селектов.
 * «Отменён» не предлагаем: прекращение проекта — это его удаление.
 */
export const PROJECT_STATUS_OPTIONS = [
  Zeus.ProjectStatus.PENDING,
  Zeus.ProjectStatus.ACTIVE,
  Zeus.ProjectStatus.VOTING,
  Zeus.ProjectStatus.RESULT,
  Zeus.ProjectStatus.FINALIZED,
].map((value) => ({ value, label: getProjectStatusLabel(value) }));
