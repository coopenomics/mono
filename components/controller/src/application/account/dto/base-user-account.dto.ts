import { ObjectType, Field } from '@nestjs/graphql';
import { IsString, IsArray } from 'class-validator';
import type { RegistratorContract } from 'cooptypes';
import { VerificationDTO } from '../../common/dto/verification.dto';

@ObjectType('UserAccount')
export class UserAccountDTO implements RegistratorContract.Tables.Accounts.IAccount {
  @Field(() => String, { description: 'Имя аккаунта' })
  @IsString()
  public readonly username!: string;

  @Field(() => String, { description: 'Реферал' })
  @IsString()
  public readonly referer!: string;

  @Field(() => String, { description: 'Регистратор' })
  @IsString()
  public readonly registrator!: string;

  @Field(() => String, { description: 'Тип учетной записи' })
  @IsString()
  public readonly type!: string;

  @Field(() => String, { description: 'Статус аккаунта' })
  @IsString()
  public readonly status!: string;

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

  constructor(data: UserAccountDTO | null) {
    Object.assign(this, data);
  }
}
