import type { OnboardingStepRegistrationPort } from '~/domain/onboarding/ports/onboarding-step-registration.port';

/**
 * Регистрирует 7 шагов онбординга chairman в платформенном реестре.
 *
 * Step_key'и совпадают с именами enum'а ChairmanOnboardingAgendaStepEnum и
 * с подстрокой существующих config-полей `onboarding_<step_key>_done/hash`,
 * чтобы legacy resolver (Chairman OnboardingResolver/Service) и
 * платформенный resolver (ExtensionOnboardingResolver) видели одно и то же
 * состояние.
 *
 * Generic-листенер ExtensionOnboardingEventsService пропускает chairman
 * (см. LEGACY_EXTENSIONS_WITH_OWN_LISTENER), всю обработку
 * DecisionTrackedEvent для chairman продолжает делать
 * ChairmanOnboardingEventsService. Регистрация шагов здесь нужна,
 * чтобы платформенный QUERY-резолвер возвращал состояние для chairman.
 */
export function registerChairmanOnboardingSteps(
  port: OnboardingStepRegistrationPort
): void {
  port.unregisterStepsByExtension('chairman');

  port.registerStep({
    extension_name: 'chairman',
    step_key: 'wallet_agreement',
    event_type: 'SOVIET_DECISION',
    vars_field: 'wallet_agreement',
    generator: 'free_decision',
    default_title: 'Утверждение кошелькового соглашения',
    order: 10,
  });
  port.registerStep({
    extension_name: 'chairman',
    step_key: 'signature_agreement',
    event_type: 'SOVIET_DECISION',
    vars_field: 'signature_agreement',
    generator: 'free_decision',
    default_title: 'Утверждение соглашения о простой электронной подписи',
    order: 20,
  });
  port.registerStep({
    extension_name: 'chairman',
    step_key: 'privacy_agreement',
    event_type: 'SOVIET_DECISION',
    vars_field: 'privacy_agreement',
    generator: 'free_decision',
    default_title: 'Утверждение политики конфиденциальности',
    order: 30,
  });
  port.registerStep({
    extension_name: 'chairman',
    step_key: 'user_agreement',
    event_type: 'SOVIET_DECISION',
    vars_field: 'user_agreement',
    generator: 'free_decision',
    default_title: 'Утверждение пользовательского соглашения',
    order: 40,
  });
  port.registerStep({
    extension_name: 'chairman',
    step_key: 'participant_application',
    event_type: 'SOVIET_DECISION',
    vars_field: 'participant_application',
    generator: 'free_decision',
    default_title: 'Утверждение шаблонов заявлений участника',
    order: 50,
  });
  port.registerStep({
    extension_name: 'chairman',
    step_key: 'voskhod_membership',
    event_type: 'SOVIET_DECISION',
    vars_field: 'voskhod_membership',
    generator: 'free_decision',
    default_title: 'Решение о вступлении в ПК «ВОСХОД»',
    order: 60,
  });
  port.registerStep({
    extension_name: 'chairman',
    step_key: 'general_meet',
    event_type: 'MEET_DECISION',
    vars_field: 'general_meet',
    generator: 'meet',
    default_title: 'Утверждение общим собранием',
    order: 70,
  });
}
