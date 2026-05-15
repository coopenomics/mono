import { Field, Int, ObjectType } from '@nestjs/graphql';

/**
 * Story 1.10: статус видимости marketplace-оферты в registration-flow.
 *
 * Источник правды — core `AgreementQueryPort.getAgreementById(MARKETPLACE_OFFER_AGREEMENT_ID)`:
 * запись появляется когда `MarketplacePlugin.initialize()` (Story 1.2)
 * вызвал `port.registerAgreement` — это происходит автоматически при
 * установке/restart-е расширения, если `MARKETPLACE_OFFER_TEMPLATE_REGISTRY_ID > 0`
 * (Story 1.7 наполнила).
 *
 * AC PRD говорит про per-cooperative `coop_registration_offers_registry` —
 * в реальной core архитектуре это и есть платформенный `AgreementRegistry`,
 * запись там уже per-extension (`extension_name`); coop-scoping не требуется
 * (controller всегда работает в контексте своего `config.coopname`).
 */
@ObjectType('MarketplaceRegistrationOfferStatus')
export class MarketplaceRegistrationOfferStatusDTO {
  @Field(() => Boolean, {
    description:
      'true — оферта зарегистрирована в platform AgreementRegistry, видна в SignUp; false — Story 1.7 не размещена либо init расширения ещё не отработал',
  })
  public readonly registered!: boolean;

  @Field(() => String, { nullable: true, description: 'AGREEMENT_ID (например `marketplace_offer`)' })
  public readonly agreement_id?: string;

  @Field(() => Int, { nullable: true, description: 'document_registry_id template оферты' })
  public readonly registry_id?: number;

  @Field(() => String, { nullable: true })
  public readonly agreement_type?: string;

  @Field(() => String, { nullable: true })
  public readonly title?: string;

  @Field(() => [String], {
    description:
      'Account types, для которых оферта показывается в SignUp ([individual, entrepreneur] на MVP)',
  })
  public readonly applicable_account_types!: string[];

  constructor(init: {
    registered: boolean;
    agreement_id?: string;
    registry_id?: number;
    agreement_type?: string;
    title?: string;
    applicable_account_types?: string[];
  }) {
    this.registered = init.registered;
    this.agreement_id = init.agreement_id;
    this.registry_id = init.registry_id;
    this.agreement_type = init.agreement_type;
    this.title = init.title;
    this.applicable_account_types = init.applicable_account_types ?? [];
  }
}
