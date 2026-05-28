export type ContactType = 'email' | 'phone' | 'address' | 'tg' | 'web';

export interface ContactItem {
  type: ContactType;
  value: string;
  label?: string;
  verified?: boolean;
}

export interface ContactSheetProps {
  contacts: ContactItem[];
  density?: 'compact' | 'comfortable';
}
