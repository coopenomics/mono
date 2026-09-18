export type BaseBadgeVariant = 'neutral' | 'accent' | 'pos' | 'neg' | 'warn' | 'info';

export interface BaseBadgeProps {
  /** Точка статуса слева от текста (паттерн `.status` в каноне) */
  variant?: BaseBadgeVariant;
  /** Только точка, без текста */
  dot?: boolean;
}
