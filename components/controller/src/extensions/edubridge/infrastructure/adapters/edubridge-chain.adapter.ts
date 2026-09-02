import { Inject, Injectable } from '@nestjs/common';
import { EdubridgeContract } from 'cooptypes';
import httpStatus from 'http-status';
import { HttpApiError } from '@coopenomics/extension-kit';
import {
  CHAIN_PORT,
  VAULT_PORT,
  type IChainPort,
  type InnerChainAction,
  type InnerTransactResult,
  type IVaultPort,
} from '@coopenomics/innercoop';
import type { EdubridgeChainPort } from '../../domain/ports/edubridge-chain.port';

/**
 * Все действия `edubridge` требуют `require_auth(coopname)`: пайщик подписывает
 * документ, транзакцию отправляет кооператив своим ключом из хранилища.
 */
@Injectable()
export class EdubridgeChainAdapter implements EdubridgeChainPort {
  constructor(
    @Inject(CHAIN_PORT) private readonly chain: IChainPort,
    @Inject(VAULT_PORT) private readonly vault: IVaultPort
  ) {}

  private async prepare(coopname: string): Promise<void> {
    const wif = await this.vault.getWif(coopname);
    if (!wif) throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ кооператива для действий edubridge');
    this.chain.initialize(coopname, wif);
  }

  private action(name: string, data: Record<string, unknown>, coopname: string): InnerChainAction {
    return {
      account: EdubridgeContract.contractName.production,
      name,
      authorization: [{ actor: coopname, permission: 'active' }],
      data,
    };
  }

  async convertAndSubscribe(
    convert: EdubridgeContract.Actions.Convert.IConvert,
    subscribe:
      | { kind: 'open'; data: EdubridgeContract.Actions.Opensub.IOpensub }
      | { kind: 'extend'; data: EdubridgeContract.Actions.Extendsub.IExtendsub }
  ): Promise<InnerTransactResult> {
    await this.prepare(convert.coopname);
    const second =
      subscribe.kind === 'open'
        ? this.action(EdubridgeContract.Actions.Opensub.actionName, subscribe.data as unknown as Record<string, unknown>, convert.coopname)
        : this.action(EdubridgeContract.Actions.Extendsub.actionName, subscribe.data as unknown as Record<string, unknown>, convert.coopname);
    return this.chain.transact([
      this.action(EdubridgeContract.Actions.Convert.actionName, convert as unknown as Record<string, unknown>, convert.coopname),
      second,
    ]);
  }

  async expireSubscription(data: EdubridgeContract.Actions.Expiresub.IExpiresub): Promise<InnerTransactResult> {
    await this.prepare(data.coopname);
    return this.chain.transact(this.action(EdubridgeContract.Actions.Expiresub.actionName, data as unknown as Record<string, unknown>, data.coopname));
  }

  async submitRid(data: EdubridgeContract.Actions.Submitrid.ISubmitrid): Promise<InnerTransactResult> {
    await this.prepare(data.coopname);
    return this.chain.transact(this.action(EdubridgeContract.Actions.Submitrid.actionName, data as unknown as Record<string, unknown>, data.coopname));
  }

  async acceptRid(data: EdubridgeContract.Actions.Acceptrid.IAcceptrid): Promise<InnerTransactResult> {
    await this.prepare(data.coopname);
    return this.chain.transact(this.action(EdubridgeContract.Actions.Acceptrid.actionName, data as unknown as Record<string, unknown>, data.coopname));
  }

  async signContract(data: EdubridgeContract.Actions.Signcontract.ISigncontract): Promise<InnerTransactResult> {
    await this.prepare(data.coopname);
    return this.chain.transact(this.action(EdubridgeContract.Actions.Signcontract.actionName, data as unknown as Record<string, unknown>, data.coopname));
  }

  async signAnnex(data: EdubridgeContract.Actions.Signannex.ISignannex): Promise<InnerTransactResult> {
    await this.prepare(data.coopname);
    return this.chain.transact(this.action(EdubridgeContract.Actions.Signannex.actionName, data as unknown as Record<string, unknown>, data.coopname));
  }

  async declineRid(data: EdubridgeContract.Actions.Declinerid.IDeclinerid): Promise<InnerTransactResult> {
    await this.prepare(data.coopname);
    return this.chain.transact(this.action(EdubridgeContract.Actions.Declinerid.actionName, data as unknown as Record<string, unknown>, data.coopname));
  }
}
