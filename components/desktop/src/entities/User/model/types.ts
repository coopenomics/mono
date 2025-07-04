import { RegistratorContract } from 'cooptypes';
import { AccountResult } from 'eosjs/dist/eosjs-rpc-interfaces';
import {
  IEntrepreneurData,
  IIndividualData,
  IOrganizationData,
} from 'src/shared/lib/types/user/IUserData';

export interface ILoadPrivateProfile {
  coopname: string;
  username: string;
}

export interface ILoadPublicProfile {
  coopname: string;
  username: string;
}

export interface IPrivateProfile {
  username: string;
}

export interface IUserAccountData {
  username: string;
  status:
    | 'created'
    | 'joined'
    | 'payed'
    | 'registered'
    | 'active'
    | 'blocked'
    | 'failed';
  is_registered: boolean;
  type: 'individual' | 'entrepreneur' | 'organization';
  public_key: string;
  referer: string;
  email: string;
  role: string;
  is_email_verified: boolean;
  subscriber_id?: string;
  subscriber_hash?: string;
  private_data: IIndividualData | IEntrepreneurData | IOrganizationData | null;
}

export interface ICopenomicsAccount
  extends Partial<RegistratorContract.Tables.Accounts.IAccount>,
    Partial<RegistratorContract.Tables.Cooperatives.ICooperative> {}

export type IBlockchainAccountResult = AccountResult;
