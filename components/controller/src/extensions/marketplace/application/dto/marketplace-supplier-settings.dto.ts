import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { IsString } from 'class-validator';
import type { SupplierPaymentSettingsView } from '../services/marketplace-supplier-settings.service';

@ObjectType('MarketplaceSupplierPaymentSettings')
export class MarketplaceSupplierPaymentSettingsDTO {
  @Field(() => String, {
    nullable: true,
    description:
      'Идентификатор реквизитов (платёжного метода), выбранных поставщиком для получения выплат. ' +
      'Пусто — поставщик выбор не делал, используются реквизиты по умолчанию.',
  })
  payout_method_id!: string | null;

  @Field(() => Boolean, {
    description:
      'Есть ли у поставщика реквизиты, на которые уйдёт выплата. ' +
      'Без них публикация предложений недоступна.',
  })
  has_payout_method!: boolean;

  @Field(() => String, {
    nullable: true,
    description: 'Короткая подпись реквизитов получения выплат, например «Сбербанк •1234».',
  })
  payout_destination!: string | null;
}

export function toMarketplaceSupplierPaymentSettingsDTO(
  view: SupplierPaymentSettingsView
): MarketplaceSupplierPaymentSettingsDTO {
  const dto = new MarketplaceSupplierPaymentSettingsDTO();
  dto.payout_method_id = view.payout_method_id;
  dto.has_payout_method = view.has_payout_method;
  dto.payout_destination = view.payout_destination;
  return dto;
}

@InputType('MarketplaceSetSupplierPayoutMethodInput')
export class MarketplaceSetSupplierPayoutMethodInputDTO {
  @Field(() => String, {
    description: 'Идентификатор реквизитов (платёжного метода) из раздела «Реквизиты» пайщика.',
  })
  @IsString()
  method_id!: string;
}
