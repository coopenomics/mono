import { Field, Int, ObjectType } from '@nestjs/graphql';
import { BaseOutputDTO } from '@coopenomics/extension-kit/sync';
import { CouncilField, DocumentAggregateDTO, createPaginationResult } from '@coopenomics/extension-kit';
import type { InnerDocumentAggregate } from '@coopenomics/innercoop';
import { LoanStatus } from '../../domain/enums/loan-status.enum';
import type { LoanDomainEntity } from '../../domain/entities/loan.entity';

/** Документы займа, собранные в агрегаты для выдачи в GraphQL. */
export interface LoanDocumentAggregates {
  statement?: InnerDocumentAggregate | null;
  contract?: InnerDocumentAggregate | null;
  signed_contract?: InnerDocumentAggregate | null;
  decision?: InnerDocumentAggregate | null;
  extension_statement?: InnerDocumentAggregate | null;
}

@ObjectType('DebtLoan', { description: 'Беспроцентный заём пайщика' })
export class LoanOutputDTO extends BaseOutputDTO {
  @Field(() => Int, { nullable: true, description: 'Номер записи в цепи' })
  id?: number;

  @Field(() => LoanStatus, { description: 'Состояние займа' })
  status!: LoanStatus;

  @Field(() => String, { description: 'Хэш займа; его короткая форма — номер договора' })
  debt_hash!: string;

  @Field(() => String, { description: 'Номер договора займа' })
  contract_number!: string;

  @Field(() => String, { description: 'Кооператив' })
  coopname!: string;

  @Field(() => String, { nullable: true, description: 'Пайщик-заёмщик' })
  username?: string;

  @Field(() => String, { nullable: true, description: 'Ключ обеспечения из реестра обеспечения; пусто у займов других приложений' })
  collateral?: string;

  @Field(() => String, { nullable: true, description: 'Контракт-источник записи: debt или приложение, выдавшее заём' })
  source?: string;

  @Field(() => String, { nullable: true, description: 'Ссылка источника (у Генерации — хэш проекта)' })
  source_ref?: string;

  @Field(() => String, { nullable: true, description: 'Сумма займа' })
  amount?: string;

  @Field(() => String, { nullable: true, description: 'Остаток к возврату' })
  remaining?: string;

  @Field(() => String, { nullable: true, description: 'Сумма на кошельке обеспечения' })
  pledged?: string;

  @Field(() => String, { nullable: true, description: 'Подача заявления' })
  created_at?: string;

  @Field(() => String, { nullable: true, description: 'Дата выдачи' })
  issued_at?: string;

  @Field(() => String, { nullable: true, description: 'Срок возврата' })
  due_at?: string;

  @Field(() => String, { nullable: true, description: 'Запрошенный срок при продлении' })
  requested_due_at?: string;

  @Field(() => String, { nullable: true, description: 'Переход в просрочку' })
  overdue_at?: string;

  @Field(() => String, { nullable: true, description: 'Причина последнего отказа платежа' })
  last_pay_error?: string;

  // Тексты документов несут личные данные и в цепь не пишутся — их видят
  // совет и владелец записи; суммы остаются открытыми, они есть в цепи.
  @Field(() => DocumentAggregateDTO, { nullable: true, description: 'Заявление на получение займа' })
  @CouncilField(['username'])
  statement?: DocumentAggregateDTO | null;

  @Field(() => DocumentAggregateDTO, { nullable: true, description: 'Договор с подписью пайщика' })
  @CouncilField(['username'])
  contract?: DocumentAggregateDTO | null;

  @Field(() => DocumentAggregateDTO, { nullable: true, description: 'Договор с подписью председателя' })
  @CouncilField(['username'])
  signed_contract?: DocumentAggregateDTO | null;

  @Field(() => DocumentAggregateDTO, { nullable: true, description: 'Решение совета' })
  @CouncilField(['username'])
  decision?: DocumentAggregateDTO | null;

  @Field(() => DocumentAggregateDTO, { nullable: true, description: 'Заявление о продлении срока' })
  @CouncilField(['username'])
  extension_statement?: DocumentAggregateDTO | null;

  static fromDomain(entity: LoanDomainEntity, aggregates?: LoanDocumentAggregates): LoanOutputDTO {
    const dto = new LoanOutputDTO();
    dto._id = entity._id as string;
    dto._created_at = entity._created_at as Date;
    dto._updated_at = entity._updated_at as Date;
    dto.present = entity.present ?? false;
    dto.block_num = entity.block_num;
    dto.id = entity.id;
    dto.status = entity.status;
    dto.debt_hash = entity.debt_hash;
    dto.contract_number = entity.debt_hash.slice(0, 8).toUpperCase();
    dto.coopname = entity.coopname;
    dto.username = entity.username;
    dto.collateral = entity.collateral;
    dto.source = entity.source;
    dto.source_ref = entity.source_ref;
    dto.amount = entity.amount;
    dto.remaining = entity.remaining;
    dto.pledged = entity.pledged;
    dto.created_at = entity.created_at;
    dto.issued_at = entity.issued_at;
    dto.due_at = entity.due_at;
    dto.requested_due_at = entity.requested_due_at;
    dto.overdue_at = entity.overdue_at;
    dto.last_pay_error = entity.last_pay_error;
    const wrap = (a?: InnerDocumentAggregate | null) => (a ? new DocumentAggregateDTO(a) : a === null ? null : undefined);
    dto.statement = wrap(aggregates?.statement);
    dto.contract = wrap(aggregates?.contract);
    dto.signed_contract = wrap(aggregates?.signed_contract);
    dto.decision = wrap(aggregates?.decision);
    dto.extension_statement = wrap(aggregates?.extension_statement);
    return dto;
  }
}

export const PaginatedLoansResult = createPaginationResult(LoanOutputDTO, 'PaginatedDebtLoans');
