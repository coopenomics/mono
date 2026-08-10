import { Field, Int, ObjectType, registerEnumType } from '@nestjs/graphql';

/**
 * Почему пайщику показывают либо не показывают подпись оферты на подключении
 * к Столу заказов.
 *
 * Инцидент 2026-08-10: раньше `not_configured` и `agreement_signed` были
 * неразличимы для потребителей — оба приходили с `requires_gate=false`, и
 * фронт объявлял неподписанную оферту «уже подписанной при регистрации», а
 * grants-провайдер выдавал полные права заказчика. Поэтому теперь ветвиться
 * по `requires_gate` в отрыве от `source` НЕЛЬЗЯ: «подписи не требуется»
 * и «подписать невозможно» — разные состояния.
 *
 * Story 1.4 не различает «подписал при вступлении» vs «подписал на столе»:
 * в `wallet::users.programs[]` такой пометки нет, обе приходят как
 * `AGREEMENT_SIGNED`.
 */
export enum MarketplaceOnboardingSource {
  /** Пайщик подписал оферту ЦПП — при вступлении в кооператив либо на столе. */
  AGREEMENT_SIGNED = 'agreement_signed',
  /**
   * Кооператив ещё не завершил подключение ЦПП «Стол заказов»: нет шаблона
   * оферты либо в кооперативе не создана сама программа. Подписать оферту
   * сейчас невозможно — это состояние кооператива, а не пайщика.
   */
  NOT_CONFIGURED = 'not_configured',
  /** ЦПП подключена кооперативом, подписи пайщика ещё нет. */
  GATE_REQUIRED = 'gate_required',
}

registerEnumType(MarketplaceOnboardingSource, {
  name: 'MarketplaceOnboardingSource',
  description: 'Состояние присоединения пайщика к ЦПП «Стол заказов»',
  valuesMap: {
    AGREEMENT_SIGNED: { description: 'Оферта ЦПП подписана пайщиком' },
    NOT_CONFIGURED: {
      description: 'Кооператив ещё не завершил подключение ЦПП — подписать оферту нельзя',
    },
    GATE_REQUIRED: { description: 'Оферту нужно подписать' },
  },
});

@ObjectType('MarketplaceOnboardingState')
export class MarketplaceOnboardingStateDTO {
  @Field(() => Boolean, {
    description:
      'Нужно ли пайщику подписать оферту ЦПП. Смотреть только вместе с состоянием: false означает «подписи не требуется» лишь когда ЦПП подключена кооперативом',
  })
  public readonly requires_gate!: boolean;

  @Field(() => MarketplaceOnboardingSource, {
    description: 'Состояние присоединения пайщика к ЦПП «Стол заказов»',
  })
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
