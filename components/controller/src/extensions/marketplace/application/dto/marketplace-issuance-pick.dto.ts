import { Field, Float, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';
import { ArrayMaxSize, IsArray, IsNotEmpty, IsString } from 'class-validator';

/**
 * Подбор имущества на выдаче (задача 99D-18): оператор открыл выдачу пайщику
 * и сканирует бокс или этикетку имущества. Сервер отвечает, то ли это
 * имущество. Режим мягкий: ответ подсказывает и ставит галку в окне выдачи,
 * отправку на подпись не блокирует.
 */

/** На что указал код при подборе. */
export enum MarketplaceIssuancePickTarget {
  /** Этикетка позиции склада. */
  LABEL = 'LABEL',
  /** Бокс по этикетке бокса. */
  CONTAINER = 'CONTAINER',
}
registerEnumType(MarketplaceIssuancePickTarget, {
  name: 'MarketplaceIssuancePickTarget',
  description: 'На что указал код при подборе на выдаче: этикетка имущества или бокс.',
});

/** Итог сверки скана с выдачей. */
export enum MarketplaceIssuancePickVerdict {
  /** Этикетка — имущество этой выдачи; бокс — в нём лежит имущество этой выдачи. */
  MATCH = 'MATCH',
  /** Этикетка имущества, которое не входит в эту выдачу. */
  OTHER_ORDER = 'OTHER_ORDER',
  /** Имущество по этикетке уже не на складе: выдано, списано или возвращено. */
  NOT_ON_WAREHOUSE = 'NOT_ON_WAREHOUSE',
  /** Этикетка или бокс другого участка. */
  OTHER_BRANCH = 'OTHER_BRANCH',
  /** В боксе нет имущества этой выдачи. */
  BOX_EMPTY = 'BOX_EMPTY',
  /** Код не узнан: ни этикетки, ни бокса с таким кодом нет. */
  UNKNOWN = 'UNKNOWN',
}
registerEnumType(MarketplaceIssuancePickVerdict, {
  name: 'MarketplaceIssuancePickVerdict',
  description: 'Итог сверки отсканированного кода с выдачей пайщику.',
});

@InputType('MarketplaceIssuancePickScanInput')
export class MarketplaceIssuancePickScanInputDTO {
  @Field(() => String, { description: 'Участок, на котором идёт выдача.' })
  @IsString()
  @IsNotEmpty()
  braname!: string;

  @Field(() => [String], { description: 'Заказы, открытые в окне выдачи.' })
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  order_ids!: string[];

  @Field(() => String, { description: 'Строка из сканера или из поля ручного ввода.' })
  @IsString()
  @IsNotEmpty()
  code!: string;
}

@ObjectType('MarketplaceIssuancePickScan')
export class MarketplaceIssuancePickScanDTO {
  @Field(() => MarketplaceIssuancePickTarget, { nullable: true, description: 'На что указал код; null — код не узнан.' })
  target!: MarketplaceIssuancePickTarget | null;

  @Field(() => MarketplaceIssuancePickVerdict, { description: 'Итог сверки.' })
  verdict!: MarketplaceIssuancePickVerdict;

  @Field(() => String, { nullable: true, description: 'Позиция склада по этикетке.' })
  inventory_id!: string | null;

  @Field(() => String, { nullable: true, description: 'Заказ выдачи, к которому относится этикетка.' })
  order_id!: string | null;

  @Field(() => Float, { nullable: true, description: 'Сколько имущества под этикеткой, в базовой единице.' })
  quantity!: number | null;

  @Field(() => String, { nullable: true, description: 'Название имущества по этикетке.' })
  product_name!: string | null;

  @Field(() => String, { nullable: true, description: 'Код бокса.' })
  container_code!: string | null;

  @Field(() => [String], { description: 'Заказы выдачи, имущество которых лежит в боксе.' })
  order_ids!: string[];
}
