import { Field, InputType } from '@nestjs/graphql';
import { MarketplaceOrderStatusEnum } from './marketplace-order.dto';

@InputType('MarketplaceCancelOrderInput', { description: 'Параметры отмены своего заказа пайщиком.' })
export class MarketplaceCancelOrderInputDTO {
  @Field(() => String, { description: 'Идентификатор заказа, который пайщик хочет отменить (отмена возможна до приёма заказа поставщиком).' })
  public readonly order_id!: string;
}

@InputType('MarketplaceAcceptOrdersBatchInput', {
  description: 'Параметры приёма поставщиком выбранных заказов к поставке (любое подмножество группы offer × КУ).',
})
export class MarketplaceAcceptOrdersBatchInputDTO {
  @Field(() => [String], { description: 'Идентификаторы заказов, которые поставщик берёт к поставке.' })
  public readonly order_ids!: string[];
}

@InputType('MarketplaceDeclineOrdersBatchInput', {
  description: 'Параметры отказа поставщика от выбранных активных заказов.',
})
export class MarketplaceDeclineOrdersBatchInputDTO {
  @Field(() => [String], { description: 'Идентификаторы заказов, от которых поставщик отказывается.' })
  public readonly order_ids!: string[];

  @Field(() => String, { description: 'Текст причины отказа — будет показан пайщикам в их заказах.' })
  public readonly reason!: string;
}

@InputType('MarketplaceListOrdersInput', {
  description: 'Параметры фильтрации списка заказов (постранично/сортировка задаются отдельным аргументом options).',
})
export class MarketplaceListOrdersInputDTO {
  @Field(() => String, { nullable: true, description: 'Фильтр по аккаунту поставщика.' })
  public readonly supplier_account?: string;

  @Field(() => String, { nullable: true, description: 'Фильтр по аккаунту заказчика.' })
  public readonly orderer_account?: string;

  @Field(() => String, { nullable: true, description: 'Фильтр по идентификатору предложения.' })
  public readonly offer_id?: string;

  @Field(() => [MarketplaceOrderStatusEnum], {
    nullable: true,
    description: 'Один или несколько статусов заказа, по которым нужно отфильтровать список.',
  })
  public readonly statuses?: MarketplaceOrderStatusEnum[];
}

@InputType('MarketplaceGetOrderInput', { description: 'Параметры запроса одного заказа.' })
export class MarketplaceGetOrderInputDTO {
  @Field(() => String, { description: 'Идентификатор заказа.' })
  public readonly order_id!: string;
}
