import { InputType, Field } from '@nestjs/graphql';
import { AccountType } from '../enum/account-type.enum';
import { CreateEntrepreneurDataInputDTO } from './create-entrepreneur-data-input.dto';
import { CreateIndividualDataInputDTO } from './create-individual-data-input.dto';
import { CreateOrganizationDataInputDTO } from './create-organization-data-input.dto';
import { IsNotEmpty, IsOptional, IsString, ValidateIf, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { RegisterAccountDomainInterface } from '~/domain/account/interfaces/register-account-input.interface';
import { t } from '~/i18n';

@InputType('RegisterAccountInput')
export class RegisterAccountInputDTO implements RegisterAccountDomainInterface {
  @Field({ description: 'Электронная почта' })
  @IsNotEmpty({ message: t('account.registerAccountInput.fieldEmailRequired') })
  email!: string;

  @Field({ nullable: true, description: 'Имя аккаунта реферера' })
  @IsOptional()
  referer?: string;

  @Field(() => AccountType, { description: 'Тип аккаунта' })
  @IsNotEmpty({ message: t('account.registerAccountInput.fieldTypeRequired') })
  type!: AccountType;

  @Field({ description: 'Имя пользователя' })
  @IsNotEmpty({ message: t('account.registerAccountInput.fieldUsernameRequired') })
  username!: string;

  @Field({ description: 'Публичный ключ' })
  @IsString()
  public_key!: string;

  @Field(() => CreateEntrepreneurDataInputDTO, { nullable: true, description: 'Данные индивидуального предпринимателя' })
  @ValidateNested()
  @Type(() => CreateEntrepreneurDataInputDTO)
  @IsOptional()
  entrepreneur_data?: CreateEntrepreneurDataInputDTO;

  @Field(() => CreateIndividualDataInputDTO, { nullable: true, description: 'Данные физического лица' })
  @ValidateNested()
  @Type(() => CreateIndividualDataInputDTO)
  @IsOptional()
  individual_data?: CreateIndividualDataInputDTO;

  @Field(() => CreateOrganizationDataInputDTO, { nullable: true, description: 'Данные организации' })
  @ValidateNested()
  @Type(() => CreateOrganizationDataInputDTO)
  @IsOptional()
  organization_data?: CreateOrganizationDataInputDTO;

  @ValidateIf((o: RegisterAccountInputDTO) => !o.entrepreneur_data && !o.individual_data && !o.organization_data)
  @IsNotEmpty({
    message: t('account.registerAccountInput.atLeastOneDataRequired'),
  })
  validateOneTypePresent!: boolean;
}
