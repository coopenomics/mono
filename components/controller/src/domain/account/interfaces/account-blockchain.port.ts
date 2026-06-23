import type { RegistratorContract, SovietContract } from 'cooptypes';
import type { BlockchainAccountInterface } from '~/types/shared';
import type { CandidateDomainInterface } from '../interfaces/candidate-domain.interface';
import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';

/**
 * Входные данные подачи заявления на выход пайщика из кооператива (registrator::exitcoop).
 */
export interface ExitCoopDomainInterface {
  coopname: string;
  username: string;
  exit_hash: string;
  statement: ISignedDocumentDomainInterface;
}

export interface AccountBlockchainPort {
  getBlockchainAccount(username: string): Promise<BlockchainAccountInterface | null>;
  getCooperatorAccount(coopname: string): Promise<RegistratorContract.Tables.Cooperatives.ICooperative | null>;
  getParticipantAccount(
    coopname: string,
    username: string
  ): Promise<SovietContract.Tables.Participants.IParticipants | null>;
  getUserAccount(username: string): Promise<RegistratorContract.Tables.Accounts.IAccount | null>;
  addParticipantAccount(data: RegistratorContract.Actions.AddUser.IAddUser): Promise<void>;
  registerBlockchainAccount(candidate: CandidateDomainInterface): Promise<void>;
  // Подача заявления на выход пайщика из кооператива (registrator::exitcoop)
  exitCoop(data: ExitCoopDomainInterface): Promise<void>;
  // Текущий процесс выхода пайщика (registrator::exits), либо null
  getExit(coopname: string, username: string): Promise<RegistratorContract.Tables.Exits.IExit | null>;
  // Процесс выхода по exit_hash (registrator::exits): on-chain confirmexit отдаёт
  // только coopname+exit_hash, username и сумму возврата берём из таблицы по хэшу.
  getExitByHash(coopname: string, exit_hash: string): Promise<RegistratorContract.Tables.Exits.IExit | null>;
}

export const ACCOUNT_BLOCKCHAIN_PORT = Symbol('AccountBlockchainPort');
