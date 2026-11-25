import type { Mutations } from '@coopenomics/sdk';
import type { IBankAccount, IEntrepreneurData, IIndividualData, IOrganizationData } from '@coopenomics/docs-templates';

export type { IEntrepreneurData, IIndividualData, IOrganizationData };

type OmitUsernameAndEmail<T> = Omit<T, 'username' | 'email'>;

export type ICreateEntrepreneurData =
  OmitUsernameAndEmail<IEntrepreneurData>;
export type ICreateIndividualData =
  OmitUsernameAndEmail<IIndividualData>;
export type ICreateOrganizationData =
  OmitUsernameAndEmail<IOrganizationData>;

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
