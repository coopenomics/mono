import { Inject, Injectable, Logger } from '@nestjs/common';
import type { IChainResourcesPort, InnerChainAccountResources } from '@coopenomics/innercoop';
import { BLOCKCHAIN_PORT, type BlockchainPort } from '~/domain/common/ports/blockchain.port';
import config from '~/config/config';

/** Предел ожидания ответа узла оператора на запрос пополнения бака, мс. */
const OPERATOR_REQUEST_TIMEOUT_MS = 30_000;

/**
 * Реализация `IChainResourcesPort`: расширение видит состояние аккаунта и
 * просит пополнение, а платит за него кооператив ключом ядра.
 */
@Injectable()
export class ChainResourcesInnercoopAdapter implements IChainResourcesPort {
  private readonly logger = new Logger(ChainResourcesInnercoopAdapter.name);

  constructor(
    @Inject(BLOCKCHAIN_PORT)
    private readonly blockchainPort: BlockchainPort
  ) {}

  async getAccount(username: string): Promise<InnerChainAccountResources | null> {
    return this.blockchainPort.getAccount(username);
  }

  async powerUp(username: string, quantity: string): Promise<string> {
    return this.blockchainPort.powerUp(username, quantity);
  }

  /**
   * Попросить оператора пополнить бак AXON сразу (28.11.2026). Узел оператора
   * найден по цепи: оператор кооператива и адрес его узла в реестре сети.
   * Запрос ничего не решает сам: оператор сверяет остаток по цепи и пополняет
   * бак, только если пополнение положено. Раньше кооператив с пустым баком
   * ждал планового такта оператора — до пяти минут.
   */
  async requestTankTopup(): Promise<boolean> {
    try {
      const node = await this.blockchainPort.getOperatorNode(config.coopname);
      if (!node) return false;
      const response = await fetch(`${node.url}/backend/v1/graphql`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: 'mutation($d: RequestTankTopupInput!){ requestTankTopup(data: $d) }',
          variables: { d: { coopname: config.coopname } },
        }),
        signal: AbortSignal.timeout(OPERATOR_REQUEST_TIMEOUT_MS),
      });
      const body = (await response.json().catch(() => null)) as { data?: { requestTankTopup?: boolean } } | null;
      const topped = body?.data?.requestTankTopup === true;
      this.logger.log(
        topped
          ? `tank topup by operator ${node.operator}: done`
          : `tank topup by operator ${node.operator}: not done (status ${response.status})`,
      );
      return topped;
    } catch (e) {
      this.logger.warn(`tank topup request to operator failed: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    }
  }
}
