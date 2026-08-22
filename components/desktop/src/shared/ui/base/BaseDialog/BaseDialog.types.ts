export type BaseDialogSize = 'sm' | 'md' | 'lg' | 'xl';

export interface BaseDialogProps {
  modelValue: boolean;
  title?: string;
  size?: BaseDialogSize;
  /** Закрытие по клику на backdrop */
  closeOnBackdrop?: boolean;
  /**
   * Закрытие при смене роута (поведение q-dialog по умолчанию). Выключать для
   * диалогов, поднимающихся во время загрузки приложения: стартовый редирект на
   * дефолтный стол иначе молча закрывает их раньше, чем пользователь их увидит.
   */
  closeOnRouteChange?: boolean;
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
