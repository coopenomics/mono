export interface RailItem {
  /** Уникальный ключ — он же выбирается через `activeKey` */
  key: string;
  /** Подпись пункта */
  label: string;
  /** Иконка (Material Symbol name или собственный SVG-id через slot) */
  icon?: string;
  /** Маршрут — если задан, компонент рендерит router-link */
  route?: string | Record<string, unknown>;
  /** Метка справа (счётчик / число) */
  badge?: string | number;
  /** Произвольный мета-текст справа */
  meta?: string;
}

export interface RailSection {
  /** Заголовок секции (uppercase eyebrow) */
  section: string;
  items: RailItem[];
}

export interface AppDrawerProps {
  /** Название кооператива в шапке рейла */
  coopName?: string;
  /** Подпись под названием (например, «Стол пайщика») */
  coopMeta?: string;
  /** Пункты навигации — плоский список ИЛИ секции */
  items: Array<RailItem | RailSection>;
  /** Ключ активного пункта */
  activeKey?: string;
  /** Показывать кнопку поиска ⌘K под брендом */
  showCmdk?: boolean;
  /** Подпись на кнопке поиска (по умолчанию «Найти») */
  cmdkLabel?: string;
  /** Подсказка-tooltip для поиска */
  cmdkHint?: string;
}
