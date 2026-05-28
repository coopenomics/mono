export type BaseChipVariant =
  | 'neutral'
  | 'accent'
  | 'pos'
  | 'neg'
  | 'warn'
  | 'info';

export interface BaseChipProps {
  variant?: BaseChipVariant;
  size?: 'sm' | 'lg';
}
