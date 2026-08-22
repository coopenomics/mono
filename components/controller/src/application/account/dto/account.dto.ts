import { ObjectType, Field } from '@nestjs/graphql';
import { IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { BlockchainAccountDTO } from '~/application/account/dto/blockchain-account.dto';
import type { AccountDomainEntity } from '~/domain/account/entities/account-domain.entity';
import { MonoAccountDTO } from './mono-account.dto';
import { UserAccountDTO } from '~/application/account/dto/base-user-account.dto';
import { ParticipantAccountDTO } from './participant-account.dto';
import { PrivateAccountDTO } from './private-account.dto';
import { AccountKind } from '~/application/account/enum/account-kind.enum';
import { RegistrationPaymentDTO } from './registration-payment.dto';

@ObjectType('Account')
export class AccountDTO {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsString()
  public readonly username: string;

  @Field(() => BlockchainAccountDTO, {
    description:
      'объект аккаунта в блокчейне содержит системную информацию, такую как публичные ключи доступа, доступные вычислительные ресурсы, информация об установленном смарт-контракте, и т.д. и т.п. Это системный уровень обслуживания, где у каждого пайщика есть аккаунт, но не каждый аккаунт может быть пайщиком в каком-либо кооперативе. Все смарт-контракты устанавливаются и исполняются на этом уровне.',
    nullable: true,
  })
  @ValidateNested()
  @Type(() => BlockchainAccountDTO)
  public readonly blockchain_account!: BlockchainAccountDTO | null;

  @Field(() => UserAccountDTO, {
    description:
      'объект пользователя кооперативной экономики содержит в блокчейне информацию о типе аккаунта пайщика, а также, обезличенные публичные данные (хэши) для верификации пайщиков между кооперативами. Этот уровень предназначен для хранения информации пайщика, которая необходима всем кооперативам, но не относится к какому-либо из них конкретно.',
    nullable: true,
  })
  @ValidateNested()
  @Type(() => UserAccountDTO)
  public readonly user_account!: UserAccountDTO | null;

  @Field(() => MonoAccountDTO, {
    description:
      'объект аккаунта в системе учёта провайдера, т.е. MONO. Здесь хранится приватная информация о пайщике кооператива, которая содержит его приватные данные. Эти данные не публикуются в блокчейне и не выходят за пределы базы данных провайдера. Они используются для заполнения шаблонов документов при нажатии соответствующих кнопок на платформе. ',
    nullable: true,
  })
  @ValidateNested()
  @Type(() => MonoAccountDTO)
  public readonly provider_account!: MonoAccountDTO | null;

  @Field(() => ParticipantAccountDTO, {
    description:
      'объект пайщика кооператива в таблице блокчейне, который определяет членство пайщика в конкретном кооперативе. Поскольку MONO обслуживает только один кооператив, то в participant_account обычно содержится информация, которая описывает членство пайщика в этом кооперативе. Этот объект обезличен, публичен, и хранится в блокчейне.',
    nullable: true,
  })
  @ValidateNested()
  @Type(() => ParticipantAccountDTO)
  public readonly participant_account!: ParticipantAccountDTO | null;

  @Field(() => PrivateAccountDTO, {
    description: 'объект приватных данных пайщика кооператива.',
    nullable: true,
  })
  @ValidateNested()
  @Type(() => PrivateAccountDTO)
  public readonly private_account!: PrivateAccountDTO | null;

  @Field(() => AccountKind, {
    description:
      'Вид аккаунта: пайщик, кооперативный участок, кооператив или нераспознанный. Позволяет единообразно отображать субъект во всех реестрах — например, пометить кооперативный участок, а не принять его за организацию-пайщика.',
  })
  public readonly account_kind: AccountKind;

  @Field(() => RegistrationPaymentDTO, {
    description:
      'сводка по вступительному (регистрационному) платежу пайщика. Позволяет восстановить шаг регистрации (ожидание решения совета или отклонение платежа) после перезагрузки страницы и в любой вкладке.',
    nullable: true,
  })
  @ValidateNested()
  @Type(() => RegistrationPaymentDTO)
  public readonly registration_payment!: RegistrationPaymentDTO | null;

  constructor(entity: AccountDomainEntity) {
    this.username = entity.username;
    this.blockchain_account = entity.blockchain_account || null;
    this.provider_account = entity.provider_account ? new MonoAccountDTO(entity.provider_account) : null;
    this.user_account = entity.user_account ? new UserAccountDTO(entity.user_account) : null;
    this.participant_account = entity.participant_account ? new ParticipantAccountDTO(entity.participant_account) : null;
    this.private_account = entity.private_account ? new PrivateAccountDTO(entity.private_account) : null;
    this.account_kind = entity.account_kind ?? AccountKind.unknown;
    this.registration_payment = entity.registration_payment
      ? new RegistrationPaymentDTO(entity.registration_payment)
      : null;
  }
}
