import { Field, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

/** На что указал код. */
export enum MarketplaceScanTarget {
  /** Пайщик: заказчик, поставщик или заявитель возврата. */
  PERSON = 'PERSON',
  /** Партия по накладной экспедитора. */
  SHIPMENT = 'SHIPMENT',
  /** Бокс по этикетке. */
  CONTAINER = 'CONTAINER',
}
registerEnumType(MarketplaceScanTarget, {
  name: 'MarketplaceScanTarget',
  description: 'На что указал отсканированный код: пайщик, партия или бокс.',
});

/** Дело пайщика на участке. Порядок перечисления — порядок приоритета. */
export enum MarketplaceScanMatterKind {
  /** Выдать заказы, принятые на участок. */
  ISSUANCE = 'ISSUANCE',
  /** Принять поставку поставщика. */
  RECEPTION = 'RECEPTION',
  /** Осмотреть имущество по гарантийному возврату. */
  RETURN = 'RETURN',
}
registerEnumType(MarketplaceScanMatterKind, {
  name: 'MarketplaceScanMatterKind',
  description: 'Дело пайщика на участке: выдача заказов, приёмка поставки, осмотр возврата.',
});

/** Вид кода, который пайщик показывает оператору. */
export enum MarketplaceHandoffCodeKindDTO {
  RECEIVE = 'RECEIVE',
  PICKUP = 'PICKUP',
}
registerEnumType(MarketplaceHandoffCodeKindDTO, {
  name: 'MarketplaceHandoffCodeKind',
  description: 'Вид кода передачи: код заказчика на получение или код поставщика на приёмку.',
});

@InputType('MarketplaceResolveScanInput')
export class MarketplaceResolveScanInputDTO {
  @Field(() => String, { description: 'Участок, на котором оператор сканирует код.' })
  @IsString()
  @IsNotEmpty()
  braname!: string;

  @Field(() => String, { description: 'Строка из сканера или из поля ручного ввода.' })
  @IsString()
  @IsNotEmpty()
  code!: string;
}

@InputType('MarketplaceHandoffCodeInput')
export class MarketplaceHandoffCodeInputDTO {
  @Field(() => MarketplaceHandoffCodeKindDTO, { description: 'Какой код показать.' })
  @IsEnum(MarketplaceHandoffCodeKindDTO)
  kind!: MarketplaceHandoffCodeKindDTO;
}

@ObjectType('MarketplaceScanMatter')
export class MarketplaceScanMatterDTO {
  @Field(() => MarketplaceScanMatterKind, { description: 'Вид дела.' })
  kind!: MarketplaceScanMatterKind;

  @Field(() => [String], { description: 'Идентификаторы заказов либо заявлений по этому делу.' })
  ids!: string[];
}

@ObjectType('MarketplaceScanVisit')
export class MarketplaceScanVisitDTO {
  @Field(() => MarketplaceScanTarget, { description: 'На что указал код.' })
  target!: MarketplaceScanTarget;

  @Field(() => String, { nullable: true, description: 'Учётная запись пайщика, если код указал на пайщика.' })
  account!: string | null;

  @Field(() => String, { nullable: true, description: 'Имя пайщика из сертификата.' })
  display_name!: string | null;

  @Field(() => [MarketplaceScanMatterDTO], {
    description: 'Дела пайщика на этом участке в порядке приоритета; пустой список — дел нет.',
  })
  matters!: MarketplaceScanMatterDTO[];

  @Field(() => String, {
    nullable: true,
    description: 'Заявление на возврат, на которое указал код, если оно ждёт осмотра на этом участке.',
  })
  focus_claim_id!: string | null;

  @Field(() => String, { nullable: true, description: 'Партия, если код указал на партию.' })
  shipment_id!: string | null;

  @Field(() => String, { nullable: true, description: 'Код бокса, если код указал на бокс.' })
  container_code!: string | null;
}

@ObjectType('MarketplaceHandoffCode')
export class MarketplaceHandoffCodeDTO {
  @Field(() => MarketplaceHandoffCodeKindDTO, { description: 'Вид кода.' })
  kind!: MarketplaceHandoffCodeKindDTO;

  @Field(() => String, { description: 'Строка для QR.' })
  code!: string;

  @Field(() => Date, { nullable: true, description: 'Срок действия кода; null — код бессрочный.' })
  expires_at!: Date | null;
}
