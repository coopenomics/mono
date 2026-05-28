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
}
