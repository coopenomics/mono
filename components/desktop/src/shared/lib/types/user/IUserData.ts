import type { Mutations } from '@coopenomics/sdk';
import type { IBankAccount, IEntrepreneurData as DocsIEntrepreneurData, IIndividualData as DocsIIndividualData, IOrganizationData as DocsIOrganizationData } from '@coopenomics/docs-templates';

export type IEntrepreneurData = DocsIEntrepreneurData;
export type IIndividualData = DocsIIndividualData;
export type IOrganizationData = DocsIOrganizationData;

type OmitUsernameAndEmail<T> = Omit<T, 'username' | 'email'>;

export type ICreateEntrepreneurData =
  OmitUsernameAndEmail<DocsIEntrepreneurData>;
export type ICreateIndividualData =
  OmitUsernameAndEmail<DocsIIndividualData>;
export type ICreateOrganizationData =
  OmitUsernameAndEmail<DocsIOrganizationData>;

export interface IUserData {
  type: 'individual' | 'entrepreneur' | 'organization' | null;
  entrepreneur_data?: ICreateEntrepreneurData & {
    bank_account: IBankAccount;
  };
  individual_data?: ICreateIndividualData;
  organization_data?: ICreateOrganizationData & {
    bank_account: IBankAccount;
  };
  email?: string;
  username?: string;
}

export type IRegisterAccount =
  Mutations.Accounts.RegisterAccount.IInput['data'];
export type IRegisteredAccountResult =
  Mutations.Accounts.RegisterAccount.IOutput[typeof Mutations.Accounts.RegisterAccount.name];
