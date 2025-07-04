import type { Cooperative } from 'cooptypes';
import type mongoose from 'mongoose';

export enum userStatus {
  '1_Created' = 'created',
  '2_Joined' = 'joined',
  '3_Payed' = 'payed',
  '4_Registered' = 'registered',
  '5_Active' = 'active',
  '10_Failed' = 'failed',
  '100_Refunded' = 'refunded',
  '200_Blocked' = 'blocked',
}

export interface IUser {
  username: string;
  status: userStatus;
  message: string;
  is_registered: boolean;
  has_account: boolean;
  type: 'individual' | 'entrepreneur' | 'organization';
  public_key: string;
  referer: string;
  email: string;
  role: string;
  is_email_verified: boolean;
  initial_order?: mongoose.Types.ObjectId;
  subscriber_id: string;
  subscriber_hash: string;
  // Временное поле для хранения private_data
  _privateData?:
    | Cooperative.Users.IIndividualData
    | Cooperative.Users.IEntrepreneurData
    | Cooperative.Users.IOrganizationData
    | null;
  private_data:
    | Cooperative.Users.IIndividualData
    | Cooperative.Users.IEntrepreneurData
    | Cooperative.Users.IOrganizationData
    | null;
  getPrivateData(): Promise<
    Cooperative.Users.IIndividualData | Cooperative.Users.IEntrepreneurData | Cooperative.Users.IOrganizationData | null
  >;
}
