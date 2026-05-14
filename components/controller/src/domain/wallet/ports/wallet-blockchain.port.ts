import type { TransactionResult } from '~/domain/blockchain/types/transaction-result.type';
import type { WalletContract } from 'cooptypes';
import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';
import type { IProgramWalletBlockchainData } from '../interfaces/program-wallet-blockchain.interface';

/**
 * Доменные интерфейсы для входных данных wallet блокчейн адаптера
 */
export interface CreateWithdrawDomainInterface {
  coopname: string;
  username: string;
  withdraw_hash: string;
  quantity: string;
  statement: ISignedDocumentDomainInterface;
}

export interface SignProgramAgreementDomainInterface {
  coopname: string;
  username: string;
  program_id: number;
  draft_id: number;
  document: ISignedDocumentDomainInterface;
}

export interface GenerateReturnStatementDomainInterface {
  coopname: string;
  username: string;
  quantity: string;
  symbol: string;
  method_id: string;
  memo?: string;
}

/**
 * Порт для взаимодействия с wallet блокчейном
 */
export interface WalletBlockchainPort {
  // Создание заявки на вывод средств в wallet контракте
  createWithdraw(data: CreateWithdrawDomainInterface): Promise<TransactionResult>;

  // Подписание программного соглашения через wallet::signagree (Эпик 2)
  signProgramAgreement(data: SignProgramAgreementDomainInterface): Promise<TransactionResult>;

  // Генерация заявления на возврат паевого взноса
  generateReturnStatement(data: GenerateReturnStatementDomainInterface): Promise<ISignedDocumentDomainInterface>;

  // Получение данных из wallet контракта
  getWithdraw(coopname: string, withdraw_hash: string): Promise<WalletContract.Tables.Withdraws.IWithdraws | null>;

  // Получение всех withdrawals для кооператива
  getWithdraws(coopname: string): Promise<WalletContract.Tables.Withdraws.IWithdraws[]>;

  // Получение всех программных кошельков кооператива
  getProgramWallets(coopname: string): Promise<IProgramWalletBlockchainData[]>;

  // Получение программных кошельков пользователя
  getProgramWalletsByUsername(coopname: string, username: string): Promise<IProgramWalletBlockchainData[]>;

  // Получение конкретного программного кошелька
  getProgramWallet(coopname: string, username: string, program_id: string): Promise<IProgramWalletBlockchainData | null>;
}

export const WALLET_BLOCKCHAIN_PORT = Symbol('WALLET_BLOCKCHAIN_PORT');
