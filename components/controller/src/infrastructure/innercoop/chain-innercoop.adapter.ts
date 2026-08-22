import { Injectable } from '@nestjs/common';
import type { IChainPort, InnerChainAction, InnerTransactResult } from '@coopenomics/innercoop';
import { BlockchainService } from '~/infrastructure/blockchain/blockchain.service';

/**
 * Реализация `IChainPort` поверх сервиса цепи ядра.
 *
 * Открыты три операции из большого сервиса: назначить подписанта, провести
 * действия, прочитать таблицу. Остальное там — заведение аккаунтов, смена
 * ключей, пополнение ресурсов — работа ядра, расширению она не нужна.
 *
 * Транзиентности здесь нет намеренно: `initialize` задаёт подписанта на
 * экземпляре, и расширения работают с тем же экземпляром, что и ядро, — как
 * было до появления порта.
 */
@Injectable()
export class ChainInnercoopAdapter implements IChainPort {
  constructor(private readonly blockchainService: BlockchainService) {}

  initialize(username: string, wif: string): void {
    this.blockchainService.initialize(username, wif);
  }

  async transact(
    action: InnerChainAction | InnerChainAction[],
    broadcast = true
  ): Promise<InnerTransactResult> {
    return this.blockchainService.transact(action, broadcast);
  }

  async getAllRows<T = any>(code: string, scope: string, tableName: string): Promise<T[]> {
    return this.blockchainService.getAllRows<T>(code, scope, tableName);
  }

  async getSingleRow<T = any>(
    code: string,
    scope: string,
    tableName: string,
    primaryKey: unknown,
    indexPosition?: string,
    keyType?: string
  ): Promise<T | null> {
    // Ключ и вид индекса контракт описывает широко: их представление задаёт SDK
    // узла, а контракт от SDK не зависит. Приведение — здесь, на границе.
    return this.blockchainService.getSingleRow<T>(
      code,
      scope,
      tableName,
      primaryKey as Parameters<BlockchainService['getSingleRow']>[3],
      indexPosition as Parameters<BlockchainService['getSingleRow']>[4],
      keyType as Parameters<BlockchainService['getSingleRow']>[5]
    );
  }
}
