import type { IBankAccount, IEntrepreneurData, IIndividualData, IOrganizationData } from '@coopenomics/docs-templates';
import type { RegisterRole } from '~/application/account/enum/account-role-on-register.enum';
import type { AccountType } from '~/application/account/enum/account-type.enum';

export interface AddParticipantDomainInterface {
  email: string;
  entrepreneur_data?: Omit<IEntrepreneurData, 'username'> & {
    bank_account: IBankAccount;
  };
  individual_data?: Omit<IIndividualData, 'username'>;
  organization_data?: Omit<IOrganizationData, 'username'> & {
    bank_account: IBankAccount;
  };
  public_key?: string;
  referer?: string;
  role: RegisterRole;
  type: AccountType;
  username: string;
  created_at: string;
  initial: string;
  minimum: string;
  spread_initial: boolean;
}
