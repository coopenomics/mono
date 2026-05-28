export type BaseCardVariant = 'default' | 'flat' | 'inset' | 'quiet';

export interface BaseCardProps {
  variant?: BaseCardVariant;
  title?: string;
  subtitle?: string;
}
