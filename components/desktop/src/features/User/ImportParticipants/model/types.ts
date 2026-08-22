import type { Mutations, Zeus } from '@coopenomics/sdk';

export type ParticipantType = 'individual' | 'entrepreneur' | 'organization';

export interface ContributionDefaults {
  initial: string;
  minimum: string;
}

export type ImportStatus = 'pending' | 'success' | 'error';

export type PassportFields = Zeus.ModelTypes['PassportInput'];

interface BaseRow {
  rowNumber: number;
  type: ParticipantType;
  displayType?: string;
  displayTypeFull?: string;
  email: string;
  phone?: string;
  created_at?: string;
  initial?: string;
  minimum?: string;
  spread_initial?: boolean;
  referer?: string;
  displayName: string;
  status?: ImportStatus;
  error?: string;
  input?: Mutations.Participants.AddParticipant.IInput['data'];
}

export interface IndividualCsvRow extends BaseRow {
  type: 'individual';
  first_name: string;
  last_name: string;
  middle_name?: string;
  birthdate: string;
  full_address: string;
  passport?: PassportFields;
}

export interface EntrepreneurCsvRow extends BaseRow {
  type: 'entrepreneur';
  first_name: string;
  last_name: string;
  middle_name?: string;
  birthdate: string;
  country: Zeus.Country | string;
  city: string;
  full_address: string;
  details: { inn: string; ogrn: string };
  bank_account: {
    bank_name: string;
    account_number: string;
    currency: string;
    details: { bik: string; corr: string };
  };
}

export interface OrganizationCsvRow extends BaseRow {
  type: 'organization';
  short_name: string;
  full_name: string;
  org_type: Zeus.OrganizationType | string;
  country: Zeus.Country | string;
  city: string;
  full_address: string;
  fact_address: string;
  phone: string;
  represented_by: {
    first_name: string;
    last_name: string;
    middle_name: string;
    position: string;
    based_on: string;
  };
  details: { inn: string; ogrn: string; kpp: string };
  bank_account: {
    bank_name: string;
    account_number: string;
    currency: string;
    details: { bik: string; corr: string };
  };
}

export type ParticipantCsvRow =
  | IndividualCsvRow
  | EntrepreneurCsvRow
  | OrganizationCsvRow;
