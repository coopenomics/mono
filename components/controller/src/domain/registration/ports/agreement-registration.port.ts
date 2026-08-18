/**
 * Реестр оферт и программ расширения живёт в контракте
 * `@coopenomics/innercoop`: наполняет его расширение, показывает ядро. Здесь
 * порт доступен под привычными ядру именами.
 */
export {
  REGISTRATION_REGISTRY_PORT as AGREEMENT_REGISTRATION_PORT,
  type IRegistrationRegistryPort as AgreementRegistrationPort,
} from '@coopenomics/innercoop';
