/**
 * Целевые потребительские программы кооператива.
 *
 * Расширение работает со своей программой — знает её кошелёк и подаёт в цепь
 * её идентификатор, — поэтому и перечень, и соответствие идентификаторам общие.
 * Раньше они лежали в `~/domain/wallet`, которого за пределами монолита нет.
 */
export enum ProgramType {
  /** Основная программа кооператива. */
  MAIN = 'main',
  /** Стол заказов. */
  MARKETPLACE = 'marketplace',
  /** Генератор результатов интеллектуальной деятельности. */
  GENERATOR = 'generator',
  /** Благорост. */
  BLAGOROST = 'blagorost',
}

/**
 * Идентификаторы программ в цепи. Соответствие фиксировано: программа заведена
 * под своим номером, и сменить его нельзя — по нему считаны все прошлые записи.
 */
export const PROGRAM_ID_BY_TYPE: Record<ProgramType, string> = {
  [ProgramType.MAIN]: '1',
  [ProgramType.MARKETPLACE]: '2',
  [ProgramType.GENERATOR]: '3',
  [ProgramType.BLAGOROST]: '4',
};

export const PROGRAM_TYPE_BY_ID: Record<string, ProgramType> = {
  '1': ProgramType.MAIN,
  '2': ProgramType.MARKETPLACE,
  '3': ProgramType.GENERATOR,
  '4': ProgramType.BLAGOROST,
};

/** Неизвестный идентификатор считается основной программой. */
export function getProgramType(programId: string): ProgramType {
  return PROGRAM_TYPE_BY_ID[programId] ?? ProgramType.MAIN;
}

export function getProgramId(programType: ProgramType): string {
  return PROGRAM_ID_BY_TYPE[programType] ?? '1';
}
