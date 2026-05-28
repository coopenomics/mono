export type BaseButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type BaseButtonSize = 'sm' | 'md' | 'lg';

export interface BaseButtonProps {
  variant?: BaseButtonVariant;
  size?: BaseButtonSize;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  loading?: boolean;
  block?: boolean;
  iconOnly?: boolean;
  ariaLabel?: string;
}
