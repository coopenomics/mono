import { Field, Float, ID, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';
import { IsBoolean, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { DocumentAggregateDTO, GeneratedDocumentDTO, SignedDigitalDocumentDTO } from '@coopenomics/extension-kit';
import type { MarketplaceIssuanceSagaDomainEntity } from '../../domain/entities/marketplace-issuance-saga.entity';
import { MarketplaceShareReturnStatementSignedInputDTO } from '../documents-dto/marketplace-share-return-statement-document.dto';
import { MarketplaceShareReturnActSignedInputDTO } from '../documents-dto/marketplace-share-return-act-document.dto';

export enum MarketplaceIssuanceSagaStageEnum {
  FACT_FIXED = 'FACT_FIXED',
  STATEMENT_SIGNED = 'STATEMENT_SIGNED',
  DECISION_PENDING = 'DECISION_PENDING',
  DECISION_AUTHORIZED = 'DECISION_AUTHORIZED',
  ACT1_SIGNED = 'ACT1_SIGNED',
  CLOSED = 'CLOSED',
  DECLINED = 'DECLINED',
  CANCELLED = 'CANCELLED',
}
registerEnumType(MarketplaceIssuanceSagaStageEnum, {
  name: 'MarketplaceIssuanceSagaStage',
  description:
    'Этап выдачи имущества: факт зафиксирован → заявление подписано → ждём совет → решение принято, ждём подпись акта → акт подписан заказчиком, ждём закрытие → закрыто; либо отказ совета / отмена оператором.',
});

export enum MarketplaceIssuanceDecisionModeEnum {
  ROBOT = 'ROBOT',
  MANUAL = 'MANUAL',
  UNKNOWN = 'UNKNOWN',
}
registerEnumType(MarketplaceIssuanceDecisionModeEnum, {
  name: 'MarketplaceIssuanceDecisionMode',
  description: 'Как принимается решение совета по выдаче: роботом за секунды, людьми в повестке или ещё не известно.',
});

@ObjectType('MarketplaceIssuanceFact')
export class MarketplaceIssuanceFactDTO {
  @Field(() => Float, { description: 'Фактически выдаваемое количество в базовой единице.' })
  public readonly actual_quantity!: number;

  @Field(() => String, { description: 'Фактическая цена за единицу отпуска.' })
  public readonly actual_unit_price!: string;

  @Field(() => String, { description: 'Фактическая сумма выдачи.' })
  public readonly fact_cost!: string;
}

@ObjectType('MarketplaceIssuanceSaga', {
  description:
    'Ход выдачи имущества пайщику по одному заказу: этап, факт, документы и номер решения совета. Ведётся кооперативом; устройства только ставят подписи.',
})
export class MarketplaceIssuanceSagaDTO {
  @Field(() => ID)
  public readonly id!: string;

  @Field(() => String, { description: 'Заказ, по которому идёт выдача.' })
  public readonly order_id!: string;

  @Field(() => String, { description: 'Контрольная сумма заказа в блокчейне.' })
  public readonly order_hash!: string;

  @Field(() => String, { nullable: true, description: 'Бандл выдачи у стойки, в составе которого идёт выдача.' })
  public readonly proposal_id!: string | null;

  @Field(() => String, { description: 'Пайщик-получатель.' })
  public readonly member_account!: string;

  @Field(() => String, { description: 'Оператор участка, зафиксировавший факт.' })
  public readonly operator_account!: string;

  @Field(() => String, { description: 'Кооперативный участок выдачи.' })
  public readonly braname!: string;

  @Field(() => MarketplaceIssuanceSagaStageEnum)
  public readonly stage!: MarketplaceIssuanceSagaStageEnum;

  @Field(() => MarketplaceIssuanceDecisionModeEnum)
  public readonly decision_mode!: MarketplaceIssuanceDecisionModeEnum;

  @Field(() => MarketplaceIssuanceFactDTO)
  public readonly fact!: MarketplaceIssuanceFactDTO;

  @Field(() => String, { nullable: true, description: 'Номер решения совета о возврате паевого взноса имуществом.' })
  public readonly decision_id!: string | null;

  @Field(() => SignedDigitalDocumentDTO, { nullable: true, description: 'Заявление о возврате паевого взноса имуществом с подписью заказчика.' })
  public readonly statement_document!: SignedDigitalDocumentDTO | null;

  @Field(() => SignedDigitalDocumentDTO, { nullable: true, description: 'Протокол решения совета.' })
  public readonly protocol_document!: SignedDigitalDocumentDTO | null;

  @Field(() => SignedDigitalDocumentDTO, { nullable: true, description: 'Акт приёма-передачи с первой подписью заказчика.' })
  public readonly act1_document!: SignedDigitalDocumentDTO | null;

  @Field(() => SignedDigitalDocumentDTO, { nullable: true, description: 'Акт приёма-передачи с обеими подписями.' })
  public readonly act2_document!: SignedDigitalDocumentDTO | null;

  @Field(() => Boolean, { description: 'Заказчику есть что подписать прямо сейчас (заявление или акт).' })
  public readonly awaits_member_signature!: boolean;

  @Field(() => Boolean, { description: 'Оператору есть что закрыть: акт с подписью заказчика.' })
  public readonly awaits_operator_close!: boolean;

  @Field(() => Boolean, { description: 'Ждём решение совета.' })
  public readonly awaits_council!: boolean;

  @Field(() => String, { nullable: true, description: 'Последняя ошибка этапа (для оператора).' })
  public readonly last_error!: string | null;

  @Field(() => Date, { nullable: true, description: 'Когда совет принял решение.' })
  public readonly decided_at!: Date | null;

  @Field(() => Date, { nullable: true, description: 'Когда выдача закрыта или отменена.' })
  public readonly closed_at!: Date | null;

  @Field(() => Date)
  public readonly created_at!: Date;

  @Field(() => Date)
  public readonly updated_at!: Date;
}

export function toMarketplaceIssuanceSagaDTO(e: MarketplaceIssuanceSagaDomainEntity): MarketplaceIssuanceSagaDTO {
  return {
    id: e.id,
    order_id: e.order_id,
    order_hash: e.order_hash,
    proposal_id: e.proposal_id,
    member_account: e.member_account,
    operator_account: e.operator_account,
    braname: e.braname,
    stage: e.stage as MarketplaceIssuanceSagaStageEnum,
    decision_mode: e.decision_mode as MarketplaceIssuanceDecisionModeEnum,
    fact: { actual_quantity: e.fact.actual_quantity, actual_unit_price: e.fact.actual_unit_price, fact_cost: e.fact.fact_cost },
    decision_id: e.decision_id,
    statement_document: (e.statement_document as unknown as SignedDigitalDocumentDTO) ?? null,
    protocol_document: (e.protocol_document as unknown as SignedDigitalDocumentDTO) ?? null,
    act1_document: (e.act1_document as unknown as SignedDigitalDocumentDTO) ?? null,
    act2_document: (e.act2_document as unknown as SignedDigitalDocumentDTO) ?? null,
    awaits_member_signature: e.awaits_member_signature,
    awaits_operator_close: e.awaits_operator_close,
    awaits_council: e.awaits_council,
    last_error: e.last_error,
    decided_at: e.decided_at,
    closed_at: e.closed_at,
    created_at: e.created_at,
    updated_at: e.updated_at,
  };
}

@ObjectType('MarketplaceIssuanceStatementPayload', {
  description: 'Заявление о возврате паевого взноса имуществом к подписи заказчиком вместе с текущим ходом выдачи.',
})
export class MarketplaceIssuanceStatementPayloadDTO {
  @Field(() => MarketplaceIssuanceSagaDTO)
  public readonly saga!: MarketplaceIssuanceSagaDTO;

  @Field(() => GeneratedDocumentDTO, { description: 'Заявление к подписи (исходник сохранён в реестре документов).' })
  public readonly statement!: GeneratedDocumentDTO;
}

@ObjectType('MarketplaceIssuanceClosePayload', {
  description: 'Акт с первой подписью заказчика — оператор накладывает закрывающую подпись поверх.',
})
export class MarketplaceIssuanceClosePayloadDTO {
  @Field(() => MarketplaceIssuanceSagaDTO)
  public readonly saga!: MarketplaceIssuanceSagaDTO;

  @Field(() => DocumentAggregateDTO)
  public readonly act_aggregate!: DocumentAggregateDTO;
}

@InputType('MarketplaceIssuanceOrderInput')
export class MarketplaceIssuanceOrderInputDTO {
  @Field(() => ID, { description: 'Заказ, по которому идёт выдача.' })
  @IsString()
  order_id!: string;
}

@InputType('MarketplaceReadyIssueInput')
export class MarketplaceReadyIssueInputDTO {
  @Field(() => ID, { description: 'Заказ, имущество по которому поступило на участок выдачи.' })
  @IsString()
  order_id!: string;
}

@InputType('MarketplaceFixIssuanceFactInput')
export class MarketplaceFixIssuanceFactInputDTO {
  @Field(() => ID, { description: 'Заказ к выдаче.' })
  @IsString()
  order_id!: string;

  @Field(() => Float, { description: 'Фактически выдаваемое количество (в базовой единице).' })
  @IsNumber()
  @Min(0)
  actual_quantity!: number;

  @Field(() => String, { description: 'Фактическая цена за единицу отпуска.' })
  @IsString()
  actual_unit_price!: string;

  @Field(() => String, { nullable: true, description: 'Бандл выдачи у стойки, если выдача идёт в его составе.' })
  @IsOptional()
  @IsString()
  proposal_id?: string | null;
}

@InputType('MarketplaceSignIssuanceStatementInput')
export class MarketplaceSignIssuanceStatementInputDTO {
  @Field(() => ID)
  @IsString()
  order_id!: string;

  @Field(() => MarketplaceShareReturnStatementSignedInputDTO, { description: 'Заявление о возврате паевого взноса имуществом, подписанное заказчиком.' })
  @ValidateNested()
  @Type(() => MarketplaceShareReturnStatementSignedInputDTO)
  signed_statement!: MarketplaceShareReturnStatementSignedInputDTO;
}

@InputType('MarketplaceSignIssuanceActInput')
export class MarketplaceSignIssuanceActInputDTO {
  @Field(() => ID)
  @IsString()
  order_id!: string;

  @Field(() => MarketplaceShareReturnActSignedInputDTO, { description: 'Акт приёма-передачи с подписью (первой — заказчика, закрывающей — оператора поверх подписи заказчика).' })
  @ValidateNested()
  @Type(() => MarketplaceShareReturnActSignedInputDTO)
  signed_act!: MarketplaceShareReturnActSignedInputDTO;
}

@InputType('MarketplaceListIssuanceSagasInput')
export class MarketplaceListIssuanceSagasInputDTO {
  @Field(() => String, { nullable: true, description: 'Кооперативный участок выдачи (для стойки оператора).' })
  @IsOptional()
  @IsString()
  braname?: string;

  @Field(() => String, { nullable: true, description: 'Бандл выдачи у стойки.' })
  @IsOptional()
  @IsString()
  proposal_id?: string;

  @Field(() => Boolean, { nullable: true, description: 'Только незавершённые выдачи (по умолчанию — да).' })
  @IsOptional()
  @IsBoolean()
  active_only?: boolean;
}
