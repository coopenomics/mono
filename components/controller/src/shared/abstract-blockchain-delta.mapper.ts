import type { IBlockchainDeltaMapper } from './interfaces/blockchain-sync.interface';
import type { IDelta } from '~/types/common';

/**
 * Абстрактный базовый класс для всех блокчейн дельта-мапперов
 * Предоставляет общую реализацию getAllEventPatterns()
 */
export abstract class AbstractBlockchainDeltaMapper<TBlockchainData = any, TDomainEntity = any>
  implements IBlockchainDeltaMapper<TBlockchainData, TDomainEntity>
{
  /**
   * Получение всех возможных паттернов событий для подписки
   * Возвращает массив паттернов типа "delta::contract::table"
   */
  getAllEventPatterns(): string[] {
    const patterns: string[] = [];
    const supportedContracts = this.getSupportedContractNames();
    const supportedTables = this.getSupportedTableNames();

    for (const contractName of supportedContracts) {
      for (const tableName of supportedTables) {
        patterns.push(`delta::${contractName}::${tableName}`);
      }
    }

    return patterns;
  }

  // Абстрактные методы, которые должны быть реализованы в дочерних классах
  abstract getSupportedContractNames(): string[];
  abstract getSupportedTableNames(): string[];
  abstract mapDeltaToBlockchainData(delta: IDelta): TBlockchainData | null;
  abstract extractSyncValue(delta: IDelta): string;
  abstract extractSyncKey(): string;
}
