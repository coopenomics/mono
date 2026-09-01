export interface OtpInputProps {
  modelValue?: string;
  /** Длина OTP-кода. По умолчанию 6 */
  length?: number;
  /** Ошибка отрисовывает все ячейки в neg-состоянии */
  error?: string;
  disabled?: boolean;
  /** autofocus на первую ячейку при монтировании */
  autofocus?: boolean;
  /**
   * Скрывать введённое точками. Код из письма показывают открыто — его для того и
   * прислали; PIN-код же вводят при посторонних, и на экране ему не место.
   */
  masked?: boolean;
  name?: string;
}
