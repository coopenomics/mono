export type AccountBadgeSize = 'sm' | 'md';

export interface AccountBadgeProps {
  accountName: string;
  size?: AccountBadgeSize;
  copyable?: boolean;
  linkable?: boolean;
  explorerUrl?: string;
  /** Без серой плашки-фона: только текст аккаунта (+ копирование). Для вторичного
   *  показа под ФИО, где фон-чип лишний. */
  plain?: boolean;
}
