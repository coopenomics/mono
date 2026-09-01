import { ObjectType, Field } from '@nestjs/graphql';
import { IsString, IsBoolean, IsArray, IsNumber } from 'class-validator';
import { SignedBlockchainDocumentDTO } from '../../document/dto/signed-blockchain-document.dto';
import type { RegistratorContract } from 'cooptypes';
import { VerificationDTO } from './verification.dto';

@ObjectType('CooperativeOperatorAccount')
export class CooperativeOperatorAccountDTO
  implements RegistratorContract.Tables.Cooperatives.ICooperative, RegistratorContract.Tables.Accounts.IAccount
{
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsString()
  public readonly username!: string;

  @Field(() => String, { description: 'Родительское имя аккаунта кооператива' })
  @IsString()
  public readonly parent_username!: string;

  @Field(() => String, { description: 'Объявление кооператива' })
  @IsString()
  public readonly announce!: string;

  @Field(() => String, { description: 'Описание кооператива' })
  @IsString()
  public readonly description!: string;

  @Field(() => Boolean, { description: 'Является ли это кооперативом' })
  @IsBoolean()
  public readonly is_cooperative!: boolean;

  @Field(() => Boolean, { description: 'Разветвленный ли кооператив' })
  @IsBoolean()
  public readonly is_branched!: boolean;

  @Field(() => Boolean, { description: 'Включен ли кооператив' })
  @IsBoolean()
  public readonly is_enrolled!: boolean;

  @Field(() => String, { description: 'Тип кооператива' })
  @IsString()
  public readonly coop_type!: string;

  @Field(() => String, { description: 'Регистрационный взнос' })
  @IsString()
  public readonly registration!: string;

  @Field(() => String, { description: 'Начальный взнос' })
  @IsString()
  public readonly initial!: string;

  @Field(() => String, { description: 'Минимальный взнос' })
  @IsString()
  public readonly minimum!: string;

  @Field(() => String, { description: 'Регистрационный взнос организации' })
  @IsString()
  public readonly org_registration!: string;

  @Field(() => String, { description: 'Начальный взнос организации' })
  @IsString()
  public readonly org_initial!: string;

  @Field(() => String, { description: 'Минимальный взнос организации' })
  @IsString()
  public readonly org_minimum!: string;

  @Field(() => String, { description: 'Статус кооператива' })
  @IsString()
  public readonly status!: string;

  @Field(() => String, { description: 'Дата создания' })
  @IsString()
  public readonly created_at!: string;

  @Field(() => SignedBlockchainDocumentDTO, { description: 'Документ кооператива' })
  public readonly document!: SignedBlockchainDocumentDTO;

  @Field(() => String, { description: 'Реферал кооператива' })
  @IsString()
  public readonly referer!: string;

  @Field(() => String, { description: 'Регистратор кооператива' })
  @IsString()
  public readonly registrator!: string;

  @Field(() => String, { description: 'Тип учетной записи' })
  @IsString()
  public readonly type!: string;

  @Field(() => String, { description: 'Метаинформация' })
  @IsString()
  public readonly meta!: string;

  @Field(() => [String], { description: 'Список хранилищ' })
  @IsArray()
  @IsString({ each: true })
  public readonly storages!: string[];

  @Field(() => String, { description: 'Дата регистрации' })
  @IsString()
  public readonly registered_at!: string;

  @Field(() => [VerificationDTO], { description: 'Верификации аккаунта (уровни подтверждения личности)' })
  @IsString()
  public readonly verifications!: VerificationDTO[];

  @Field(() => Number, { description: 'Количество активных участников' })
  @IsNumber()
  public readonly active_participants_count!: number;

  constructor(data: CooperativeOperatorAccountDTO | null) {
    Object.assign(this, data);
  }
}
