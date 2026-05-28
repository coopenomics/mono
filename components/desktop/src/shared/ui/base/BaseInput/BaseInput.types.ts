export interface BaseInputProps {
  modelValue?: string | number | null;
  label?: string;
  hint?: string;
  error?: string;
  placeholder?: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search' | 'date';
  /** Моноширинный шрифт (для аккаунт-имён, hash, и т.п.) */
  mono?: boolean;
  /** Кнопка очистки значения (например, для фильтров по дате) */
  clearable?: boolean;
  /** Постфикс в правой части поля (например `RUB`) */
  suffix?: string;
  /** Префикс в левой части поля */
  prefix?: string;
  readonly?: boolean;
  disabled?: boolean;
  required?: boolean;
  autocomplete?: string;
  name?: string;
  id?: string;
}
