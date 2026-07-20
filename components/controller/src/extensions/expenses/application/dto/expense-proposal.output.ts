import { Field, Int, ObjectType } from '@nestjs/graphql';
import { BaseOutputDTO } from '~/shared/dto/base.dto';
import { DocumentAggregateDTO } from '~/application/document/dto/document-aggregate.dto';
import { ExpenseProposalStatus } from '../../domain/enums/expense-proposal-status.enum';
import { ExpenseMechanics } from '../../domain/enums/expense-mechanics.enum';
import { ExpenseRecipientType } from '../../domain/enums/expense-recipient-type.enum';
import { ExpenseItemStatus } from '../../domain/enums/expense-item-status.enum';
import { ExpenseItemOutputDTO } from './expense-item.output';
import type { ExpenseProposalDomainEntity } from '../../domain/entities/expense-proposal.entity';
import type { IExpenseItemBlockchainData } from '../../domain/interfaces/expense-proposal-blockchain.interface';
import type { ExpenseProposalDocumentAggregates } from '../services/expenses-management.service';

/**
 * Output DTO СЗ-расхода. Сборка из доменной сущности через `fromDomain`.
 *
 * `statement_doc` / `decision_doc` — полные `DocumentAggregateDTO` (заявление
 * пайщика + решение совета), собираются `DocumentAggregationService` из chain-mirror
 * `signed_document`-структур. Резолвер вызывает `ExpensesManagementService
 * .buildProposalDocumentAggregates(entity)` и передаёт результат в `fromDomain`.
 * Если агрегаты не переданы — поля остаются `undefined` (например в spec'ах /
 * test-фикстурах, чтобы не тащить полный document-stack).
 */
@ObjectType('ExpenseProposal', { description: 'Смета расхода (СЗ).' })
export class ExpenseProposalOutputDTO extends BaseOutputDTO {
  @Field(() => Int, { nullable: true, description: 'ID в блокчейне.' })
  id?: number;

  @Field(() => String, { description: 'Хеш сметы расхода.' })
  proposal_hash!: string;

  @Field(() => String, { description: 'Имя кооператива (scope).' })
  coopname!: string;

  @Field(() => ExpenseProposalStatus, { description: 'Доменный статус сметы.' })
  status!: ExpenseProposalStatus;

  @Field(() => String, { nullable: true, description: 'Создатель сметы (username).' })
  username?: string;

  @Field(() => String, { nullable: true, description: 'Кошелёк-источник средств.' })
  source_wallet?: string;

  @Field(() => Int, { nullable: true, description: 'Сырой статус из блокчейна (uint8).' })
  blockchain_status?: number;

  @Field(() => [ExpenseItemOutputDTO], { description: 'Строки сметы.' })
  items!: ExpenseItemOutputDTO[];

  @Field(() => String, { nullable: true, description: 'Сумма всех строк (план).' })
  total_planned?: string;

  @Field(() => String, { nullable: true, description: 'Сумма всех строк (факт).' })
  total_actual?: string;

  @Field(() => String, { nullable: true, description: 'Время создания (chain).' })
  created_at?: string;

  @Field(() => String, { nullable: true, description: 'Время последнего обновления (chain).' })
  updated_at?: string;

  @Field(() => DocumentAggregateDTO, {
    nullable: true,
    description: 'Заявление пайщика о расходе (DocumentAggregate).',
  })
  statement_doc?: DocumentAggregateDTO | null;

  @Field(() => DocumentAggregateDTO, {
    nullable: true,
    description: 'Решение совета о расходе (DocumentAggregate).',
  })
  decision_doc?: DocumentAggregateDTO | null;

  static fromDomain(
    entity: ExpenseProposalDomainEntity,
    aggregates?: ExpenseProposalDocumentAggregates
  ): ExpenseProposalOutputDTO {
    const dto = new ExpenseProposalOutputDTO();
    dto._id = (entity as unknown as { _id: string })._id;
    dto._created_at = (entity as unknown as { _created_at: Date })._created_at;
    dto._updated_at = (entity as unknown as { _updated_at: Date })._updated_at;
    dto.present = entity.present ?? false;
    dto.block_num = entity.block_num;
    dto.id = entity.id;
    dto.proposal_hash = entity.proposal_hash;
    dto.coopname = entity.coopname;
    dto.status = entity.status;
    dto.username = entity.username;
    dto.source_wallet = entity.source_wallet;
    dto.blockchain_status = entity.blockchain_status;
    dto.items = (entity.items ?? []).map((i) => ExpenseProposalOutputDTO.itemFromBlockchain(i));
    dto.total_planned = entity.total_planned;
    dto.total_actual = entity.total_actual;
    dto.created_at = entity.created_at;
    dto.updated_at = entity.updated_at;
    dto.statement_doc = aggregates?.statement_doc
      ? new DocumentAggregateDTO(aggregates.statement_doc)
      : aggregates?.statement_doc === null
        ? null
        : undefined;
    dto.decision_doc = aggregates?.decision_doc
      ? new DocumentAggregateDTO(aggregates.decision_doc)
      : aggregates?.decision_doc === null
        ? null
        : undefined;
    return dto;
  }

  private static itemFromBlockchain(item: IExpenseItemBlockchainData): ExpenseItemOutputDTO {
    const dto = new ExpenseItemOutputDTO();
    dto.item_hash = String(item.item_hash).toLowerCase();
    dto.mechanics = ExpenseProposalOutputDTO.mapMechanics(item.mechanics);
    dto.recipient_type = ExpenseProposalOutputDTO.mapRecipientType(item.recipient_type);
    dto.recipient = item.recipient || undefined;
    dto.description = item.description;
    dto.planned_amount = item.planned_amount;
    dto.actual_amount = item.actual_amount || undefined;
    dto.status = ExpenseProposalOutputDTO.mapItemStatus(item.status);
    return dto;
  }

  private static mapMechanics(raw: number): ExpenseMechanics {
    return raw === 1 ? ExpenseMechanics.DIRECT : ExpenseMechanics.ADVANCE;
  }

  private static mapRecipientType(raw: number): ExpenseRecipientType {
    if (raw === 2) return ExpenseRecipientType.ORG;
    if (raw === 1) return ExpenseRecipientType.MEMBER;
    return ExpenseRecipientType.SELF;
  }

  private static mapItemStatus(raw: number): ExpenseItemStatus {
    switch (raw) {
      case 0:
        return ExpenseItemStatus.APPROVED;
      case 1:
        return ExpenseItemStatus.PAID;
      case 2:
        return ExpenseItemStatus.REPORTED;
      case 3:
        return ExpenseItemStatus.RETURNED;
      case 4:
        return ExpenseItemStatus.OVERSPENT;
      default:
        return ExpenseItemStatus.UNDEFINED;
    }
  }
}
