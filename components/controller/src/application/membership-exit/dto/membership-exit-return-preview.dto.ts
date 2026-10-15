import { Field, Int, ObjectType } from '@nestjs/graphql';

/** Кошелёк пайщика в предрасчёте выхода. */
@ObjectType('MembershipExitWallet')
export class MembershipExitWalletDTO {
  @Field(() => String, { description: 'Машинное имя кошелька' })
  wallet_name!: string;

  @Field(() => String, { description: 'Человекочитаемое название кошелька' })
  human_name!: string;

  @Field(() => String, { description: 'Остаток пайщика на кошельке' })
  balance!: string;

  @Field(() => Boolean, { description: 'Остаток возвращается пайщику при выходе' })
  returns!: boolean;

  @Field(() => String, { description: 'Что выход делает с кошельком: MAIN, RETURN_TO_MAIN, FORFEIT, BLOCKER, UNTOUCHED' })
  policy!: string;
}

/** Программа пайщика в предрасчёте выхода. */
@ObjectType('MembershipExitProgram')
export class MembershipExitProgramDTO {
  @Field(() => Int, { description: 'Идентификатор программы; 0 — кошельки вне программ' })
  program_id!: number;

  @Field(() => String, { description: 'Название программы' })
  title!: string;

  @Field(() => String, { nullable: true, description: 'Когда подписано соглашение об участии' })
  agreement_signed_at!: string | null;

  @Field(() => String, { nullable: true, description: 'Хэш подписанного соглашения' })
  agreement_hash!: string | null;

  @Field(() => [MembershipExitWalletDTO], { description: 'Кошельки программы с остатками' })
  wallets!: MembershipExitWalletDTO[];

  @Field(() => String, { description: 'Сколько возвращается по этой программе' })
  refund!: string;
}

/**
 * Предварительный расчёт возврата при выходе из кооператива.
 *
 * Считается по L3-балансам ledger2 на момент запроса обходом таблицы политики
 * кошельков — той же, что обходит контракт при одобрении совета. Итоговую сумму
 * фиксирует контракт (registrator::confirmexit), поэтому это ориентир для
 * пайщика, а не обязательство.
 */
@ObjectType('MembershipExitReturnPreview')
export class MembershipExitReturnPreviewDTO {
  @Field(() => String, { description: 'Итоговая сумма к возврату' })
  total!: string;

  @Field(() => String, { description: 'Целевой паевой взнос пайщика' })
  share_contribution!: string;

  @Field(() => String, { description: 'Минимальный паевой взнос пайщика' })
  minimum_contribution!: string;

  @Field(() => [MembershipExitProgramDTO], { description: 'Разбивка возврата по программам пайщика' })
  programs!: MembershipExitProgramDTO[];

  @Field(() => [String], { description: 'Причины, по которым выйти сейчас нельзя; пусто — выход доступен' })
  blockers!: string[];
}
