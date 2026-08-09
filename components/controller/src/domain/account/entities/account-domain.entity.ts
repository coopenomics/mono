import { RegistratorContract, type SovietContract } from 'cooptypes';
import type { BlockchainAccountInterface } from '~/types/shared';
import type { IMonoAccount } from '@coopenomics/innercoop';
import type { PrivateAccountDomainInterface } from '../interfaces/private-account-domain.interface';
import { AccountKind } from '~/application/account/enum/account-kind.enum';
import type { RegistrationPaymentDomainInterface } from '../interfaces/registration-payment-domain.interface';

export class AccountDomainEntity {
  public readonly username!: string;
  public blockchain_account!: BlockchainAccountInterface | null;
  public user_account!: RegistratorContract.Tables.Accounts.IAccount | null;
  public provider_account!: IMonoAccount | null;
  public participant_account!: SovietContract.Tables.Participants.IParticipants | null;
  public private_account!: PrivateAccountDomainInterface | null;
  // Вид субъекта аккаунта (пайщик / кооперативный участок / кооператив / прочее).
  public account_kind!: AccountKind;
  public registration_payment?: RegistrationPaymentDomainInterface | null;

  constructor(data: AccountDomainEntity) {
    Object.assign(this, data);
  }
}
