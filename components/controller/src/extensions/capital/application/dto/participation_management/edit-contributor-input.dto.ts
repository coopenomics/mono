import { Field, InputType } from '@nestjs/graphql';
import { validationMessage } from '@coopenomics/extension-kit';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import type { EditContributorDomainInput } from '../../../domain/actions/edit-contributor-domain-input.interface';

/**
 * GraphQL DTO для редактирования участника CAPITAL контракта
 */
@InputType('EditContributorInput')
export class EditContributorInputDTO implements EditContributorDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: validationMessage('capital.editContributorInput.coopname.required') })
  @IsString({ message: validationMessage('capital.editContributorInput.coopname.string') })
  coopname!: string;

  @Field(() => String, { description: 'Имя пользователя' })
  @IsNotEmpty({ message: validationMessage('capital.editContributorInput.username.required') })
  @IsString({ message: validationMessage('capital.editContributorInput.username.string') })
  username!: string;

  @Field(() => String, { description: 'О себе', nullable: true })
  @IsOptional()
  @IsString({ message: validationMessage('capital.editContributorInput.about.string') })
  about?: string;

  @Field(() => String, { description: 'Ставка за час работы', nullable: true })
  @IsOptional()
  @IsString({ message: validationMessage('capital.editContributorInput.ratePerHour.string') })
  rate_per_hour?: string;

  @Field(() => Number, { description: 'Часов в день', nullable: true })
  @IsOptional()
  @IsNumber({}, { message: validationMessage('capital.editContributorInput.hoursPerDay.number') })
  @Type(() => Number)
  hours_per_day?: number;
}
