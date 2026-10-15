import type { ISignedDocument } from './signed-document.port';

/**
 * Заявка на возврат паевого взноса деньгами — та же, что пайщик подаёт из
 * «Цифрового Кошелька»: подписанное заявление (док. 900), реквизиты и сумма.
 * Ядро заводит платёж шлюза, ставит заявку в цепь и выносит её на совет.
 */
export interface InnerCreateWithdrawInput {
  coopname: string;
  username: string;
  quantity: number;
  symbol: string;
  /** Реквизиты пайщика, на которые уйдут деньги. */
  method_id: string;
  /** Хэш платежа: им же помечено заявление, по нему платёж находят совет и кассир. */
  payment_hash: string;
  statement: ISignedDocument;
}

export interface InnerCreateWithdrawResult {
  withdraw_hash: string;
}

/**
 * Возврат паевого взноса из главного кошелька по заявлению пайщика. Расширение
 * зовёт его, когда возврат начинается с его стола: деньги уже переведены на
 * главный паевой, остаётся заявка кооперативу.
 */
export interface IWalletWithdrawPort {
  createWithdraw(input: InnerCreateWithdrawInput): Promise<InnerCreateWithdrawResult>;
}

export const WALLET_WITHDRAW_PORT = Symbol.for('Innercoop.CorePort.WalletWithdraw');
