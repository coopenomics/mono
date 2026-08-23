export interface PinPadProps {
  modelValue?: string;
  /** Сколько ячеек показывать. По умолчанию 6 — предельная длина PIN-кода. */
  length?: number;
  /** Ошибка подсвечивает ячейки и печатается под ними. */
  error?: string;
  disabled?: boolean;
  /** Поставить курсор в первую ячейку при появлении. */
  autofocus?: boolean;
}
