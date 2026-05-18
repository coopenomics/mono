import type { API } from '@wharfkit/antelope';
import type { IndexPosition } from '~/infrastructure/blockchain/blockchain.service';
import type { BlockchainAccountInterface } from '~/types/shared';
import type { GetInfoResult } from '~/types/shared/blockchain.types';
import type { RegistratorContract, SovietContract } from 'cooptypes';

// domain/common/ports/blockchain.port.ts
export interface BlockchainPort {
  initialize(username: string, wif: string): void;
  transact(actionOrActions: any | any[], broadcast?: boolean): Promise<any>;
  getInfo(): Promise<GetInfoResult>;
  getAccount(name: string): Promise<BlockchainAccountInterface | null>;
  getAllRows(code: string, scope: string, tableName: string): Promise<any[]>;
  getSingleRow(
    code: string,
    scope: string,
    tableName: string,
    primaryKey: API.v1.TableIndexType,
    indexPosition?: IndexPosition,
    keyType?: 'name' | 'sha256' | 'i64'
  ): Promise<any | null>;
  query(
    code: string,
    scope: string,
    tableName: string,
    options: {
      indexPosition?: IndexPosition;
      from?: string | number;
      to?: string | number;
      maxRows?: number;
    }
  ): Promise<any[]>;

  // Authentication related methods
  hasActiveKey(account: any, publicKey: string): boolean;
  getCooperative(coopname: string): Promise<any>;
  changeKey(data: RegistratorContract.Actions.ChangeKey.IChangeKey): Promise<void>;

  // Powerup related methods
  powerUp(username: string, quantity: string): Promise<void>;

  // System installation methods
  addUser(data: RegistratorContract.Actions.AddUser.IAddUser): Promise<void>;
  createBoard(data: SovietContract.Actions.Boards.CreateBoard.ICreateboard): Promise<void>;
}

export const BLOCKCHAIN_PORT = Symbol('BlockchainPort');
