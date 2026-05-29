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
  /**
   * Развернуть диалог на весь экран. Используется для просмотра/подписания
   * крупных документов (оферта, соглашение) и для пошагового онбординг-flow,
   * где content не помещается в стандартные 360/440/640. Если включён —
   * `size` игнорируется.
   */
  maximized?: boolean;
}
