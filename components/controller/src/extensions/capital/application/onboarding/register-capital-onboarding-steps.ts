import type { OnboardingStepRegistrationPort } from '~/domain/onboarding/ports/onboarding-step-registration.port';

/**
 * Регистрирует 5 шагов онбординга capital в платформенном реестре.
 *
 * Нюанс: legacy enum CapitalOnboardingStepEnum использует значение
 * `blagorost_program`, при этом config-поле называется
 * `onboarding_blagorost_provision_done`. Платформенный сервис строит
 * имена флагов напрямую из step_key (`onboarding_<step_key>_done`),
 * поэтому здесь step_key = `'blagorost_provision'` — совпадает с
 * существующим config-полем. Старый capital resolver продолжает
 * работать со своим enum (`blagorost_program`); новый платформенный —
 * со своим step_key. Оба читают/пишут одни и те же config-флаги.
 *
 * Generic-листенер пропускает capital, всю обработку
 * DecisionTrackedEvent для capital продолжает делать
 * CapitalOnboardingEventsService.
 */
export function registerCapitalOnboardingSteps(
  port: OnboardingStepRegistrationPort
): void {
  port.unregisterStepsByExtension('capital');

  port.registerStep({
    extension_name: 'capital',
    step_key: 'generator_program_template',
    event_type: 'SOVIET_DECISION',
    vars_field: 'generator_program_template',
    generator: 'free_decision',
    default_title: 'Утверждение шаблона программы «Генератор»',
    order: 10,
  });
  port.registerStep({
    extension_name: 'capital',
    step_key: 'generation_contract_template',
    event_type: 'SOVIET_DECISION',
    vars_field: 'generation_contract_template',
    generator: 'free_decision',
    default_title: 'Утверждение шаблона договора «Генерация»',
    order: 20,
  });
  port.registerStep({
    extension_name: 'capital',
    step_key: 'generator_offer_template',
    event_type: 'SOVIET_DECISION',
    vars_field: 'generator_offer_template',
    generator: 'free_decision',
    default_title: 'Утверждение шаблона публичной оферты «Генератор»',
    order: 30,
  });
  port.registerStep({
    extension_name: 'capital',
    step_key: 'blagorost_provision',
    event_type: 'SOVIET_DECISION',
    vars_field: 'blagorost_provision',
    generator: 'free_decision',
    default_title: 'Утверждение положения «Благорост»',
    order: 40,
  });
  port.registerStep({
    extension_name: 'capital',
    step_key: 'blagorost_offer_template',
    event_type: 'SOVIET_DECISION',
    vars_field: 'blagorost_offer_template',
    generator: 'free_decision',
    default_title: 'Утверждение шаблона публичной оферты «Благорост»',
    order: 50,
  });
}
