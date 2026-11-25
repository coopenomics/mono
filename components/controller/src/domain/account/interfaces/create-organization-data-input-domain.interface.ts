import type { IBankAccount, IOrganizationData } from '@coopenomics/docs-templates';

export type CreateOrganizationDataInputDomainInterface = Omit<IOrganizationData, 'username'> & {
  bank_account: IBankAccount;
};
