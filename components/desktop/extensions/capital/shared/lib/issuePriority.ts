import { Zeus } from '@coopenomics/sdk';

/**
 * Получение иконки приоритета задачи
 */
export const getIssuePriorityIcon = (priority: string) => {
  switch (priority) {
    case Zeus.IssuePriority.HIGH:
    case Zeus.IssuePriority.URGENT:
      return 'arrow_upward';
    case Zeus.IssuePriority.LOW:
      return 'arrow_downward';
    case Zeus.IssuePriority.MEDIUM:
    default:
      return 'remove';
  }
};

/**
 * Получение цвета приоритета задачи
 */
export const getIssuePriorityColor = (priority: string) => {
  switch (priority) {
    case Zeus.IssuePriority.URGENT:
      return 'negative';
    case Zeus.IssuePriority.HIGH:
      return 'warning';
    case Zeus.IssuePriority.MEDIUM:
      return 'info';
    case Zeus.IssuePriority.LOW:
      return 'positive';
    default:
      return 'grey-6';
  }
};

/**
 * Получение текста приоритета задачи
 */
export const getIssuePriorityLabel = (priority: string) => {
  switch (priority) {
    case Zeus.IssuePriority.HIGH:
      return 'Высокий';
    case Zeus.IssuePriority.URGENT:
      return 'Срочный';
    case Zeus.IssuePriority.MEDIUM:
      return 'Средний';
    case Zeus.IssuePriority.LOW:
      return 'Низкий';
    default:
      return priority;
  }
};
