export type BaseDialogSize = 'sm' | 'md' | 'lg';

export interface BaseDialogProps {
  modelValue: boolean;
  title?: string;
  size?: BaseDialogSize;
  /** Закрытие по клику на backdrop */
  closeOnBackdrop?: boolean;
  /** Закрытие по Escape */
  closeOnEscape?: boolean;
  /** Спрятать стандартную кнопку «×» в шапке */
  hideCloseButton?: boolean;
}
