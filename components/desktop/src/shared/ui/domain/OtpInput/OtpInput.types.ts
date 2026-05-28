export interface OtpInputProps {
  modelValue?: string;
  /** Длина OTP-кода. По умолчанию 6 */
  length?: number;
  /** Ошибка отрисовывает все ячейки в neg-состоянии */
  error?: string;
  disabled?: boolean;
  /** autofocus на первую ячейку при монтировании */
  autofocus?: boolean;
  name?: string;
}
