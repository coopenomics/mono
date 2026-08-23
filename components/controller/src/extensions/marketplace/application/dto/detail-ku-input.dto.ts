import { Field, InputType } from '@nestjs/graphql';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { WorkingHoursInputDTO } from './working-hours-input.dto';

// Вход GraphQL-мутации marketplaceDetailKU: маркирует существующий в core
// кооперативный участок как ПВЗ Стола заказов. Наименование/адрес/контакты НЕ
// принимаются — они правятся на участке (стол председателя «Кооперативные
// участки») и резолвятся живьём; здесь только режим работы, описание, статус.
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

  @Field(() => WorkingHoursInputDTO, { description: 'Режим работы ПВЗ по дням недели' })
  workingHours!: WorkingHoursInputDTO;

  @Field(() => String, { description: 'Дополнительное описание ПВЗ', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}
