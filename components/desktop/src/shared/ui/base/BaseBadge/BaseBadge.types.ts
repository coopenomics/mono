export type BaseBadgeVariant = 'neutral' | 'accent' | 'pos' | 'neg' | 'warn' | 'info';

export interface BaseBadgeProps {
  /** Точка статуса слева от текста (паттерн `.status` в каноне) */
  variant?: BaseBadgeVariant;
  /** Только точка, без текста */
  dot?: boolean;
  /**
   * Бейдж стоит поверх изображения (обложка курса, фотография товара).
   * Мягкая заливка варианта на снимке растворяется, поэтому берётся плотная
   * тёмная подложка и белый текст — метка читается на любой картинке.
   */
  onMedia?: boolean;
}
