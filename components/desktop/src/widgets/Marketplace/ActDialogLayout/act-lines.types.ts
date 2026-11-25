/** Колонка таблицы позиций акта. */
export interface ActLinesColumn {
  key: string;
  /** Подпись в полосе над строками; пусто — колонка без подписи (галка). */
  label: string;
  /** Ширина CSS-сетки: `88px`, `var(--p-6)`; не задана — 112px, у широкой — резиновая. */
  width?: string;
  /** Числа и суммы — по правому краю. */
  align?: 'left' | 'right';
  /** Колонка позиции: тянется, на узком экране занимает строку целиком. */
  wide?: boolean;
  /** Сумма строки — плотнее остальных ячеек. */
  strong?: boolean;
}

/** Строка таблицы: позиция либо подзаголовок раздела (`section: true`). */
export interface ActLinesRow {
  key: string;
  section?: boolean;
  /** Строка не участвует (снята галка) — приглушена. */
  off?: boolean;
  [field: string]: unknown;
}
