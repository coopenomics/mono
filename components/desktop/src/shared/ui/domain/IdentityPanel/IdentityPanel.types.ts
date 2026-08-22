export type IdentityStatus = 'active' | 'blocked' | 'pending';

export interface Identity {
  avatar?: string;
  fullName: string;
  email?: string;
  accountName?: string;
  status?: IdentityStatus;
  role?: string;
}

export interface IdentityPanelProps {
  identity: Identity;
  compact?: boolean;
  /**
   * Без собственной подложки и рамки. Нужен, когда панель стоит внутри карточки:
   * своя рамка внутри чужой читается как «карточка в карточке» и вводит лишнюю
   * границу там, где содержимое и так одно целое.
   */
  flat?: boolean;
}
