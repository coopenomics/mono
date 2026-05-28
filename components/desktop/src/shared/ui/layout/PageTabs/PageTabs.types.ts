export interface PageTab {
  /** Уникальный ключ — выбирается через `activeKey` */
  key: string;
  /** Подпись таба */
  label: string;
  /** Счётчик справа (число записей в этом разделе) */
  count?: number | string;
  /** Маршрут — если задан, рендерится как router-link */
  route?: string | Record<string, unknown>;
  /** Отключённый таб */
  disabled?: boolean;
}

export interface PageTabsProps {
  /** Список вкладок */
  tabs: PageTab[];
  /** Ключ активной вкладки */
  activeKey?: string;
}
