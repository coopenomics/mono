export interface BaseInputProps {
  modelValue?: string | number | null;
  label?: string;
  hint?: string;
  error?: string;
  placeholder?: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search' | 'date' | 'textarea';
  autogrow?: boolean;
  /** Моноширинный шрифт (для аккаунт-имён, hash, и т.п.) */
  mono?: boolean;
  /** Кнопка очистки значения (например, для фильтров по дате) */
  clearable?: boolean;
  /** Безрамочный режим: без outline-рамки и без резерва строки hint снизу.
   *  Для инлайн-правки прямо в ячейке/строке — поле читается как текст, на фокусе
   *  подсвечивается. НЕ для форм (там нужна рамка и резерв под ошибку). */
  flat?: boolean;
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
