export interface BaseSelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface BaseSelectProps {
  modelValue?: string | number | null;
  options: BaseSelectOption[];
  label?: string;
  placeholder?: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  id?: string;
  /**
   * Позволяет искать по списку с клавиатуры: поле принимает ввод и оставляет
   * варианты, где введённое встречается в подписи. Нужен там, где вариантов
   * десятки и человек знает часть кода («0001» → «Бокс BX-0001»).
   */
  searchable?: boolean;
  /** Разрешает снять выбор крестиком (значение станет null). */
  clearable?: boolean;
}
