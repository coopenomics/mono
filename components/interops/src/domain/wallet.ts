/**
 * Порты кошельков и программных продуктов
 */

export interface IWalletDomainPort {
  getUserWallet(coopname: string, username: string): Promise<any>;
}

export const WALLET_DOMAIN_PORT = Symbol('WalletDomainPort');

export interface IProgramWalletRepository {
  findByUsername(username: string, programId?: number): Promise<any | null>;
  save(wallet: any): Promise<void>;
}

export const PROGRAM_WALLET_REPOSITORY = Symbol('ProgramWalletRepository');
