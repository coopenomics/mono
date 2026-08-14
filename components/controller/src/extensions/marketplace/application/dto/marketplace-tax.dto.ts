import { Field, Float, InputType, ObjectType } from '@nestjs/graphql';
import { IsNumber, IsPositive } from 'class-validator';
import type { MarketplaceTaxView } from '../services/marketplace-tax.service';

@ObjectType('MarketplaceTaxState', {
  description:
    'Удержанный налог на доходы физических лиц: сколько удержано с выплат материальной помощи, сколько уже отправлено кассиру на оплату и сколько можно отправить сейчас.',
})
export class MarketplaceTaxStateDTO {
  @Field(() => String, {
    description: 'Удержано и ещё не перечислено в бюджет — текущий долг кооператива.',
  })
  withheld!: string;

  @Field(() => String, {
    description: 'Отправлено на оплату и ждёт подтверждения кассиром.',
  })
  in_payment!: string;

  @Field(() => String, {
    description: 'Доступно к отправке на оплату: удержано за вычетом того, что уже у кассира.',
  })
  available!: string;
}

@InputType('MarketplacePayTaxInput')
export class MarketplacePayTaxInputDTO {
  @Field(() => Float, {
    description:
      'Сумма к перечислению в бюджет. Не больше доступной: перечислить можно только то, что удержано с выплат.',
  })
  @IsNumber()
  @IsPositive()
  amount!: number;
}

export function toMarketplaceTaxStateDTO(view: MarketplaceTaxView): MarketplaceTaxStateDTO {
  const dto = new MarketplaceTaxStateDTO();
  dto.withheld = view.withheld;
  dto.in_payment = view.in_payment;
  dto.available = view.available;
  return dto;
}
