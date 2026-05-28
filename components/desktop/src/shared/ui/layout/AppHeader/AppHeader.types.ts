export interface AppHeaderCrumb {
  /** Текст */
  label: string;
  /** Маршрут — если задан, отрисуется как router-link */
  route?: string | Record<string, unknown>;
}

export interface AppHeaderProps {
  /** Простой заголовок раздела — отрисуется как `<b>{title}</b>` в крошке */
  title?: string;
  /** Альтернативно — массив крошек с chevron'ами между ними */
  breadcrumbs?: AppHeaderCrumb[];
  /** Показывать кнопку-бургер слева (по умолчанию — да) */
  showMenuButton?: boolean;
}
