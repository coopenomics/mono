import { Field, ID, InputType, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import type { MarketplaceStockProposalDomainEntity } from '../../domain/entities/marketplace-stock-proposal.entity';

export enum MarketplaceStockProposalStatusEnum {
  PROPOSED = 'PROPOSED',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
  CANCELLED = 'CANCELLED',
}

registerEnumType(MarketplaceStockProposalStatusEnum, {
  name: 'MarketplaceStockProposalStatus',
  description:
    'Состояние предложения имущества со склада кооператива: отправлено пайщику, принято, отклонено пайщиком либо отозвано оператором.',
});

@InputType('MarketplacePublishStockInput')
export class MarketplacePublishStockInputDTO {
  @Field(() => [ID], { description: 'Позиции свободного остатка склада для публикации в каталог.' })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  inventory_ids!: string[];

  @Field(() => String, {
    nullable: true,
    description:
      'Цена за единицу при публикации. Пусто — цена прибытия; меньше цены прибытия — уценка.',
  })
  @IsOptional()
  @IsString()
  price_per_unit?: string | null;
}

@InputType('MarketplaceUnpublishStockInput')
export class MarketplaceUnpublishStockInputDTO {
  @Field(() => [ID], { description: 'Опубликованные позиции остатка, снимаемые с витрины.' })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  inventory_ids!: string[];
}

@ObjectType('MarketplaceUnpublishStockResult')
export class MarketplaceUnpublishStockResultDTO {
  @Field(() => Int, { description: 'Сколько позиций снято с публикации.' })
  affected!: number;
}

@InputType('MarketplaceStockProposalItemInput')
export class MarketplaceStockProposalItemInputDTO {
  @Field(() => ID, { description: 'Предложение кооператива из опубликованного остатка.' })
  @IsString()
  @IsNotEmpty()
  offer_id!: string;

  @Field(() => Int, { description: 'Количество единиц, предлагаемое пайщику.' })
  @IsInt()
  @Min(1)
  quantity!: number;
}

@InputType('MarketplaceCreateStockProposalInput')
export class MarketplaceCreateStockProposalInputDTO {
  @Field(() => String, { description: 'Кооперативный участок, со склада которого идёт докладка.' })
  @IsString()
  @IsNotEmpty()
  braname!: string;

  @Field(() => String, { description: 'Пайщик-адресат предложения.' })
  @IsString()
  @IsNotEmpty()
  member_account!: string;

  @Field(() => [MarketplaceStockProposalItemInputDTO], {
    description: 'Строки предложения: что и сколько предлагается со склада.',
  })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => MarketplaceStockProposalItemInputDTO)
  items!: MarketplaceStockProposalItemInputDTO[];
}

@InputType('MarketplaceResolveStockProposalInput')
export class MarketplaceResolveStockProposalInputDTO {
  @Field(() => ID, { description: 'Предложение со склада кооператива.' })
  @IsString()
  @IsNotEmpty()
  proposal_id!: string;
}

@InputType('MarketplaceCancelStockOrderInput')
export class MarketplaceCancelStockOrderInputDTO {
  @Field(() => ID, { description: 'Заказ со склада кооператива, отменяемый до открытия выдачи.' })
  @IsString()
  @IsNotEmpty()
  order_id!: string;

  @Field(() => String, { nullable: true, description: 'Причина отмены (видна пайщику в истории заказа).' })
  @IsOptional()
  @IsString()
  reason?: string | null;
}

@InputType('MarketplaceListStockProposalsInput')
export class MarketplaceListStockProposalsInputDTO {
  @Field(() => String, { nullable: true, description: 'Фильтр по кооперативному участку.' })
  @IsOptional()
  @IsString()
  braname?: string;

  @Field(() => [MarketplaceStockProposalStatusEnum], {
    nullable: true,
    description: 'Фильтр по состояниям предложения.',
  })
  @IsOptional()
  @IsArray()
  statuses?: MarketplaceStockProposalStatusEnum[];
}

@ObjectType('MarketplaceStockProposalItem')
export class MarketplaceStockProposalItemDTO {
  @Field(() => ID, { description: 'Предложение кооператива из остатка.' })
  offer_id!: string;

  @Field(() => Int, { description: 'Предложенное количество единиц.' })
  quantity!: number;

  @Field(() => String, { description: 'Цена за единицу на момент предложения.' })
  unit_price!: string;

  @Field(() => String, { description: 'Наименование товара.' })
  product_name!: string;
}

@ObjectType('MarketplaceStockProposal')
export class MarketplaceStockProposalDTO {
  @Field(() => ID)
  id!: string;

  @Field(() => String, { description: 'Кооперативный участок, со склада которого предложено имущество.' })
  braname!: string;

  @Field(() => String, { description: 'Пайщик-адресат предложения.' })
  member_account!: string;

  @Field(() => String, { description: 'Оператор, сформировавший предложение.' })
  operator_account!: string;

  @Field(() => [MarketplaceStockProposalItemDTO], { description: 'Строки предложения.' })
  items!: MarketplaceStockProposalItemDTO[];

  @Field(() => MarketplaceStockProposalStatusEnum)
  status!: MarketplaceStockProposalStatusEnum;

  @Field(() => String, { description: 'Итоговая сумма предложения.' })
  total_cost!: string;

  @Field(() => [ID], { description: 'Заказы, созданные при принятии предложения.' })
  created_order_ids!: string[];

  @Field(() => Date, { nullable: true, description: 'Момент решения по предложению.' })
  resolved_at!: Date | null;

  @Field(() => Date)
  created_at!: Date;
}

@ObjectType('MarketplaceStockProposalAcceptResult')
export class MarketplaceStockProposalAcceptResultDTO {
  @Field(() => MarketplaceStockProposalDTO)
  proposal!: MarketplaceStockProposalDTO;

  @Field(() => [ID], { description: 'Созданные заказы со склада кооператива.' })
  order_ids!: string[];
}

export function toMarketplaceStockProposalDTO(
  e: MarketplaceStockProposalDomainEntity
): MarketplaceStockProposalDTO {
  const dto = new MarketplaceStockProposalDTO();
  dto.id = e.id;
  dto.braname = e.braname;
  dto.member_account = e.member_account;
  dto.operator_account = e.operator_account;
  dto.items = e.items.map((i) => {
    const item = new MarketplaceStockProposalItemDTO();
    item.offer_id = i.offer_id;
    item.quantity = i.quantity;
    item.unit_price = i.unit_price;
    item.product_name = i.product_name;
    return item;
  });
  dto.status = e.status as MarketplaceStockProposalStatusEnum;
  dto.total_cost = e.total_cost.toFixed(4);
  dto.created_order_ids = e.created_order_ids;
  dto.resolved_at = e.resolved_at;
  dto.created_at = e.created_at;
  return dto;
}
