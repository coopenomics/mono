import type { ISignedDocument } from '@coopenomics/innercoop';

/**
 * Доменный интерфейс для действия конвертации сегмента CAPITAL контракта
 */
export interface ConvertSegmentDomainInput {
  /** Имя аккаунта кооператива */
  coopname: string;

  /** Имя пользователя */
  username: string;

  /** Хэш проекта */
  project_hash: string;

  /** Хэш результата (анкер процесса p.cap.rid) */
  result_hash: string;

  /** Сумма для конвертации в главный кошелек */
  wallet_amount: string;

  /** Сумма для конвертации в благорост */
  capital_amount: string;

  /** Заявление */
  convert_statement: ISignedDocument;
}
