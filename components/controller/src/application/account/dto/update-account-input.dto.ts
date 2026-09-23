import { InputType, Field } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, ValidateIf, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { UpdateEntrepreneurDataInputDTO } from './update-entrepreneur-data-input.dto';
import { UpdateIndividualDataInputDTO } from './update-individual-data-input.dto';
import { UpdateOrganizationDataInputDTO } from './update-organization-data-input.dto';
import { t } from '~/i18n';

@InputType('UpdateAccountInput')
export class UpdateAccountInputDTO {
  @Field({ description: 'Имя пользователя' })
  @IsNotEmpty({ message: t('account.updateAccountInput.fieldUsernameRequired') })
  username!: string;

  @Field({ nullable: true, description: 'Имя аккаунта реферера' })
  @IsOptional()
  referer?: string;

  @Field({ nullable: true, description: 'Публичный ключ' })
  @IsOptional()
  public_key?: string;

  @Field(() => UpdateEntrepreneurDataInputDTO, { nullable: true, description: 'Данные индивидуального предпринимателя' })
  @ValidateNested()
  @Type(() => UpdateEntrepreneurDataInputDTO)
  @IsOptional()
  entrepreneur_data?: UpdateEntrepreneurDataInputDTO;

  @Field(() => UpdateIndividualDataInputDTO, { nullable: true, description: 'Данные физического лица' })
  @ValidateNested()
  @Type(() => UpdateIndividualDataInputDTO)
  @IsOptional()
  individual_data?: UpdateIndividualDataInputDTO;

  @Field(() => UpdateOrganizationDataInputDTO, { nullable: true, description: 'Данные организации' })
  @ValidateNested()
  @Type(() => UpdateOrganizationDataInputDTO)
  @IsOptional()
  organization_data?: UpdateOrganizationDataInputDTO;

  @ValidateIf((o: UpdateAccountInputDTO) => !o.entrepreneur_data && !o.individual_data && !o.organization_data)
  @IsNotEmpty({
    message: t('account.updateAccountInput.atLeastOneDataRequired'),
  })
  validateOneTypePresent!: boolean;
}
