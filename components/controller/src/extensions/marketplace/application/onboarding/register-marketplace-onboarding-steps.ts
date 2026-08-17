import { MARKETPLACE_EXTENSION_NAME } from '../../constants/marketplace-agreement-ids';
import { ONBOARDING_STEP_REGISTRY_PORT, ONBOARDING_COMPLETED_EVENT, type IOnboardingStepRegistryPort } from '@coopenomics/innercoop';

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
 * Два документа онбординга (порядок отображения = порядок утверждения Советом):
 *  1. Положение ЦПП «Стол заказов»  (cooptypes 1099.MarketplaceProgramTemplate);
 *  2. Шаблон публичной оферты ЦПП    (cooptypes 1100.MarketplaceOfferTemplate),
 *     который затем подписывает пайщик при вступлении (L2) либо на столе (L3).
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
    default_title: 'Утверждение Положения ЦПП «Стол заказов»',
    order: 10,
  });
  port.registerStep({
    extension_name: MARKETPLACE_EXTENSION_NAME,
    step_key: 'marketplace_offer_template',
    event_type: 'SOVIET_DECISION',
    vars_field: 'marketplace_offer_template',
    generator: 'free_decision',
    default_title: 'Утверждение шаблона публичной оферты ЦПП «Стол заказов»',
    order: 20,
  });
}
