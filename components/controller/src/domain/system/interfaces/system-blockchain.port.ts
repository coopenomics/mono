import type { GetInfoResult } from '~/types/shared/blockchain.types';

export interface SystemBlockchainPort {
  getInfo(coopname: string): Promise<GetInfoResult>;
}

export const SYSTEM_BLOCKCHAIN_PORT = Symbol('SystemBlockchainPort');
