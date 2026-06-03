export type AccountBadgeSize = 'sm' | 'md';

export interface AccountBadgeProps {
  accountName: string;
  size?: AccountBadgeSize;
  copyable?: boolean;
  linkable?: boolean;
  explorerUrl?: string;
}
