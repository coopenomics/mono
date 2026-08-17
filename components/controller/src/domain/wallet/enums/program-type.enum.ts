/**
 * Перечень целевых программ и соответствие их идентификаторам в цепи живут в
 * контракте `@coopenomics/innercoop`: расширение работает со своей программой и
 * подаёт её идентификатор в цепь, значит перечень общий. Здесь он доступен под
 * привычными ядру именами.
 */
export {
  ProgramType,
  getProgramType,
  getProgramId,
  PROGRAM_ID_BY_TYPE as PROGRAM_TYPE_TO_ID,
  PROGRAM_TYPE_BY_ID as PROGRAM_ID_TO_TYPE,
} from '@coopenomics/innercoop';
