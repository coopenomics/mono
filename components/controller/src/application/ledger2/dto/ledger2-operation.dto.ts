import { Field, Int, ObjectType } from '@nestjs/graphql';

/**
 * Операция ledger2 из blockchain_actions.
 * Ledger2 на каждую проводку пишет трио apply+walletop+debit+credit;
 * для UI-журнала отдаём все, фронт фильтрует по action.
 */
@ObjectType('Ledger2Operation')
export class Ledger2OperationDTO {
  @Field(() => String, {
    description: 'global_sequence блокчейна (строка — значения до 2^53 overflow)',
  })
  globalSequence!: string;

  @Field(() => Int)
  blockNum!: number;

  @Field(() => String)
  coopname!: string;

  @Field(() => String, {
    description: 'apply | walletop | debit | credit',
  })
  action!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Для apply: ACTION_REGISTRY code (cap.debt / wall.deposit / ...)',
  })
  actionCode?: string | null;

  @Field(() => String, { nullable: true, description: 'process_hash (32-hex)' })
  processHash?: string | null;

  @Field(() => String, { nullable: true })
  username?: string | null;

  @Field(() => Int, { nullable: true, description: 'ID счёта/кошелька (×1000)' })
  accountId?: number | null;

  @Field(() => String, { nullable: true, description: 'Asset "100.0000 RUB"' })
  quantity?: string | null;

  @Field(() => String, { nullable: true })
  memo?: string | null;

  @Field(() => Date)
  createdAt!: Date;
}

@ObjectType('Ledger2HistoryResponse')
export class Ledger2HistoryResponseDTO {
  @Field(() => [Ledger2OperationDTO])
  items!: Ledger2OperationDTO[];

  @Field(() => Int)
  totalCount!: number;

  @Field(() => Int)
  totalPages!: number;

  @Field(() => Int)
  currentPage!: number;
}
