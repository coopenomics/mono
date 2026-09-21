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
import type { EdubridgeChainPort, EduSubscribeExtras } from '../../domain/ports/edubridge-chain.port';

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

  /**
   * Документ в цепи хранит `meta` строкой JSON. Без этой сериализации в таблицу
   * уходит «[object Object]», и синхронизатор одобрений совета не может
   * разобрать документ — запрос до стола председателя не доходит.
   */
  private chainDoc(document: unknown): Record<string, unknown> {
    const doc = document as Record<string, unknown>;
    return { ...doc, meta: typeof doc.meta === 'string' ? doc.meta : JSON.stringify(doc.meta ?? {}) };
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
    convert: EdubridgeContract.Actions.Convert.IConvert | null,
    subscribe:
      | { kind: 'open'; data: EdubridgeContract.Actions.Opensub.IOpensub }
      | { kind: 'extend'; data: EdubridgeContract.Actions.Extendsub.IExtendsub },
    charge: EdubridgeContract.Actions.Chargefee.IChargefee,
    extras: EduSubscribeExtras = {}
  ): Promise<InnerTransactResult> {
    const coopname = charge.coopname;
    await this.prepare(coopname);
    const second =
      subscribe.kind === 'open'
        ? this.action(EdubridgeContract.Actions.Opensub.actionName, subscribe.data as unknown as Record<string, unknown>, coopname)
        : this.action(EdubridgeContract.Actions.Extendsub.actionName, subscribe.data as unknown as Record<string, unknown>, coopname);
    // Конвертации нет, когда взнос покрыт остатком кошелька программы целиком:
    // заявление тогда публикуется отдельным действием — в реестр документов
    // оно обязано попасть в любом случае.
    const first = convert
      ? [this.action(EdubridgeContract.Actions.Convert.actionName, { ...convert, statement: this.chainDoc(convert.statement) }, coopname)]
      : extras.statement
        ? [this.action(EdubridgeContract.Actions.Regstatement.actionName, { ...extras.statement, statement: this.chainDoc(extras.statement.statement) }, coopname)]
        : [];
    // Удержание — после списания взноса: берётся из уже собранного.
    const lock = positive(extras.lock)
      ? [this.action(EdubridgeContract.Actions.Lockfee.actionName, { coopname, sub_hash: charge.sub_hash, amount: extras.lock }, coopname)]
      : [];
    return this.chain.transact([
      ...first,
      second,
      // Списание в фонд идёт последним: подписка к этому моменту существует,
      // и контракт связывает взнос с ней.
      this.action(EdubridgeContract.Actions.Chargefee.actionName, charge as unknown as Record<string, unknown>, coopname),
      ...lock,
    ]);
  }

  async createExpense(data: EdubridgeContract.Actions.CreateExp.ICreateexp): Promise<InnerTransactResult> {
    await this.prepare(data.coopname);
    return this.chain.transact(
      this.action(EdubridgeContract.Actions.CreateExp.actionName, { ...data, statement: this.chainDoc(data.statement) }, data.coopname)
    );
  }

  async expireSubscription(data: EdubridgeContract.Actions.Expiresub.IExpiresub): Promise<InnerTransactResult> {
    await this.prepare(data.coopname);
    return this.chain.transact(this.action(EdubridgeContract.Actions.Expiresub.actionName, data as unknown as Record<string, unknown>, data.coopname));
  }

  async unlockFee(data: { coopname: string; sub_hash: string; amount: string; allot?: string }): Promise<InnerTransactResult> {
    await this.prepare(data.coopname);
    const { coopname, sub_hash } = data;
    return this.chain.transact([
      this.action(EdubridgeContract.Actions.Unlockfee.actionName, { coopname, sub_hash, amount: data.amount }, coopname),
      ...(positive(data.allot) ? [this.action(EdubridgeContract.Actions.Allotfee.actionName, { coopname, sub_hash, amount: data.allot }, coopname)] : []),
    ]);
  }

  async allotReserve(data: { coopname: string; sub_hash: string; amount: string }): Promise<InnerTransactResult> {
    await this.prepare(data.coopname);
    return this.chain.transact(this.action(EdubridgeContract.Actions.Allotfee.actionName, data, data.coopname));
  }

  async cancelSubscription(data: EdubridgeContract.Actions.Cancelsub.ICancelsub): Promise<InnerTransactResult> {
    await this.prepare(data.coopname);
    return this.chain.transact(this.action(EdubridgeContract.Actions.Cancelsub.actionName, data as unknown as Record<string, unknown>, data.coopname));
  }

  async freeReserve(data: { coopname: string; sub_hash: string; amount: string }): Promise<InnerTransactResult> {
    await this.prepare(data.coopname);
    return this.chain.transact(this.action(EdubridgeContract.Actions.Freereserve.actionName, data, data.coopname));
  }

  async returnToShare(data: EdubridgeContract.Actions.Retshare.IRetshare): Promise<InnerTransactResult> {
    await this.prepare(data.coopname);
    return this.chain.transact(
      this.action(EdubridgeContract.Actions.Retshare.actionName, { ...data, statement: this.chainDoc(data.statement) }, data.coopname)
    );
  }

  async holdRid(data: EdubridgeContract.Actions.Holdrid.IHoldrid): Promise<InnerTransactResult> {
    await this.prepare(data.coopname);
    return this.chain.transact(
      this.action(EdubridgeContract.Actions.Holdrid.actionName, { ...data, act: this.chainDoc(data.act) }, data.coopname)
    );
  }

  async submitRid(data: EdubridgeContract.Actions.Submitrid.ISubmitrid): Promise<InnerTransactResult> {
    await this.prepare(data.coopname);
    return this.chain.transact(
      this.action(EdubridgeContract.Actions.Submitrid.actionName, { ...data, statement: this.chainDoc(data.statement) }, data.coopname)
    );
  }

  async acceptRid(data: EdubridgeContract.Actions.Acceptrid.IAcceptrid): Promise<InnerTransactResult> {
    await this.prepare(data.coopname);
    return this.chain.transact(this.action(EdubridgeContract.Actions.Acceptrid.actionName, data as unknown as Record<string, unknown>, data.coopname));
  }

  async signContract(data: EdubridgeContract.Actions.Signcontract.ISigncontract): Promise<InnerTransactResult> {
    await this.prepare(data.coopname);
    return this.chain.transact(
      this.action(EdubridgeContract.Actions.Signcontract.actionName, { ...data, contract: this.chainDoc(data.contract) }, data.coopname)
    );
  }

  async signAnnex(data: EdubridgeContract.Actions.Signannex.ISignannex): Promise<InnerTransactResult> {
    await this.prepare(data.coopname);
    return this.chain.transact(
      this.action(EdubridgeContract.Actions.Signannex.actionName, { ...data, annex: this.chainDoc(data.annex) }, data.coopname)
    );
  }

  async declineRid(data: EdubridgeContract.Actions.Declinerid.IDeclinerid): Promise<InnerTransactResult> {
    await this.prepare(data.coopname);
    return this.chain.transact(this.action(EdubridgeContract.Actions.Declinerid.actionName, data as unknown as Record<string, unknown>, data.coopname));
  }

  async terminateContract(data: EdubridgeContract.Actions.Termcontract.ITermcontract): Promise<InnerTransactResult> {
    await this.prepare(data.coopname);
    return this.chain.transact(this.action(EdubridgeContract.Actions.Termcontract.actionName, data as unknown as Record<string, unknown>, data.coopname));
  }

  async recallRid(data: EdubridgeContract.Actions.Recallrid.IRecallrid): Promise<InnerTransactResult> {
    await this.prepare(data.coopname);
    return this.chain.transact(this.action(EdubridgeContract.Actions.Recallrid.actionName, data as unknown as Record<string, unknown>, data.coopname));
  }
}

/** Сумма цепи больше нуля: нулевые движения в транзакцию не идут. */
function positive(asset: string | null | undefined): asset is string {
  return Boolean(asset) && parseFloat(String(asset)) > 0;
}
