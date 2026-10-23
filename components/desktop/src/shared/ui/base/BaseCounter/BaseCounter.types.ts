export type BaseCounterVariant = 'accent' | 'neg' | 'neutral';

export interface BaseCounterProps {
  /** Сколько дел ждёт внимания; строка показывается как есть */
  value: number | string;
  /** accent — действия пользователя (по умолчанию), neg — срочное, neutral — справочное число */
  variant?: BaseCounterVariant;
  /** Число больше предела показывается как «99+» */
  max?: number;
}
