export type PageHintVariant = 'info' | 'pos' | 'warn' | 'neg';

export interface PageHintProps {
  /**
   * Ключ LocalStorage, по которому хранится факт скрытия подсказки.
   * Уникален для страницы: `mp:<page>:banner-dismissed`.
   */
  storageKey: string;
  /** Цветовой вариант баннера. По умолчанию `info`. */
  variant?: PageHintVariant;
  /** Material-иконка слева. По умолчанию подбирается по `variant`. */
  icon?: string;
}
