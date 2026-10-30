import type { IEntrepreneurData, IIndividualData, IOrganizationData } from '@coopenomics/docs-templates';

export enum userStatus {
  '1_Created' = 'created',
  '2_Joined' = 'joined',
  '3_Payed' = 'payed',
  '4_Registered' = 'registered',
  '5_Active' = 'active',
  '10_Failed' = 'failed',
  '90_Refunding' = 'refunding',
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
  initial_order?: string;
  subscriber_id: string;
  subscriber_hash: string;
  // Временное поле для хранения private_data
  _privateData?:
    | IIndividualData
    | IEntrepreneurData
    | IOrganizationData
    | null;
  private_data:
    | IIndividualData
    | IEntrepreneurData
    | IOrganizationData
    | null;
  getPrivateData(): Promise<
    IIndividualData | IEntrepreneurData | IOrganizationData | null
  >;
}
