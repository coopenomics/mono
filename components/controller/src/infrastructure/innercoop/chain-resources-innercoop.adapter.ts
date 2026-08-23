import { Inject, Injectable } from '@nestjs/common';
import type { IChainResourcesPort, InnerChainAccountResources } from '@coopenomics/innercoop';
import { BLOCKCHAIN_PORT, type BlockchainPort } from '~/domain/common/ports/blockchain.port';

/**
 * Реализация `IChainResourcesPort`: расширение видит состояние аккаунта и
 * просит пополнение, а платит за него кооператив ключом ядра.
 */
@Injectable()
export class ChainResourcesInnercoopAdapter implements IChainResourcesPort {
  constructor(
    @Inject(BLOCKCHAIN_PORT)
    private readonly blockchainPort: BlockchainPort
  ) {}

  async getAccount(username: string): Promise<InnerChainAccountResources | null> {
    return this.blockchainPort.getAccount(username);
  }

  async powerUp(username: string, quantity: string): Promise<void> {
    return this.blockchainPort.powerUp(username, quantity);
  }
}
