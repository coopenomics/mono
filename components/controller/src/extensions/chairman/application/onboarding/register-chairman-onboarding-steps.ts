import { type IOnboardingStepRegistryPort } from '@coopenomics/innercoop';
import { t } from '../../i18n';

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
  port: IOnboardingStepRegistryPort
): void {
  port.unregisterStepsByExtension('chairman');

  port.registerStep({
    extension_name: 'chairman',
    step_key: 'wallet_agreement',
    event_type: 'SOVIET_DECISION',
    vars_field: 'wallet_agreement',
    generator: 'free_decision',
    default_title: t('chairman.onboardingSteps.walletAgreementTitle'),
    order: 10,
  });
  port.registerStep({
    extension_name: 'chairman',
    step_key: 'signature_agreement',
    event_type: 'SOVIET_DECISION',
    vars_field: 'signature_agreement',
    generator: 'free_decision',
    default_title: t('chairman.onboardingSteps.signatureAgreementTitle'),
    order: 20,
  });
  port.registerStep({
    extension_name: 'chairman',
    step_key: 'privacy_agreement',
    event_type: 'SOVIET_DECISION',
    vars_field: 'privacy_agreement',
    generator: 'free_decision',
    default_title: t('chairman.onboardingSteps.privacyAgreementTitle'),
    order: 30,
  });
  port.registerStep({
    extension_name: 'chairman',
    step_key: 'user_agreement',
    event_type: 'SOVIET_DECISION',
    vars_field: 'user_agreement',
    generator: 'free_decision',
    default_title: t('chairman.onboardingSteps.userAgreementTitle'),
    order: 40,
  });
  port.registerStep({
    extension_name: 'chairman',
    step_key: 'participant_application',
    event_type: 'SOVIET_DECISION',
    vars_field: 'participant_application',
    generator: 'free_decision',
    default_title: t('chairman.onboardingSteps.participantApplicationTitle'),
    order: 50,
  });
  port.registerStep({
    extension_name: 'chairman',
    step_key: 'voskhod_membership',
    event_type: 'SOVIET_DECISION',
    vars_field: 'voskhod_membership',
    generator: 'free_decision',
    default_title: t('chairman.onboardingSteps.voskhodMembershipTitle'),
    order: 60,
  });
  port.registerStep({
    extension_name: 'chairman',
    step_key: 'general_meet',
    event_type: 'MEET_DECISION',
    vars_field: 'general_meet',
    generator: 'meet',
    default_title: t('chairman.onboardingSteps.generalMeetTitle'),
    order: 70,
  });
}
