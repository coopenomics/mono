import type { CapitalContract } from 'cooptypes';
import type { ISignedDocument } from '@coopenomics/innercoop';

/**
 * Интерфейс данных возврата из программы из блокчейна
 */
export type IProgramWithdrawBlockchainData = Omit<CapitalContract.Tables.ProgramWithdraws.IProgramWithdraw, 'statement'> & {
  statement: ISignedDocument;
};
