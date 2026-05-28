export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type AvatarTone = 'neutral' | 'primary' | 'accent';

export interface AvatarProps {
  /** Полное имя, по нему сгенерируются инициалы */
  name?: string;
  /** URL картинки — заменяет инициалы */
  src?: string;
  size?: AvatarSize;
  tone?: AvatarTone;
}
