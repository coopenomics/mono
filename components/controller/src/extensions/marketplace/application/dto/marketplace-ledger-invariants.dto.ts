import { Field, ObjectType } from '@nestjs/graphql';
import type { InvariantResult } from '../invariants/marketplace-ledger2-invariants';

@ObjectType('MarketplaceLedgerInvariantDetail')
export class MarketplaceLedgerInvariantDetailDTO {
  @Field(() => String, { description: 'Хэш процесса (заказа, заявления, претензии), в котором найдено расхождение.' })
  public readonly process_hash!: string;

  @Field(() => String, { description: 'Что именно не сошлось в этом процессе.' })
  public readonly message!: string;
}

/**
 * Результат сверки одного инварианта учёта Стола заказов. Инварианты
 * покрывают кошелёк выплат поставщикам, счета 10, 76, 86 и 91, паевой резерв
 * под заказы и парность его блокировки и списания.
 */
@ObjectType('MarketplaceLedgerInvariant')
export class MarketplaceLedgerInvariantDTO {
  @Field(() => String, { description: 'Код инварианта: I1 … I7.' })
  public readonly invariant!: string;

  @Field(() => Boolean, { description: 'Инвариант сходится.' })
  public readonly ok!: boolean;

  @Field(() => String, { nullable: true, description: 'Ожидаемое значение по истории операций.' })
  public readonly expected!: string | null;

  @Field(() => String, { nullable: true, description: 'Фактическое значение по остаткам счетов и кошельков.' })
  public readonly actual!: string | null;

  @Field(() => String, { nullable: true, description: 'Описание расхождения; пусто, если инвариант сходится.' })
  public readonly violation!: string | null;

  @Field(() => [MarketplaceLedgerInvariantDetailDTO], { description: 'Процессы, в которых найдено расхождение.' })
  public readonly details!: MarketplaceLedgerInvariantDetailDTO[];
}

export function toMarketplaceLedgerInvariantDTO(r: InvariantResult): MarketplaceLedgerInvariantDTO {
  return {
    invariant: r.invariant,
    ok: r.ok,
    expected: r.expected ?? null,
    actual: r.actual ?? null,
    violation: r.violation ?? null,
    details: (r.details ?? []).map((d) => ({ process_hash: d.processHash, message: d.message })),
  };
}
