export interface BaseTableColumn<T = Record<string, unknown>> {
  /** Ключ поля в строке данных или произвольный id */
  key: string;
  /** Заголовок колонки */
  label: string;
  /** Выравнивание содержимого */
  align?: 'left' | 'right' | 'center';
  /** Поле строки, по которому достать значение (по умолчанию = key) */
  field?: keyof T | ((row: T) => unknown);
  /** Числовая колонка (правое выравнивание + tabular-nums) */
  numeric?: boolean;
}

export interface BaseTableProps<T = Record<string, unknown>> {
  columns: BaseTableColumn<T>[];
  rows: T[];
  /** Уникальный ключ строки */
  rowKey?: keyof T;
  /** Hover-эффект на строках */
  hover?: boolean;
}
