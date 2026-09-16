import type { InnerDocumentDeclaration } from '@coopenomics/innercoop';
import { Cooperative } from 'cooptypes';

/** Имя, под которым ядро объявляет базовый набор документов кооператива. */
export const CORE_DOCUMENTS_OWNER = 'core';

/**
 * Расширение, которое ведёт шаги подключения по документам ядра: базовый
 * набор объявлен ядром под именем `core`, а шаги для него — у `chairman`.
 */
export const CORE_STEPS_EXTENSION = 'chairman';

export const documentsOwnerOf = (extension_name: string): string =>
  extension_name === CORE_STEPS_EXTENSION ? CORE_DOCUMENTS_OWNER : extension_name;

export const onboardingExtensionOf = (owner: string): string =>
  owner === CORE_DOCUMENTS_OWNER ? CORE_STEPS_EXTENSION : owner;

const R = Cooperative.Registry;

/**
 * Оператор платформы. Оферту о присоединении к платформе (50) утверждает его
 * совет, остальные кооперативы её только принимают при подключении — в их
 * реестре шаблонов её нет. Имя задано в контрактах (`_provider`).
 */
export const PLATFORM_PROVIDER_COOPNAME = 'voskhod';

const core = (
  registry_id: number,
  kind: InnerDocumentDeclaration['kind'],
  order: number,
  extra: Partial<Pick<InnerDocumentDeclaration, 'bundle' | 'vars_field' | 'title'>> = {}
): InnerDocumentDeclaration => ({
  extension_name: CORE_DOCUMENTS_OWNER,
  registry_id,
  kind,
  approval: kind === 'service' ? 'none' : 'required',
  order,
  ...extra,
});

/**
 * Базовый набор документов кооператива.
 *
 * Соглашения и формы участника наследуют ключи шагов онбординга председателя
 * (`wallet_agreement`, `privacy_agreement`, …): по ним фабрика пишет реквизиты
 * протокола в те же поля `vars`, которые подставляют шаблоны, а состояние
 * шага онбординга выводится из утверждений.
 *
 * Протоколы решений совета и документы общего собрания — служебные: их форма
 * задана уставом и законом, совет не утверждает форму собственного протокола
 * протоколом.
 */
export const CORE_DOCUMENT_DECLARATIONS: InnerDocumentDeclaration[] = [
  core(R.WalletAgreement.registry_id, 'agreement', 10, { bundle: 'wallet_agreement', vars_field: 'wallet_agreement' }),
  core(R.RegulationElectronicSignature.registry_id, 'agreement', 20, { bundle: 'signature_agreement', vars_field: 'signature_agreement' }),
  core(R.PrivacyPolicy.registry_id, 'agreement', 30, { bundle: 'privacy_agreement', vars_field: 'privacy_agreement' }),
  core(R.UserAgreement.registry_id, 'agreement', 40, { bundle: 'user_agreement', vars_field: 'user_agreement' }),
  core(R.CoopenomicsAgreement.registry_id, 'agreement', 50, { bundle: 'coopenomics_agreement', vars_field: 'coopenomics_agreement' }),

  core(R.ParticipantApplication.registry_id, 'form', 60, { bundle: 'participant_application', vars_field: 'participant_application' }),
  core(R.SelectBranchStatement.registry_id, 'form', 61, { bundle: 'participant_application', vars_field: 'participant_application' }),

  core(R.ConvertToAxonStatement.registry_id, 'form', 70, { bundle: 'core_forms' }),
  core(R.ParticipantExitApplication.registry_id, 'form', 71, { bundle: 'core_forms' }),
  core(R.ReturnByMoney.registry_id, 'form', 72, { bundle: 'core_forms' }),

  core(R.DecisionOfParticipantExit.registry_id, 'service', 90),
  core(R.AnnualGeneralMeetingAgenda.registry_id, 'service', 91),
  core(R.AnnualGeneralMeetingSovietDecision.registry_id, 'service', 92),
  core(R.AnnualGeneralMeetingNotification.registry_id, 'service', 93),
  core(R.AnnualGeneralMeetingVotingBallot.registry_id, 'service', 94),
  core(R.AnnualGeneralMeetingDecision.registry_id, 'service', 95),
  core(R.DecisionOfParticipantApplication.registry_id, 'service', 96),
  core(R.ProjectFreeDecision.registry_id, 'service', 97),
  core(R.FreeDecision.registry_id, 'service', 98),
  core(R.ReturnByMoneyDecision.registry_id, 'service', 99),
];

const PROVIDER_ONLY_DOCUMENTS = new Set<number>([R.CoopenomicsAgreement.registry_id]);

/** Базовый набор для конкретного кооператива: документы оператора платформы видит только он сам. */
export const coreDocumentDeclarationsFor = (coopname: string): InnerDocumentDeclaration[] =>
  coopname === PLATFORM_PROVIDER_COOPNAME
    ? CORE_DOCUMENT_DECLARATIONS
    : CORE_DOCUMENT_DECLARATIONS.filter((d) => !PROVIDER_ONLY_DOCUMENTS.has(d.registry_id));
