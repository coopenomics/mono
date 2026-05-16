import { Field, InputType, Int } from '@nestjs/graphql';
import { MarketplaceOrderStatusEnum } from './marketplace-order.dto';

@InputType('MarketplaceCreateOrderInput', { description: 'Параметры оформления нового заказа пайщиком.' })
export class MarketplaceCreateOrderInputDTO {
  @Field(() => String, { description: 'Идентификатор предложения, по которому пайщик оформляет заказ.' })
  public readonly offer_id!: string;

  @Field(() => Int, { description: 'Количество единиц товара (от 1; для не-безлимитных предложений — не больше доступного остатка).' })
  public readonly quantity!: number;

  @Field(() => String, { description: 'Имя пункта выдачи (ПВЗ), куда пайщик хочет получить заказ.' })
  public readonly delivery_braname!: string;
}

@InputType('MarketplaceCancelOrderInput', { description: 'Параметры отмены своего заказа пайщиком.' })
export class MarketplaceCancelOrderInputDTO {
  @Field(() => String, { description: 'Идентификатор заказа, который пайщик хочет отменить (отмена возможна до приёма заказа поставщиком).' })
  public readonly order_id!: string;
}

@InputType('MarketplaceAcceptConsolidatedRequestInput', {
  description: 'Параметры приёма сводной заявки поставщиком.',
})
export class MarketplaceAcceptConsolidatedRequestInputDTO {
  @Field(() => String, { description: 'Идентификатор сводной заявки, ожидающей решения поставщика.' })
  public readonly request_id!: string;
}

@InputType('MarketplaceDeclineConsolidatedRequestInput', {
  description: 'Параметры отказа поставщика от сводной заявки.',
})
export class MarketplaceDeclineConsolidatedRequestInputDTO {
  @Field(() => String, { description: 'Идентификатор сводной заявки, от которой поставщик отказывается.' })
  public readonly request_id!: string;

  @Field(() => String, { description: 'Текст причины отказа — будет показан пайщикам в их заказах.' })
  public readonly reason!: string;
}

@InputType('MarketplaceAcceptIndividualOrderInput', {
  description: 'Параметры индивидуального приёма заказа поставщиком.',
})
export class MarketplaceAcceptIndividualOrderInputDTO {
  @Field(() => String, { description: 'Идентификатор заказа индивидуального типа, который поставщик принимает.' })
  public readonly order_id!: string;
}

@InputType('MarketplaceDeclineIndividualOrderInput', {
  description: 'Параметры индивидуального отказа поставщика от заказа.',
})
export class MarketplaceDeclineIndividualOrderInputDTO {
  @Field(() => String, { description: 'Идентификатор заказа индивидуального типа, от которого поставщик отказывается.' })
  public readonly order_id!: string;

  @Field(() => String, { description: 'Текст причины отказа — будет показан пайщику в его заказе.' })
  public readonly reason!: string;
}

@InputType('MarketplaceDeclineOrderFromOpenPoolInput', {
  description: 'Параметры отказа поставщика от одного заказа из пула открытой подписки до запуска поставки.',
})
export class MarketplaceDeclineOrderFromOpenPoolInputDTO {
  @Field(() => String, {
    description: 'Идентификатор заказа из пула открытой подписки, от которого поставщик отказывается до запуска поставки.',
  })
  public readonly order_id!: string;

  @Field(() => String, { description: 'Текст причины отказа — будет показан пайщику в его заказе.' })
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
