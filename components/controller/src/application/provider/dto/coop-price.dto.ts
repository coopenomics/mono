import { Field, Float, InputType, Int, ObjectType } from '@nestjs/graphql';
import { IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/**
 * Индивидуальная цена услуги для кооператива (решение владельца 28.10.2026).
 * Оператор назначает её заранее, до подписки: витрина подключения и каталог
 * приложений кооператива показывают её вместо прейскуранта, подписка
 * создаётся по ней, живые подписки услуги переоцениваются сразу.
 */
@ObjectType('CoopPrice', { description: 'Индивидуальная цена услуги для кооператива у оператора' })
export class CoopPriceDTO {
  @Field(() => Int, { description: 'ID услуги (типа подписки) у провайдера' })
  subscription_type_id!: number;

  @Field(() => String, { nullable: true, description: 'Машинный код услуги' })
  code!: string | null;

  @Field(() => String, { description: 'Название услуги' })
  name!: string;

  @Field(() => Float, { description: 'Цена кооператива, ₽ в месяц; 0 — бесплатно' })
  amount_per_month!: number;

  @Field(() => Float, { description: 'Цена по прейскуранту сейчас, ₽ в месяц' })
  list_price_per_month!: number;

  @Field(() => String, { nullable: true, description: 'Основание' })
  reason!: string | null;

  @Field(() => String, { nullable: true, description: 'Кто назначил' })
  created_by!: string | null;

  @Field(() => String, { description: 'Когда назначена или изменена' })
  updated_at!: string;
}

@InputType('SetCoopPriceInput', { description: 'Назначить кооперативу индивидуальную цену услуги' })
export class SetCoopPriceInputDTO {
  @Field(() => String, { description: 'Кооператив' })
  @IsString()
  coopname!: string;

  @Field(() => Int, { description: 'ID услуги (типа подписки) у провайдера' })
  @IsInt()
  subscription_type_id!: number;

  @Field(() => Float, { description: 'Цена кооператива, ₽ в месяц; 0 — бесплатно' })
  @IsNumber()
  @Min(0)
  amount_per_month!: number;

  @Field(() => String, { nullable: true, description: 'Основание' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string | null;
}

@InputType('RemoveCoopPriceInput', { description: 'Снять индивидуальную цену услуги: кооператив на общих основаниях' })
export class RemoveCoopPriceInputDTO {
  @Field(() => String, { description: 'Кооператив' })
  @IsString()
  coopname!: string;

  @Field(() => Int, { description: 'ID услуги (типа подписки) у провайдера' })
  @IsInt()
  subscription_type_id!: number;
}
