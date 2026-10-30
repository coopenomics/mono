import type { IEntrepreneurData, IIndividualData, IOrganizationData } from '@coopenomics/docs-templates';
import type { AccountType } from '~/application/account/enum/account-type.enum';

export interface PrivateAccountDomainInterface {
  type: AccountType;
  individual_data?: IIndividualData;
  organization_data?: IOrganizationData;
  entrepreneur_data?: IEntrepreneurData;
}
