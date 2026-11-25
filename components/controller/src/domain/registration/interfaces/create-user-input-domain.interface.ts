import type { IBankAccount, IEntrepreneurData, IIndividualData } from '@coopenomics/docs-templates';

export interface CreateUserInputDomainInterface {
  email: string;
  entrepreneur_data?: Omit<IEntrepreneurData, 'username'> & {
    bank_account: IBankAccount;
  };
  individual_data?: Omit<IIndividualData, 'username'>;
  organization_data?: {
    bank_account: IBankAccount;
    city: string;
    country: string;
    details: {
      inn: string;
      kpp: string;
      ogrn: string;
    };
    email: string;
    fact_address: string;
    full_address: string;
    full_name: string;
    phone: string;
    represented_by: {
      based_on: string;
      first_name: string;
      last_name: string;
      middle_name: string;
      position: string;
    };
    short_name: string;
    type: string;
  };
  public_key?: string;
  referer?: string;
  role: 'user';
  type: 'individual' | 'entrepreneur' | 'organization';
  username: string;
}
