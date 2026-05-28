/**
 * Описание одной колонки скелетон-таблицы.
 * Скелетон повторяет canon-структуру .table-wrap/.table, поэтому при
 * появлении реальных данных каркас остаётся на месте — без рывков (calm-data).
 */
export interface TableSkeletonColumn {
  /** Текст заголовка (показываем сразу — заголовки не «мигают») */
  label?: string;
  /** Фиксированная ширина колонки (CSS-значение), например '150px' */
  width?: string;
  /** Доп. класс ячейки (col-num, col-action, col-toggle и т.п.) */
  class?: string;
  /**
   * Что рисуем в ячейке-плейсхолдере:
   *  - 'text'   — бар (по умолчанию)
   *  - 'badge'  — pill-плейсхолдер под бейдж
   *  - 'icon'   — маленький квадрат под иконку (toggle/действие)
   *  - 'none'   — пусто
   */
  cell?: 'text' | 'badge' | 'icon' | 'none';
  /** Ширина бара в ячейке (CSS-значение); по умолчанию варьируется */
  cellWidth?: string;
}

export interface TableSkeletonProps {
  /** Колонки — повторяют шапку реальной таблицы */
  columns: TableSkeletonColumn[];
  /** Сколько строк-плейсхолдеров показать */
  rows?: number;
  /** min-width таблицы (для горизонтального скролла), как у реальной */
  minWidth?: string;
}
