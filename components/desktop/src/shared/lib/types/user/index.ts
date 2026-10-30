import type { IEntrepreneurData, IIndividualData, IOrganizationData } from '@coopenomics/docs-templates';

export interface IKeyPair {
  private_key: string;
  public_key: string;
}

export interface IGeneratedAccount extends IKeyPair {
  username: string;
}

export interface IToken {
  token: string;
  expires: unknown;
}

export interface ITokens {
  access: IToken;
  refresh: IToken;
}

export interface IWifPair {
  username: string;
  wif: string;
}

export interface IUser {
  username: string;
  email: string;
  private_data:
    | IEntrepreneurData
    | IIndividualData
    | IOrganizationData;
  public_key: string;
  referer?: string;
  role: 'user' | 'admin';
  type: 'individual' | 'entrepreneur' | 'organization';
}

export interface ICreatedUser {
  user: IUser;
  tokens: ITokens;
}
