import { Inject, Injectable, Logger } from '@nestjs/common';
import httpStatus from 'http-status';
import { Ledger2Contract } from 'cooptypes';
import { TransactResult } from '@wharfkit/session';
import { BlockchainService } from '../blockchain.service';
import { VAULT_DOMAIN_SERVICE, VaultDomainService } from '~/domain/vault/services/vault-domain.service';
import { HttpApiError } from '~/utils/httpApiError';
import type { TransactionResult } from '~/domain/blockchain/types/transaction-result.type';
import type {
  Ledger2BlockchainPort,
  WalmoveBlockchainDomainInterface,
} from '~/domain/ledger2/ports/ledger2-blockchain.port';
import { DomainToBlockchainUtils } from '~/shared/utils/domain-to-blockchain.utils';

/**
 * Блокчейн-адаптер ledger2 — пишет операции корректировок председателя.
 *
 * Подпись `coopname@active` через `BlockchainService.transact` с WIF из vault.
 * Использует cooptypes (`Ledger2Contract.Actions.{Walmove,Revert}`) для имени
 * action'а и интерфейса payload — никаких сырых строк.
 */
@Injectable()
export class Ledger2BlockchainAdapter implements Ledger2BlockchainPort {
  private readonly logger = new Logger(Ledger2BlockchainAdapter.name);

  constructor(
    private readonly blockchainService: BlockchainService,
    private readonly domainToBlockchainUtils: DomainToBlockchainUtils,
    @Inject(VAULT_DOMAIN_SERVICE) private readonly vaultDomainService: VaultDomainService,
  ) {}

  async walmove(data: WalmoveBlockchainDomainInterface): Promise<TransactionResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) {
      throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ председателя для подписания корректировки');
    }
    this.blockchainService.initialize(data.coopname, wif);

    const formattedQuantity = this.domainToBlockchainUtils.formatQuantityWithPrecision(data.quantity);

    const payload: Ledger2Contract.Actions.Walmove.IWalmove = {
      coopname: data.coopname,
      initiator: data.initiator,
      username: data.username,
      from_wallet: data.fromWallet,
      to_wallet: data.toWallet,
      amount: formattedQuantity,
      process_hash: data.processHash,
      memo: data.memo,
    };

    const result = (await this.blockchainService.transact({
      account: 'ledger2',
      name: Ledger2Contract.Actions.Walmove.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data: payload,
    })) as TransactResult;

    this.logger.log(
      `walmove ${data.fromWallet}→${data.toWallet} ${formattedQuantity}, process_hash=${data.processHash}`,
    );
    return result;
  }
}
