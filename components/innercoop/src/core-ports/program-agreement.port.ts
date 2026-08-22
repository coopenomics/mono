import type { ISignedDocument } from './signed-document.port';
import type { InnerTransactResult } from './chain.port';

/**
 * Подписание пайщиком соглашения об участии в целевой программе.
 *
 * Расширение доводит пайщика до подписи своей оферты и записывает её в цепь, а
 * проверить, подписана ли она уже, ему нужно, чтобы не показывать согласие
 * второй раз. Само хранение подписей и проводка остаются в ядре: подпись
 * общая для всего кооператива, а не принадлежит расширению.
 */

/**
 * Подпись пайщика под программой.
 *
 * Дата подписи нужна, чтобы показать пайщику, когда он соглашался, — а не
 * только факт согласия.
 */
export interface InnerProgramSignature {
  /** Номер программы. Приходит из цепи и может быть строкой: там это uint64. */
  program_id: string | number;
  signed_at?: string;
  [key: string]: any;
}

export interface InnerSignProgramAgreementInput {
  coopname: string;
  username: string;
  program_id: number;
  /** Черновик соглашения в справочнике кооператива. */
  draft_id: number;
  document: ISignedDocument;
}

export interface IProgramAgreementPort {
  /**
   * Подпись пайщика под конкретной программой; `null`, если он не подписывал
   * или его соглашение уже снято.
   *
   * Порт отвечает на вопрос, а не отдаёт доменную сущность с методами: искать
   * программу в списке — не работа расширения.
   */
  findProgramSignature(coopname: string, username: string, programId: number): Promise<InnerProgramSignature | null>;

  /** Записать подпись в цепь. */
  signProgramAgreement(input: InnerSignProgramAgreementInput): Promise<InnerTransactResult>;
}

export const PROGRAM_AGREEMENT_PORT = Symbol.for('Innercoop.CorePort.ProgramAgreement');
