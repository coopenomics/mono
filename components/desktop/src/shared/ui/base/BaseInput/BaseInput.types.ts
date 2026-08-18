export interface BaseInputProps {
  modelValue?: string | number | null;
  label?: string;
  hint?: string;
  error?: string;
  placeholder?: string;
  /**
   * Метка всегда поднята над полем (а не лежит внутри до фокуса).
   *
   * Нужна там, где в одном ряду стоят поля разных типов: у `type="date"` Quasar
   * своим CSS поднимает метку принудительно, и рядом с обычным текстовым полем
   * получаются две разные на вид рамки. С поднятой меткой ряд читается одним
   * блоком, а `placeholder` показывает пример ввода — как в эталоне `_dev/ui`.
   */
  stackLabel?: boolean;
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search' | 'date' | 'datetime-local' | 'textarea';
  /** Авторост высоты для type="textarea" */
  autogrow?: boolean;
  /**
   * Сколько строк показывать у `type="textarea"` до ввода. Поле в одну строку
   * не сообщает, что сюда ждут развёрнутый текст, а `autogrow` растит его
   * только по факту ввода — стартовую высоту задаём этим.
   */
  rows?: number;
  /** Маска ввода Quasar: `#` — цифра (например `####` — серия паспорта, `###-###` — код подразделения) */
  mask?: string;
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
  /** Забрать фокус при появлении — для инлайн-правки, открывающейся по клику. */
  autofocus?: boolean;
  readonly?: boolean;
  disabled?: boolean;
  required?: boolean;
  autocomplete?: string;
  name?: string;
  id?: string;
}
