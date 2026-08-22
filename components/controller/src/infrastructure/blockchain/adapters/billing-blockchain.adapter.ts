import { Inject, Injectable, Logger } from '@nestjs/common';
import httpStatus from 'http-status';
import { BillingContract } from 'cooptypes';
import config from '~/config/config';
import { TransactResult } from '@wharfkit/session';
import { BlockchainService } from '../blockchain.service';
import { VAULT_DOMAIN_SERVICE, VaultDomainService } from '~/domain/vault/services/vault-domain.service';
import { HttpApiError, DomainToBlockchainUtils } from '@coopenomics/extension-kit';
import type { TransactionResult } from '~/domain/blockchain/types/transaction-result.type';
import type {
  BillingBlockchainPort,
  BillingConvertBlockchainDomainInterface,
  BillingConvertToAxnBlockchainDomainInterface,
  BillingPayBlockchainDomainInterface,
} from '~/domain/billing/ports/billing-blockchain.port';

/**
 * Блокчейн-адаптер billing (Epic 12) — оплата подписок членскими взносами.
 *
 * Подпись через `BlockchainService.transact` с WIF из vault:
 * - `convert` — релей подписи кооператива (`coopname@active`) после JWT пайщика;
 * - `pay` и `convertToAxn` — ОПЕРАТОР платформы (аккаунт узла-хаба
 *   `config.coopname`, на Восходе = `_provider` контрактов): операции с
 *   членскими взносами авторизует только он, ключей кооперативов-спиц в vault
 *   хаба нет; спицы своими ключами управляют лишь полученным AXON.
 *
 * Имена действий и payload — из cooptypes (`BillingContract.Actions.{Convert,Pay}`),
 * без сырых строк. Состав/цены подписок on-chain не передаются — только сумма,
 * payment_hash и memo.
 */
@Injectable()
export class BillingBlockchainAdapter implements BillingBlockchainPort {
  private readonly logger = new Logger(BillingBlockchainAdapter.name);

  constructor(
    private readonly blockchainService: BlockchainService,
    private readonly domainToBlockchainUtils: DomainToBlockchainUtils,
    @Inject(VAULT_DOMAIN_SERVICE) private readonly vaultDomainService: VaultDomainService,
  ) {}

  private async initForCoop(coopname: string): Promise<void> {
    const wif = await this.vaultDomainService.getWif(coopname);
    if (!wif) {
      throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ кооператива для подписания биллинг-операции');
    }
    this.blockchainService.initialize(coopname, wif);
  }

  /** Подпись оператором платформы — аккаунтом узла-хаба (см. docstring класса). */
  private async initForOperator(): Promise<string> {
    const operator = config.coopname;
    const wif = await this.vaultDomainService.getWif(operator);
    if (!wif) {
      throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ оператора для подписания биллинг-операции');
    }
    this.blockchainService.initialize(operator, wif);
    return operator;
  }

  async convert(data: BillingConvertBlockchainDomainInterface): Promise<TransactionResult> {
    await this.initForCoop(data.coopname);
    const formattedQuantity = this.domainToBlockchainUtils.formatQuantityWithPrecision(data.quantity);

    const document = data.document as BillingContract.Actions.Convert.IConvert['document'];
    const payload: BillingContract.Actions.Convert.IConvert = {
      coopname: data.coopname,
      username: data.username,
      amount: formattedQuantity,
      // Якорь одноактового процесса p.bil.fund: хэш подписанного заявления —
      // по нему контракт кладёт документ в реестр совета и ledger2 ведёт
      // process_hash; повтор того же заявления отклоняется контрактом.
      convert_hash: document.hash,
      document,
    };

    const result = (await this.blockchainService.transact({
      account: BillingContract.contractName.production,
      name: BillingContract.Actions.Convert.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data: payload,
    })) as TransactResult;

    this.logger.log(`billing::convert ${data.coopname}/${data.username} ${formattedQuantity}`);
    return result;
  }

  async pay(data: BillingPayBlockchainDomainInterface): Promise<TransactionResult> {
    const operator = await this.initForOperator();
    const formattedQuantity = this.domainToBlockchainUtils.formatQuantityWithPrecision(data.quantity);

    const payload: BillingContract.Actions.Pay.IPay = {
      coopname: data.coopname,
      username: data.username,
      amount: formattedQuantity,
      payment_hash: data.paymentHash,
      memo: data.memo,
    };

    const result = (await this.blockchainService.transact({
      account: BillingContract.contractName.production,
      name: BillingContract.Actions.Pay.actionName,
      authorization: [{ actor: operator, permission: 'active' }],
      data: payload,
    })) as TransactResult;

    this.logger.log(`billing::pay ${data.coopname}/${data.username} ${formattedQuantity}, payment_hash=${data.paymentHash}`);
    return result;
  }

  async convertToAxn(data: BillingConvertToAxnBlockchainDomainInterface): Promise<TransactionResult> {
    const operator = await this.initForOperator();
    const formattedQuantity = this.domainToBlockchainUtils.formatQuantityWithPrecision(data.quantity);

    const payload: BillingContract.Actions.ConvertToAxn.IConvertToAxn = {
      coopname: data.username,
      amount: formattedQuantity,
      payment_hash: data.paymentHash,
    };

    const result = (await this.blockchainService.transact({
      account: BillingContract.contractName.production,
      name: BillingContract.Actions.ConvertToAxn.actionName,
      authorization: [{ actor: operator, permission: 'active' }],
      data: payload,
    })) as TransactResult;

    this.logger.log(
      `billing::converttoaxn ${data.username} ${formattedQuantity}, payment_hash=${data.paymentHash}`,
    );
    return result;
  }

  async getAxonBalance(username: string): Promise<number> {
    return this.blockchainService.getCurrencyBalance(username, config.blockchain.root_symbol);
  }
}
