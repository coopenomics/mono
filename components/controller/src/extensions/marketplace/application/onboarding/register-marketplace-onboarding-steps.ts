import { MARKETPLACE_EXTENSION_NAME } from '../../constants/marketplace-agreement-ids';
import { ONBOARDING_STEP_REGISTRY_PORT, ONBOARDING_COMPLETED_EVENT, type IOnboardingStepRegistryPort } from '@coopenomics/innercoop';
import { t } from '../../i18n';

/**
 * Шаги L1-онбординга кооператива на ЦПП «Стол заказов».
 *
 * Marketplace подключается к ПЛАТФОРМЕННОМУ механизму онбординга (как capital
 * и chairman): декларирует шаги через ONBOARDING_STEP_REGISTRY_PORT в
 * `initialize()`. Дальше всё делает generic-слой:
 *  - `completeExtensionOnboardingStep` создаёт проект решения совета
 *    (free_decision), публикует его и регистрирует tracking-rule;
 *  - `DecisionTrackingAdapter` ловит ончейн-принятие решения советом и эмитит
 *    `DecisionTrackedEvent`;
 *  - `ExtensionOnboardingEventsService` ставит `onboarding_<step>_done=true`, а
 *    когда все шаги done — эмитит `ONBOARDING_COMPLETED_EVENT`, по которому
 *    `ExtensionLifecycleDomainService` рестартит расширение и `initialize()`
 *    выставляет `coopAcceptance.accepted=true` + регистрирует оферту.
 *
 * Три пакета онбординга (порядок отображения = порядок утверждения Советом):
 *  1. Положение ЦПП «Стол заказов»  (1100.MarketplaceProgramTemplate);
 *  2. Шаблон публичной оферты ЦПП    (1102.MarketplaceOffer, бланк рабочей оферты),
 *     который затем подписывает пайщик при вступлении (L2) либо на столе (L3);
 *  3. Договор об участии в хозяйственной деятельности участка (1118) с бланками
 *     заявлений 1119, 1120, 1123 и акта 1122 (пакет `marketplace_invest`).
 *
 * Marketplace НЕ входит в LEGACY_EXTENSIONS_WITH_OWN_LISTENER, поэтому его
 * полностью обслуживает generic-слушатель — собственный events-сервис не нужен.
 */
export function registerMarketplaceOnboardingSteps(
  port: IOnboardingStepRegistryPort
): void {
  port.unregisterStepsByExtension(MARKETPLACE_EXTENSION_NAME);

  port.registerStep({
    extension_name: MARKETPLACE_EXTENSION_NAME,
    step_key: 'marketplace_provision',
    event_type: 'SOVIET_DECISION',
    vars_field: 'marketplace_provision',
    generator: 'free_decision',
    default_title: t('marketplace.onboardingSteps.approveRegulationTitle'),
    order: 10,
  });
  port.registerStep({
    extension_name: MARKETPLACE_EXTENSION_NAME,
    step_key: 'marketplace_offer_template',
    event_type: 'SOVIET_DECISION',
    vars_field: 'marketplace_offer_template',
    generator: 'free_decision',
    default_title: t('marketplace.onboardingSteps.approveOfferTemplateTitle'),
    order: 20,
  });
  // Договор об участии в хозяйственной деятельности участка (1118) с бланками
  // заявлений и акта: совет утверждает его при подключении вместе с
  // Положением и офертой (слово владельца 12.11.2026). Протокол пакета
  // попадает в шапку договора через vars.marketplace_invest_agreement_template.
  port.registerStep({
    extension_name: MARKETPLACE_EXTENSION_NAME,
    step_key: 'marketplace_invest',
    event_type: 'SOVIET_DECISION',
    vars_field: 'marketplace_invest_agreement_template',
    generator: 'free_decision',
    default_title: t('marketplace.onboardingSteps.approveInvestAgreementTitle'),
    order: 30,
  });
}
