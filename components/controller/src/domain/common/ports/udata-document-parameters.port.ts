/**
 * Контракт живёт в секции хуков `@coopenomics/innercoop`: реализует его
 * расширение, вызывает ядро. Здесь он доступен под привычными ядру именами.
 */
export {
  PROGRAM_DOCUMENT_PARAMETERS_HOOK as UDATA_DOCUMENT_PARAMETERS_PORT,
  type IProgramDocumentParametersHook as UdataDocumentParametersPort,
} from '@coopenomics/innercoop';
