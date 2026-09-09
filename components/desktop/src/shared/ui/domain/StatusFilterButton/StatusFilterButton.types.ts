/**
 * Пункт меню фильтра: одна понятная строка, за которой стоит один или
 * несколько статусов. Несколько нужны там, где разные технические состояния
 * для человека означают одно и то же ожидание.
 */
export interface StatusFilterOption {
  key: string;
  label: string;
  statuses: string[];
}

export interface StatusFilterButtonProps {
  /** Пункты меню в порядке жизненного цикла сущности. */
  options: StatusFilterOption[];
  /** Выбранные статусы — плоским списком, в том виде, в каком их ждёт запрос. */
  selected: string[];
  /**
   * Кнопка живёт в шапке через `useHeaderActions`, а оттуда `emit` не
   * доходит — страница передаёт обработчик колбэком.
   */
  onChange?: (statuses: string[]) => void;
  /** Подпись кнопки; по умолчанию «Фильтр». */
  label?: string;
}
