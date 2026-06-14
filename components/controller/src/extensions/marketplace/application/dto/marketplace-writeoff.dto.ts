import { Field, InputType, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';
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
  PENDING_CONFIRMATION = 'PENDING_CONFIRMATION',
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
  @Field(() => String, {
    nullable: true,
    description: 'Человеко-читаемое наименование кооперативного участка (для показа в интерфейсе).',
  })
  branch_name?: string | null;
  @Field({ description: 'Наименование позиции или артикул из карточки имущества.' })
  asset_title!: string;
  @Field({ description: 'Количество единиц к списанию.' })
  quantity!: string;
  @Field({ description: 'Сумма списания (4 знака после запятой, валюта кооператива).' })
  amount!: string;
  @Field({ description: 'Причина списания (срок годности, повреждение и т.п.).' })
  reason!: string;
  @Field(() => [String], {
    description: 'Идентификаторы партий на складе, слитых в эту строку списания.',
  })
  inventory_ids!: string[];
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
  @Field(() => [String], {
    nullable: true,
    description: 'Идентификаторы партий на складе, которые покрывает эта строка списания.',
  })
  inventory_ids?: string[];
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

@ObjectType('MarketplaceWriteoffCandidate')
export class MarketplaceWriteoffCandidateDTO {
  @Field({ description: 'Стабильный ключ строки (склад + наименование + состояние).' })
  key!: string;
  @Field(() => [String], {
    description: 'Идентификаторы всех партий на складе, слитых в эту строку-кандидат.',
  })
  inventory_ids!: string[];
  @Field({ description: 'Кооперативный участок (склад), где лежит позиция.' })
  braname!: string;
  @Field({ description: 'Человеко-читаемое наименование кооперативного участка.' })
  branch_name!: string;
  @Field({ description: 'Наименование позиции (из карточки имущества).' })
  asset_title!: string;
  @Field({ description: 'Суммарное количество единиц по всем партиям строки.' })
  quantity!: string;
  @Field({ description: 'Суммарная сумма к списанию (закупочная цена × количество, 4 знака).' })
  amount!: string;
  @Field({ description: 'Причина-кандидат (по умолчанию — истёк срок годности).' })
  reason!: string;
  @Field(() => String, { nullable: true, description: 'Ближайший срок годности среди партий (ISO).' })
  expiry_date?: string | null;
  @Field({
    description:
      'Срок годности истёк (просрочено) — первоочередной кандидат к списанию. false — имущество ещё годно, списывается вручную (порча, невозврат).',
  })
  is_expired!: boolean;
  @Field(() => Int, { description: 'Сколько партий слито в эту строку (для подсказки в интерфейсе).' })
  lots_count!: number;
}

@ObjectType('MarketplaceWriteoffConfirmationGroup')
export class MarketplaceWriteoffConfirmationGroupDTO {
  @Field({ description: 'Идентификатор проекта списания.' })
  proposal_id!: string;
  @Field({ description: 'Канонический хеш проекта (process_hash on-chain).' })
  proposal_hash!: string;
  @Field({ description: 'Кооперативный участок (склад), по которому подтверждается списание.' })
  braname!: string;
  @Field({ description: 'Человеко-читаемое наименование кооперативного участка.' })
  branch_name!: string;
  @Field({ description: 'Начало расчётного цикла списания (ISO).' })
  cycle_started_at!: string;
  @Field(() => String, { nullable: true, description: 'Когда совет авторизовал проект (ISO).' })
  authorized_at?: string | null;
  @Field(() => GraphQLJSON, { nullable: true, description: 'Протокол совета о списании (документ для просмотра).' })
  protocol_doc?: unknown;
  @Field(() => [MarketplaceWriteoffProposalItemDTO], { description: 'Неподтверждённые позиции этого участка.' })
  items!: MarketplaceWriteoffProposalItemDTO[];
  @Field({ description: 'Σ сумм позиций участка (4 знака).' })
  total_amount!: string;
}

@InputType('MarketplaceWriteoffServiceMemoSignablePayloadInput')
export class MarketplaceWriteoffServiceMemoSignablePayloadInputDTO {
  @Field({ description: 'Идентификатор проекта списания.' })
  proposal_id!: string;
  @Field({ description: 'Кооперативный участок, по которому подтверждается списание.' })
  braname!: string;
}

@InputType('MarketplaceWriteoffProtocolDocumentInput')
export class MarketplaceWriteoffProtocolDocumentInputDTO {
  @Field({ description: 'Идентификатор проекта списания.' })
  proposal_id!: string;
}

@InputType('MarketplaceConfirmWriteoffInput')
export class MarketplaceConfirmWriteoffInputDTO {
  @Field({ description: 'Идентификатор проекта списания.' })
  proposal_id!: string;
  @Field({ description: 'Кооперативный участок, по которому подтверждается списание.' })
  braname!: string;
  @Field(() => SignedDigitalDocumentInputDTO, {
    description: 'Подписанная председателем КУ Служебная записка о списании (registry_id=1111).',
  })
  signed_memo!: SignedDigitalDocumentInputDTO;
}

export const MarketplaceWriteoffProposalStatusMap = MarketplaceWriteoffProposalStatuses;
export const MarketplaceWriteoffProposalTriggerMap = MarketplaceWriteoffProposalTriggers;
