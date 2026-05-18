import { Field, InputType, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { createPaginationResult } from '~/application/common/dto/pagination.dto';
import { SignedDigitalDocumentInputDTO } from '~/application/document/dto/signed-digital-document-input.dto';
import {
  MarketplaceWriteoffProposalStatuses,
  MarketplaceWriteoffProposalTriggers,
} from '../../domain/entities/marketplace-writeoff-proposal.types';

export enum MarketplaceWriteoffProposalStatusEnum {
  DRAFT = 'DRAFT',
  ON_AGENDA = 'ON_AGENDA',
  AUTHORIZED = 'AUTHORIZED',
  EXECUTING = 'EXECUTING',
  EXECUTED = 'EXECUTED',
  REJECTED = 'REJECTED',
}
registerEnumType(MarketplaceWriteoffProposalStatusEnum, {
  name: 'MarketplaceWriteoffProposalStatus',
  description:
    'Состояние проекта решения совета о списании скоропорта на пути от черновика до итогового списания.',
});

export enum MarketplaceWriteoffProposalTriggerEnum {
  CRON = 'cron',
  MANUAL = 'manual',
}
registerEnumType(MarketplaceWriteoffProposalTriggerEnum, {
  name: 'MarketplaceWriteoffProposalTrigger',
  description: 'Источник проекта списания: автоматический ежемесячный крон или ручное создание.',
});

@ObjectType('MarketplaceWriteoffProposalItem')
export class MarketplaceWriteoffProposalItemDTO {
  @Field({ description: 'Кооперативный участок (склад) — источник позиции к списанию.' })
  braname!: string;
  @Field({ description: 'Наименование позиции или артикул из карточки имущества.' })
  asset_title!: string;
  @Field({ description: 'Количество единиц к списанию.' })
  quantity!: string;
  @Field({ description: 'Сумма списания (4 знака после запятой, валюта кооператива).' })
  amount!: string;
  @Field({ description: 'Причина списания (срок годности, повреждение и т.п.).' })
  reason!: string;
  @Field(() => String, {
    nullable: true,
    description: 'Идентификатор инвентарной позиции, если известна.',
  })
  inventory_id?: string | null;
  @Field({ description: 'Признак того, что позиция уже исполнена через execwroff.' })
  executed!: boolean;
}

@ObjectType('MarketplaceWriteoffDecisionEntry')
export class MarketplaceWriteoffDecisionEntryDTO {
  @Field()
  at!: string;
  @Field()
  actor!: string;
  @Field()
  action!: string;
}

@ObjectType('MarketplaceWriteoffProposal')
export class MarketplaceWriteoffProposalDTO {
  @Field({ description: 'Идентификатор проекта в системе кооператива.' })
  id!: string;
  @Field()
  coopname!: string;
  @Field(() => MarketplaceWriteoffProposalTriggerEnum)
  trigger!: MarketplaceWriteoffProposalTriggerEnum;
  @Field(() => MarketplaceWriteoffProposalStatusEnum)
  status!: MarketplaceWriteoffProposalStatusEnum;
  @Field()
  cycle_started_at!: string;
  @Field({
    description:
      'Канонический хеш проекта, используется как process_hash on-chain (wroffprops, soviet.decisions).',
  })
  proposal_hash!: string;
  @Field(() => Int, { nullable: true })
  decision_id?: number | null;
  @Field(() => String, {
    nullable: true,
    description: 'Аккаунт инициатора проекта (председатель / админ).',
  })
  proposed_by_account?: string | null;
  @Field(() => String, {
    nullable: true,
    description: 'Аккаунт, принявший финальное решение.',
  })
  decided_by_account?: string | null;
  @Field(() => [MarketplaceWriteoffProposalItemDTO])
  items!: MarketplaceWriteoffProposalItemDTO[];
  @Field({ description: 'Σ сумм всех позиций (форматированный asset, 4 знака).' })
  total_amount!: string;
  @Field(() => String, {
    nullable: true,
    description: 'Причина отказа совета (если REJECTED).',
  })
  reject_reason?: string | null;
  @Field(() => [MarketplaceWriteoffDecisionEntryDTO])
  decision_log!: MarketplaceWriteoffDecisionEntryDTO[];
  @Field(() => String, { nullable: true })
  submitted_at?: string | null;
  @Field(() => String, { nullable: true })
  authorized_at?: string | null;
  @Field(() => String, { nullable: true })
  executed_at?: string | null;
  @Field(() => String, { nullable: true })
  rejected_at?: string | null;
  @Field()
  created_at!: string;
  @Field()
  updated_at!: string;
}

@ObjectType('PaginatedMarketplaceWriteoffProposals')
export class PaginatedMarketplaceWriteoffProposalsDTO extends createPaginationResult(
  MarketplaceWriteoffProposalDTO,
  'PaginatedMarketplaceWriteoffProposals'
) {}

@InputType('MarketplaceWriteoffItemInput')
export class MarketplaceWriteoffItemInputDTO {
  @Field()
  braname!: string;
  @Field()
  asset_title!: string;
  @Field()
  quantity!: string;
  @Field({ description: 'Сумма списания в формате числа с 4 знаками после запятой.' })
  amount!: string;
  @Field()
  reason!: string;
  @Field({ nullable: true })
  inventory_id?: string;
}

@InputType('MarketplaceCreateWriteoffDraftInput')
export class MarketplaceCreateWriteoffDraftInputDTO {
  @Field(() => [MarketplaceWriteoffItemInputDTO])
  items!: MarketplaceWriteoffItemInputDTO[];
  @Field({ nullable: true, description: 'Начало расчётного цикла, если отличается от текущего момента.' })
  cycle_started_at?: string;
}

@InputType('MarketplaceUpdateWriteoffDraftInput')
export class MarketplaceUpdateWriteoffDraftInputDTO {
  @Field()
  id!: string;
  @Field(() => [MarketplaceWriteoffItemInputDTO])
  items!: MarketplaceWriteoffItemInputDTO[];
}

@InputType('MarketplaceWriteoffStatementSignablePayloadInput')
export class MarketplaceWriteoffStatementSignablePayloadInputDTO {
  @Field()
  draft_id!: string;
}

@InputType('MarketplaceSubmitWriteoffDraftInput')
export class MarketplaceSubmitWriteoffDraftInputDTO {
  @Field()
  draft_id!: string;
  @Field(() => SignedDigitalDocumentInputDTO, {
    description: 'Подписанное председателем Заявление о списании скоропорта (registry_id=1106).',
  })
  signed_statement!: SignedDigitalDocumentInputDTO;
}

@InputType('MarketplaceListWriteoffProposalsInput')
export class MarketplaceListWriteoffProposalsInputDTO {
  @Field(() => [MarketplaceWriteoffProposalStatusEnum], { nullable: true })
  statuses?: MarketplaceWriteoffProposalStatusEnum[];
}

export const MarketplaceWriteoffProposalStatusMap = MarketplaceWriteoffProposalStatuses;
export const MarketplaceWriteoffProposalTriggerMap = MarketplaceWriteoffProposalTriggers;
