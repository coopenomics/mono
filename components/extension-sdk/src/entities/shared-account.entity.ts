import { Directive, Field, ObjectType } from '@nestjs/graphql';

/**
 * Federation v2 ссылка на core-entity `Account` (общий аккаунт — пайщик
 * или кооператив; различие — флагом is_cooperative на стороне core).
 * Расширения обычно работают через `Cooperator` или `Cooperative`, но
 * иногда нужен общий `Account` (например marketplace может ссылаться на
 * поставщика, который может быть как пайщиком, так и кооперативом).
 */
@ObjectType('Account')
@Directive('@key(fields: "username")')
export class SharedAccount {
  @Field(() => String, { description: 'Account name (EOSIO username)' })
  @Directive('@external')
  username!: string;
}
