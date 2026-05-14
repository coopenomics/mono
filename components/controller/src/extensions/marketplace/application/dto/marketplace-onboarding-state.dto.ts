import { Field, Int, ObjectType } from '@nestjs/graphql';

/**
 * Источник, по которому marketplace-онбординг считается завершённым:
 *
 *  - `registration_flow` — пайщик подписал оферту marketplace на этапе вступления
 *    в кооператив (L2 онбординг, реализуется в Story 1.11);
 *  - `extension_gate`   — пайщик подписал оферту через L3 fallback gate
 *    непосредственно на столе (этой Story);
 *  - `not_configured`   — оферта marketplace в платформенном
 *    AgreementRegistry пока не зарегистрирована (Story 1.7 не выполнена,
 *    `MARKETPLACE_OFFER_TEMPLATE_REGISTRY_ID = 0`) — gate не нужен.
 *  - `gate_required`    — оферта зарегистрирована, но подписи пайщика ещё нет.
 *
 * Story 1.4 не различает `registration_flow` vs `extension_gate` по
 * данным `soviet::agreements3` — пометка появится в Story 1.11 (поле
 * `source` в локальной таблице, в agreements3 такого нет). До тех пор
 * подписанная оферта приходит как `agreement_signed` без подкатегории.
 */
export type MarketplaceOnboardingSource =
  | 'agreement_signed'
  | 'not_configured'
  | 'gate_required';

@ObjectType('MarketplaceOnboardingState')
export class MarketplaceOnboardingStateDTO {
  @Field(() => Boolean, {
    description:
      'true — фронт должен показать gate-диалог OnboardingCPPGate; false — пайщик может попасть на стол сразу',
  })
  public readonly requires_gate!: boolean;

  @Field(() => String)
  public readonly source!: MarketplaceOnboardingSource;

  @Field(() => Int, {
    description:
      'registry_id шаблона оферты ЦПП marketplace в платформенной document factory (Story 1.7). 0 — placeholder, оферта ещё не зарегистрирована.',
  })
  public readonly template_registry_id!: number;

  @Field(() => String, { nullable: true })
  public readonly completed_at?: string;

  @Field(() => Int, { nullable: true })
  public readonly agreement_id?: number;

  constructor(init: {
    requires_gate: boolean;
    source: MarketplaceOnboardingSource;
    template_registry_id: number;
    completed_at?: string;
    agreement_id?: number;
  }) {
    this.requires_gate = init.requires_gate;
    this.source = init.source;
    this.template_registry_id = init.template_registry_id;
    this.completed_at = init.completed_at;
    this.agreement_id = init.agreement_id;
  }
}
