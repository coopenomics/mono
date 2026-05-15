import { Field, InputType } from '@nestjs/graphql';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { WorkingHoursInputDTO } from './working-hours-input.dto';

// Вход GraphQL-мутации marketplaceDetailKU:
// детализирует существующий в core кооперативный участок как ПВЗ Стола заказов.
@InputType('MarketplaceDetailKUInput')
export class DetailKUInputDTO {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsString()
  coopname!: string;

  @Field(() => String, { description: 'Идентификатор КУ в core (`braname`)' })
  @IsString()
  @MinLength(1)
  @MaxLength(13)
  coreBraname!: string;

  @Field(() => String, { description: 'Полный адрес ПВЗ для отображения и геокодинга' })
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  addressFull!: string;

  @Field(() => String, { description: 'Контактный телефон ПВЗ' })
  @IsString()
  @MaxLength(50)
  contactPhone!: string;

  @Field(() => String, { description: 'Контактный email ПВЗ' })
  @IsEmail()
  @MaxLength(200)
  contactEmail!: string;

  @Field(() => WorkingHoursInputDTO, { description: 'Режим работы ПВЗ по дням недели' })
  workingHours!: WorkingHoursInputDTO;

  @Field(() => String, { description: 'Дополнительное описание ПВЗ', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}
