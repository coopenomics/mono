export type NotificationCategory = 'system' | 'financial' | 'voting' | 'message';

export interface NotificationItem {
  id: string;
  category: NotificationCategory;
  title: string;
  description?: string;
  /** ISO-строка или Date. Форматирование relative — внутри компонента. */
  date: string | Date;
  read: boolean;
  /** Опциональная целевая ссылка (используется connected-обёрткой) */
  link?: string;
}

export interface NotificationCenterProps {
  notifications: NotificationItem[];
  loading?: boolean;
  /** href для «Показать все» (default '/notifications') */
  viewAllHref?: string;
  /** Подпись для «Показать все» */
  viewAllLabel?: string;
}
