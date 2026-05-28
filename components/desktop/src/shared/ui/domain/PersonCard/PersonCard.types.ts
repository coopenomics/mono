import type { ContactItem } from 'src/shared/ui/domain/ContactSheet';

export type PersonDensity = 'compact' | 'comfortable';

export interface Person {
  avatar?: string;
  fullName: string;
  role?: string;
  accountName?: string;
  contacts?: ContactItem[];
}

export interface PersonCardProps {
  person: Person;
  density?: PersonDensity;
}
