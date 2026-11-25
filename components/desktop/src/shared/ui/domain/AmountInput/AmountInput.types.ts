export interface AmountInputProps {
  modelValue?: number | string | null;
  /** Символ валюты (например `RUB`, `₽`, `USD`) — отображается как суффикс */
  symbol?: string;
  /** Количество знаков после запятой (precision из marketplace asset config) */
  precision?: number;
  label?: string;
  hint?: string;
  error?: string;
  placeholder?: string;
  /**
   * Подпись всегда поднята над полем — как у `BaseInput stack-label`. Нужна,
   * когда сумма стоит в ряду с полем даты: Quasar поднимает метку даты всегда,
   * и без этого две рамки в одном ряду выглядят по-разному.
   */
  stackLabel?: boolean;
  min?: number;
  max?: number;
  /** Показать кнопку «макс» */
  showMax?: boolean;
  /** Доступный баланс — используется кнопкой «макс» */
  balance?: number | string;
  disabled?: boolean;
  readonly?: boolean;
  /** Подпись под полем «Баланс: …» */
  showBalance?: boolean;
  name?: string;
  id?: string;
}
