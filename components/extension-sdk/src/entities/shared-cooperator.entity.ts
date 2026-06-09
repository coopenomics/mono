import { Directive, Field, ObjectType } from '@nestjs/graphql';

/**
 * Federation v2 ссылка на core-entity `Cooperator` (пайщик).
 *
 * Расширения, которым нужно расширить пайщика своими полями, **не должны**
 * описывать `Cooperator` целиком; они импортируют этот класс и добавляют
 * к нему свои поля через extend pattern на стороне core. Здесь — только
 * stub с `@key(fields: "username")` и `@external` на ключевом поле.
 *
 *   @ObjectType('Cooperator')
 *   @Directive('@extends')
 *   export class CooperatorWithChat extends SharedCooperator {
 *     @Field(() => [ChatThread]) chatThreads!: ChatThread[];
 *   }
 *
 * Контракт идентичности: `username` — EOSIO account name пайщика (≤13 символов,
 * a-z, 1-5, .). Этот же ключ используется во всех core-таблицах.
 */
@ObjectType('Cooperator')
@Directive('@key(fields: "username")')
export class SharedCooperator {
  @Field(() => String, { description: 'Account name пайщика (EOSIO username)' })
  @Directive('@external')
  username!: string;
}
