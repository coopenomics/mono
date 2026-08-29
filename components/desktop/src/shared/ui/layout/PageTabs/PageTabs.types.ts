import type { RouteLocationRaw } from 'vue-router';

export interface PageTab {
  /** Уникальный ключ — выбирается через `activeKey` */
  key: string;
  /** Подпись таба */
  label: string;
  /** Иконка слева от подписи (Material Icons) */
  icon?: string;
  /** Счётчик справа (число записей в этом разделе) */
  count?: number | string;
  /** Маршрут — если задан, рендерится как router-link */
  route?: RouteLocationRaw;
  /**
   * Имя маршрута вместо готовой ссылки. Таб сам переходит на него, сохраняя
   * параметры текущего маршрута, и сам считает себя активным по `route.matched`
   * — в том числе когда открыт дочерний маршрут. Так устроены разделы-оболочки
   * с `<router-view>` внутри (отчётность, магазин расширений).
   */
  routeName?: string;
  /** Отключённый таб */
  disabled?: boolean;
}

export interface PageTabsProps {
  /** Список вкладок */
  tabs: PageTab[];
  /**
   * Ключ активной вкладки. Не задаётся для табов с `routeName` — там
   * активность определяется по текущему маршруту.
   */
  activeKey?: string;
}
