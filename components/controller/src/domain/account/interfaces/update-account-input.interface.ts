import type { IEntrepreneurData, IIndividualData, IOrganizationData } from '@coopenomics/docs-templates';

export interface UpdateAccountDomainInterface {
  entrepreneur_data?: Omit<IEntrepreneurData, 'username'>;
  individual_data?: Omit<IIndividualData, 'username'>;
  organization_data?: Omit<IOrganizationData, 'username'>;
  public_key?: string;
  referer?: string;
  username: string;
}
