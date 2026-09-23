import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import type { EditContributorDomainInput } from '../../../domain/actions/edit-contributor-domain-input.interface';
import { t } from '../../../i18n';

/**
 * GraphQL DTO для редактирования участника CAPITAL контракта
 */
@InputType('EditContributorInput')
export class EditContributorInputDTO implements EditContributorDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: t('capital.editContributorInput.coopname.required') })
  @IsString({ message: t('capital.editContributorInput.coopname.string') })
  coopname!: string;

  @Field(() => String, { description: 'Имя пользователя' })
  @IsNotEmpty({ message: t('capital.editContributorInput.username.required') })
  @IsString({ message: t('capital.editContributorInput.username.string') })
  username!: string;

  @Field(() => String, { description: 'О себе', nullable: true })
  @IsOptional()
  @IsString({ message: t('capital.editContributorInput.about.string') })
  about?: string;

  @Field(() => String, { description: 'Ставка за час работы', nullable: true })
  @IsOptional()
  @IsString({ message: t('capital.editContributorInput.ratePerHour.string') })
  rate_per_hour?: string;

  @Field(() => Number, { description: 'Часов в день', nullable: true })
  @IsOptional()
  @IsNumber({}, { message: t('capital.editContributorInput.hoursPerDay.number') })
  @Type(() => Number)
  hours_per_day?: number;
}
