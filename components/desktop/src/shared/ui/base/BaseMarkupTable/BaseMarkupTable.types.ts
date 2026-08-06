export type BaseMarkupTableSeparator = 'horizontal' | 'vertical' | 'cell' | 'none';

export interface BaseMarkupTableProps {
  /**
   * Разделители между ячейками. `cell` — сетка по обеим осям, нужна там, где
   * таблица изображает пространство (координаты склада), а не список.
   */
  separator?: BaseMarkupTableSeparator;
  /** Уплотнённые отступы в ячейках. */
  dense?: boolean;
  /** Рамка вокруг таблицы. */
  bordered?: boolean;
  /** Без тени (по канону плоские поверхности — значение по умолчанию). */
  flat?: boolean;
  /** Минимальная ширина таблицы; ниже неё включается горизонтальная прокрутка. */
  minWidth?: string;
  /** Максимальная высота области прокрутки, например `'60vh'`. */
  maxHeight?: string;
  /** Заголовок и первая колонка прилипают при прокрутке. */
  stickyHeader?: boolean;
  /** Первая колонка прилипает при горизонтальной прокрутке (заголовки строк). */
  stickyFirstColumn?: boolean;
}
