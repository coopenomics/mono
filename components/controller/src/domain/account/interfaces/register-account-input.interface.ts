import type { IBankAccount, IEntrepreneurData, IIndividualData } from '@coopenomics/docs-templates';
import type { CreateOrganizationDataInputDomainInterface } from './create-organization-data-input-domain.interface';

export interface RegisterAccountDomainInterface {
  email: string;
  entrepreneur_data?: Omit<IEntrepreneurData, 'username'> & {
    bank_account: IBankAccount;
  };
  individual_data?: Omit<IIndividualData, 'username'>;
  organization_data?: CreateOrganizationDataInputDomainInterface;
  public_key: string;
  referer?: string;
  type: 'individual' | 'entrepreneur' | 'organization';
  username: string;
}
