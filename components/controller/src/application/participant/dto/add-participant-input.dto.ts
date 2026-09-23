import { Field, InputType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, ValidateIf, ValidateNested } from 'class-validator';
import { CreateEntrepreneurDataInputDTO } from '~/application/account/dto/create-entrepreneur-data-input.dto';
import { CreateIndividualDataInputDTO } from '~/application/account/dto/create-individual-data-input.dto';
import { CreateOrganizationDataInputDTO } from '~/application/account/dto/create-organization-data-input.dto';
import { AccountType } from '~/application/account/enum/account-type.enum';
import { t } from '~/i18n';

@InputType('AddParticipantInput')
export class AddParticipantInputDTO {
  @Field({ description: 'Дата создания аккаунта в строковом формате даты EOSIO по UTC (2024-12-28T06:58:52.500)' })
  @IsNotEmpty({ message: t('participation.addParticipantInput.fieldCreatedAtRequired') })
  created_at!: string;

  @Field({ description: 'Электронная почта' })
  @IsNotEmpty({ message: t('participation.addParticipantInput.fieldEmailRequired') })
  email!: string;

  @Field({ nullable: true, description: 'Имя аккаунта реферера' })
  @IsOptional()
  referer?: string;

  @Field(() => AccountType, { description: 'Тип аккаунта' })
  @IsNotEmpty({ message: t('participation.addParticipantInput.fieldTypeRequired') })
  type!: AccountType;

  @Field({ description: 'Вступительный взнос, который был внесён пайщиком' })
  @IsNotEmpty({ message: t('participation.addParticipantInput.fieldInitialRequired') })
  initial!: string;

  @Field({ description: 'Минимальный паевый взнос, который был внесён пайщиком' })
  @IsNotEmpty({ message: t('participation.addParticipantInput.fieldMinimumRequired') })
  minimum!: string;

  @Field({ description: 'Флаг распределения вступительного взноса в невозвратный фонд вступительных взносов кооператива' })
  @IsNotEmpty({ message: t('participation.addParticipantInput.fieldSpreadInitialRequired') })
  spread_initial!: boolean;

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

  @ValidateIf((o: AddParticipantInputDTO) => !o.entrepreneur_data && !o.individual_data && !o.organization_data)
  @IsNotEmpty({
    message: t('participation.addParticipantInput.atLeastOneDataRequired'),
  })
  validateOneTypePresent!: boolean;
}
