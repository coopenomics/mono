import { Field, Int, ObjectType } from '@nestjs/graphql';

/**
 * Бух.проводка ledger2 = пара действий debit + credit одного процесса,
 * закрытая ближайшим parent apply. Один process_hash может содержать
 * несколько проводок (multi-effect процессы).
 */
@ObjectType('Ledger2Posting')
export class Ledger2PostingDTO {
  @Field(() => String, { description: 'Стабильный ключ для UI: debitSeq_creditSeq' })
  key!: string;

  @Field(() => Int)
  blockNum!: number;

  @Field(() => String, { nullable: true, description: 'process_hash (32-hex)' })
  processHash?: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'OPERATION_REGISTRY код из parent apply (`o.cap.lend` / `o.wal.depcpl` / ...)',
  })
  operationCode?: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'global_sequence parent apply (для cross-link в реестр операций)',
  })
  parentApplyGlobalSequence?: string | null;

  @Field(() => String, { nullable: true, description: 'global_sequence debit-action' })
  debitGlobalSequence?: string | null;

  @Field(() => Int, { nullable: true, description: 'id бух.счёта debit (×1000)' })
  debitAccountId?: number | null;

  @Field(() => String, { nullable: true, description: 'global_sequence credit-action' })
  creditGlobalSequence?: string | null;

  @Field(() => Int, { nullable: true, description: 'id бух.счёта credit (×1000)' })
  creditAccountId?: number | null;

  @Field(() => String, { nullable: true, description: 'Asset "100.0000 RUB"' })
  quantity?: string | null;

  @Field(() => String, { nullable: true })
  memo?: string | null;

  @Field(() => String, { nullable: true })
  username?: string | null;

  @Field(() => Date)
  createdAt!: Date;
}

@ObjectType('Ledger2PostingsResponse')
export class Ledger2PostingsResponseDTO {
  @Field(() => [Ledger2PostingDTO])
  items!: Ledger2PostingDTO[];

  @Field(() => Int)
  totalCount!: number;

  @Field(() => Int)
  totalPages!: number;

  @Field(() => Int)
  currentPage!: number;
}
