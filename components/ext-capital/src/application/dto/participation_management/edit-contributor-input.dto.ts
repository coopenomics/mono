import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import type { EditContributorDomainInput } from '../../../domain/actions/edit-contributor-domain-input.interface';

/**
 * GraphQL DTO для редактирования участника CAPITAL контракта
 */
@InputType('EditContributorInput')
export class EditContributorInputDTO implements EditContributorDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: 'Имя аккаунта кооператива не должно быть пустым' })
  @IsString({ message: 'Имя аккаунта кооператива должно быть строкой' })
  coopname!: string;

  @Field(() => String, { description: 'Имя пользователя' })
  @IsNotEmpty({ message: 'Имя пользователя не должно быть пустым' })
  @IsString({ message: 'Имя пользователя должно быть строкой' })
  username!: string;

  @Field(() => String, { description: 'О себе', nullable: true })
  @IsOptional()
  @IsString({ message: 'О себе должно быть строкой' })
  about?: string;

  @Field(() => String, { description: 'Ставка за час работы', nullable: true })
  @IsOptional()
  @IsString({ message: 'Ставка за час работы должна быть строкой' })
  rate_per_hour?: string;

  @Field(() => Number, { description: 'Часов в день', nullable: true })
  @IsOptional()
  @IsNumber({}, { message: 'Часов в день должно быть числом' })
  @Type(() => Number)
  hours_per_day?: number;
}
