import { Inject, Injectable } from '@nestjs/common';
import { BranchContract, FundContract, Ledger2Contract, MarketContract, SovietContract } from 'cooptypes';
import httpStatus from 'http-status';
import {
  MarketplaceCheckoutOrderActionKind,
  type MarketplaceCanonicalBlockchainPort,
  type MarketplaceCheckoutChainInput,
} from '../../domain/ports/marketplace-canonical-blockchain.port';
import { DomainError } from '@coopenomics/extension-kit';
import { VAULT_PORT, type IVaultPort,
  CHAIN_PORT,
  type IChainPort,
  type InnerChainAction,
  type InnerTransactResult,
} from '@coopenomics/innercoop';

/**
 * Story 4.1: canonical-adapter для marketplace процессов. Параллелен
 * legacy `marketplace-blockchain.adapter.ts` (который под удаление в
 * отдельном refactor-PR после PR #385 — на Story 4.1 не трогаем).
 *
 * Подпись tx — ключ кооператива (`require_auth(coopname)` в C++); ключ
 * берётся из IVaultPort по `data.coopname`.
 */
@Injectable()
export class MarketplaceCanonicalBlockchainAdapter implements MarketplaceCanonicalBlockchainPort {
  constructor(
    @Inject(CHAIN_PORT) private readonly blockchainService: IChainPort,
    @Inject(VAULT_PORT)
    private readonly vaultDomainService: IVaultPort
  ) {}

  async createOrder(data: MarketContract.Actions.CreateOrder.ICreateOrder): Promise<InnerTransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) {
      throw new DomainError('MARKETPLACE_PRIVATE_KEY_NOT_FOUND_CREATEORDER', {}, httpStatus.BAD_GATEWAY);
    }

    this.blockchainService.initialize(data.coopname, wif);

    return await this.blockchainService.transact({
      account: MarketContract.contractName.production,
      name: MarketContract.Actions.CreateOrder.actionName,
      authorization: [
        {
          actor: data.coopname,
          permission: 'active',
        },
      ],
      data,
    });
  }

  async stockOrder(data: MarketContract.Actions.StockOrder.IStockOrder): Promise<InnerTransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) {
      throw new DomainError('MARKETPLACE_PRIVATE_KEY_NOT_FOUND_STOCKORDER', {}, httpStatus.BAD_GATEWAY);
    }

    this.blockchainService.initialize(data.coopname, wif);

    return await this.blockchainService.transact({
      account: MarketContract.contractName.production,
      name: MarketContract.Actions.StockOrder.actionName,
      authorization: [
        {
          actor: data.coopname,
          permission: 'active',
        },
      ],
      data,
    });
  }


  async markdown(data: MarketContract.Actions.Markdown.IMarkdown): Promise<InnerTransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) {
      throw new DomainError('MARKETPLACE_PRIVATE_KEY_NOT_FOUND_MARKDOWN', {}, httpStatus.BAD_GATEWAY);
    }

    this.blockchainService.initialize(data.coopname, wif);

    return await this.blockchainService.transact({
      account: MarketContract.contractName.production,
      name: MarketContract.Actions.Markdown.actionName,
      authorization: [
        {
          actor: data.coopname,
          permission: 'active',
        },
      ],
      data,
    });
  }

  async expireOrder(data: MarketContract.Actions.ExpireOrder.IExpireOrder): Promise<InnerTransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) {
      throw new DomainError('MARKETPLACE_PRIVATE_KEY_NOT_FOUND_EXPIREORDER', {}, httpStatus.BAD_GATEWAY);
    }

    this.blockchainService.initialize(data.coopname, wif);

    return await this.blockchainService.transact({
      account: MarketContract.contractName.production,
      name: MarketContract.Actions.ExpireOrder.actionName,
      authorization: [
        {
          actor: data.coopname,
          permission: 'active',
        },
      ],
      data,
    });
  }

  async closeOrder(data: MarketContract.Actions.CloseOrder.ICloseOrder): Promise<InnerTransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) {
      throw new DomainError('MARKETPLACE_PRIVATE_KEY_NOT_FOUND_CLOSEORDER', {}, httpStatus.BAD_GATEWAY);
    }

    this.blockchainService.initialize(data.coopname, wif);

    return await this.blockchainService.transact({
      account: MarketContract.contractName.production,
      name: MarketContract.Actions.CloseOrder.actionName,
      authorization: [
        {
          actor: data.coopname,
          permission: 'active',
        },
      ],
      data,
    });
  }

  async cancelOrder(data: MarketContract.Actions.CancelOrder.ICancelOrder): Promise<InnerTransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) {
      throw new DomainError('MARKETPLACE_PRIVATE_KEY_NOT_FOUND_CANCELORDER', {}, httpStatus.BAD_GATEWAY);
    }

    this.blockchainService.initialize(data.coopname, wif);

    return await this.blockchainService.transact({
      account: MarketContract.contractName.production,
      name: MarketContract.Actions.CancelOrder.actionName,
      authorization: [
        {
          actor: data.coopname,
          permission: 'active',
        },
      ],
      data,
    });
  }

  async acceptOrder(data: MarketContract.Actions.AcceptOrder.IAcceptOrder): Promise<InnerTransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) {
      throw new DomainError('MARKETPLACE_PRIVATE_KEY_NOT_FOUND_ACCEPTORDER', {}, httpStatus.BAD_GATEWAY);
    }

    this.blockchainService.initialize(data.coopname, wif);

    return await this.blockchainService.transact({
      account: MarketContract.contractName.production,
      name: MarketContract.Actions.AcceptOrder.actionName,
      authorization: [
        {
          actor: data.coopname,
          permission: 'active',
        },
      ],
      data,
    });
  }

  async declineOrder(data: MarketContract.Actions.DeclineOrder.IDeclineOrder): Promise<InnerTransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) {
      throw new DomainError('MARKETPLACE_PRIVATE_KEY_NOT_FOUND_DECLINEORDER', {}, httpStatus.BAD_GATEWAY);
    }

    this.blockchainService.initialize(data.coopname, wif);

    return await this.blockchainService.transact({
      account: MarketContract.contractName.production,
      name: MarketContract.Actions.DeclineOrder.actionName,
      authorization: [
        {
          actor: data.coopname,
          permission: 'active',
        },
      ],
      data,
    });
  }

  async signSupp(data: MarketContract.Actions.SignSupp.ISignSupp): Promise<InnerTransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) {
      throw new DomainError('MARKETPLACE_PRIVATE_KEY_NOT_FOUND_SIGNSUPP', {}, httpStatus.BAD_GATEWAY);
    }

    this.blockchainService.initialize(data.coopname, wif);

    return await this.blockchainService.transact({
      account: MarketContract.contractName.production,
      name: MarketContract.Actions.SignSupp.actionName,
      authorization: [
        {
          actor: data.coopname,
          permission: 'active',
        },
      ],
      data,
    });
  }

  async signChair(data: MarketContract.Actions.SignChair.ISignChair): Promise<InnerTransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) {
      throw new DomainError('MARKETPLACE_PRIVATE_KEY_NOT_FOUND_SIGNCHAIR', {}, httpStatus.BAD_GATEWAY);
    }

    this.blockchainService.initialize(data.coopname, wif);

    return await this.blockchainService.transact({
      account: MarketContract.contractName.production,
      name: MarketContract.Actions.SignChair.actionName,
      authorization: [
        {
          actor: data.coopname,
          permission: 'active',
        },
      ],
      data,
    });
  }

  async payOut(data: MarketContract.Actions.PayOut.IPayout): Promise<InnerTransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) {
      throw new DomainError('MARKETPLACE_PRIVATE_KEY_NOT_FOUND_PAYOUT', {}, httpStatus.BAD_GATEWAY);
    }

    this.blockchainService.initialize(data.coopname, wif);

    return await this.blockchainService.transact({
      account: MarketContract.contractName.production,
      name: MarketContract.Actions.PayOut.actionName,
      authorization: [
        {
          actor: data.coopname,
          permission: 'active',
        },
      ],
      data,
    });
  }



  async submRetrn(data: MarketContract.Actions.SubmRetrn.ISubmRetrn): Promise<InnerTransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) {
      throw new DomainError('MARKETPLACE_PRIVATE_KEY_NOT_FOUND_SUBMRETRN', {}, httpStatus.BAD_GATEWAY);
    }
    this.blockchainService.initialize(data.coopname, wif);
    return await this.blockchainService.transact({
      account: MarketContract.contractName.production,
      name: MarketContract.Actions.SubmRetrn.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    });
  }

  async aprRetRem(data: MarketContract.Actions.AprRetRem.IAprRetRem): Promise<InnerTransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) {
      throw new DomainError('MARKETPLACE_PRIVATE_KEY_NOT_FOUND_APRRETREM', {}, httpStatus.BAD_GATEWAY);
    }
    this.blockchainService.initialize(data.coopname, wif);
    return await this.blockchainService.transact({
      account: MarketContract.contractName.production,
      name: MarketContract.Actions.AprRetRem.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    });
  }

  async rejRetRem(data: MarketContract.Actions.RejRetRem.IRejRetRem): Promise<InnerTransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) {
      throw new DomainError('MARKETPLACE_PRIVATE_KEY_NOT_FOUND_REJRETREM', {}, httpStatus.BAD_GATEWAY);
    }
    this.blockchainService.initialize(data.coopname, wif);
    return await this.blockchainService.transact({
      account: MarketContract.contractName.production,
      name: MarketContract.Actions.RejRetRem.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    });
  }

  async accRetrn(data: MarketContract.Actions.AccRetrn.IAccRetrn): Promise<InnerTransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) {
      throw new DomainError('MARKETPLACE_PRIVATE_KEY_NOT_FOUND_ACCRETRN', {}, httpStatus.BAD_GATEWAY);
    }
    this.blockchainService.initialize(data.coopname, wif);
    return await this.blockchainService.transact({
      account: MarketContract.contractName.production,
      name: MarketContract.Actions.AccRetrn.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    });
  }

  async rejRetrn(data: MarketContract.Actions.RejRetrn.IRejRetrn): Promise<InnerTransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) {
      throw new DomainError('MARKETPLACE_PRIVATE_KEY_NOT_FOUND_REJRETRN', {}, httpStatus.BAD_GATEWAY);
    }
    this.blockchainService.initialize(data.coopname, wif);
    return await this.blockchainService.transact({
      account: MarketContract.contractName.production,
      name: MarketContract.Actions.RejRetrn.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    });
  }

  // ── Эпик 8 / p.mkt.wroff ───────────────────────────────────────────

  async propWroff(data: MarketContract.Actions.PropWroff.IPropWroff): Promise<InnerTransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) {
      throw new DomainError('MARKETPLACE_PRIVATE_KEY_NOT_FOUND_PROPWROFF', {}, httpStatus.BAD_GATEWAY);
    }
    this.blockchainService.initialize(data.coopname, wif);
    return await this.blockchainService.transact({
      account: MarketContract.contractName.production,
      name: MarketContract.Actions.PropWroff.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    });
  }

  async execWroff(data: MarketContract.Actions.ExecWroff.IExecWroff): Promise<InnerTransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) {
      throw new DomainError('MARKETPLACE_PRIVATE_KEY_NOT_FOUND_EXECWROFF', {}, httpStatus.BAD_GATEWAY);
    }
    this.blockchainService.initialize(data.coopname, wif);
    return await this.blockchainService.transact({
      account: MarketContract.contractName.production,
      name: MarketContract.Actions.ExecWroff.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    });
  }

  async confirmWroff(data: MarketContract.Actions.ConfirmWroff.IConfirmWroff): Promise<InnerTransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) {
      throw new DomainError('MARKETPLACE_PRIVATE_KEY_NOT_FOUND_CONFIRMWROFF', {}, httpStatus.BAD_GATEWAY);
    }
    this.blockchainService.initialize(data.coopname, wif);
    return await this.blockchainService.transact({
      account: MarketContract.contractName.production,
      name: MarketContract.Actions.ConfirmWroff.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    });
  }

  // ── Экономика КУ (requirement b6) ────────────────────────────────────

  /** Общий submit от ключа кооператива для actions экономики КУ (DRY). */
  private async submitAsCoop(
    coopname: string,
    account: string,
    name: string,
    // Поля действия: их состав задаёт ABI контракта, поэтому форма открытая.
    data: Record<string, any>,
    actionLabel: string
  ): Promise<InnerTransactResult> {
    const wif = await this.vaultDomainService.getWif(coopname);
    if (!wif) {
      throw new DomainError('MARKETPLACE_PRIVATE_KEY_NOT_FOUND_GENERIC', { actionLabel }, httpStatus.BAD_GATEWAY);
    }
    this.blockchainService.initialize(coopname, wif);
    return await this.blockchainService.transact({
      account,
      name,
      authorization: [{ actor: coopname, permission: 'active' }],
      data,
    });
  }

  // ── Паевая модель: выдача и возврат по решению совета (компонент 68) ──

  async readyIssue(data: MarketContract.Actions.ReadyIssue.IReadyIssue): Promise<InnerTransactResult> {
    return this.submitAsCoop(data.coopname, MarketContract.contractName.production, MarketContract.Actions.ReadyIssue.actionName, data, 'readyissue');
  }

  async issueStmt(data: MarketContract.Actions.IssueStmt.IIssueStmt): Promise<InnerTransactResult> {
    return this.submitAsCoop(data.coopname, MarketContract.contractName.production, MarketContract.Actions.IssueStmt.actionName, data, 'issuestmt');
  }

  async issueAct1(data: MarketContract.Actions.IssueAct1.IIssueAct1): Promise<InnerTransactResult> {
    return this.submitAsCoop(data.coopname, MarketContract.contractName.production, MarketContract.Actions.IssueAct1.actionName, data, 'issueact1');
  }

  async issueAct2(data: MarketContract.Actions.IssueAct2.IIssueAct2): Promise<InnerTransactResult> {
    return this.submitAsCoop(data.coopname, MarketContract.contractName.production, MarketContract.Actions.IssueAct2.actionName, data, 'issueact2');
  }

  async cancelIssue(data: MarketContract.Actions.CancelIssue.ICancelIssue): Promise<InnerTransactResult> {
    return this.submitAsCoop(data.coopname, MarketContract.contractName.production, MarketContract.Actions.CancelIssue.actionName, data, 'cancelissue');
  }

  async convert(data: MarketContract.Actions.Convert.IConvert): Promise<InnerTransactResult> {
    return this.submitAsCoop(data.coopname, MarketContract.contractName.production, MarketContract.Actions.Convert.actionName, data, 'convert');
  }

  async checkout(input: MarketplaceCheckoutChainInput): Promise<InnerTransactResult> {
    const wif = await this.vaultDomainService.getWif(input.coopname);
    if (!wif) {
      throw new DomainError('MARKETPLACE_PRIVATE_KEY_NOT_FOUND_CART_CHECKOUT', {}, httpStatus.BAD_GATEWAY);
    }
    const asCoop = (name: string, data: Record<string, any>): InnerChainAction => ({
      account: MarketContract.contractName.production,
      name,
      authorization: [{ actor: input.coopname, permission: 'active' }],
      data,
    });
    // Порядок действий в транзакции сохраняется: перевод первым, поэтому
    // членского кошелька хватает уже первому заказу, а операция перевода
    // остаётся первой в нитке того заказа, который оплачивает.
    const actions: InnerChainAction[] = [];
    if (input.convert) {
      actions.push(asCoop(MarketContract.Actions.Convert.actionName, input.convert));
    }
    for (const order of input.orders) {
      actions.push(
        asCoop(
          order.kind === MarketplaceCheckoutOrderActionKind.STOCK_ORDER
            ? MarketContract.Actions.StockOrder.actionName
            : MarketContract.Actions.CreateOrder.actionName,
          order.data
        )
      );
    }
    if (actions.length === 0) {
      throw DomainError.badRequest('MARKETPLACE_CART_CHECKOUT_NO_ACTIONS');
    }
    this.blockchainService.initialize(input.coopname, wif);
    return await this.blockchainService.transact(actions);
  }

  async handBack(data: MarketContract.Actions.HandBack.IHandBack): Promise<InnerTransactResult> {
    return this.submitAsCoop(data.coopname, MarketContract.contractName.production, MarketContract.Actions.HandBack.actionName, data, 'handback');
  }

  async chargeDue(data: MarketContract.Actions.ChargeDue.IChargeDue): Promise<InnerTransactResult> {
    return this.submitAsCoop(data.coopname, MarketContract.contractName.production, MarketContract.Actions.ChargeDue.actionName, data, 'chargedue');
  }

  // ── Коэффициент экономического участия (задача 99D-22) ──

  async closePeriod(data: MarketContract.Actions.ClosePeriod.IClosePeriod): Promise<InnerTransactResult> {
    return this.submitAsCoop(data.coopname, MarketContract.contractName.production, MarketContract.Actions.ClosePeriod.actionName, data, 'closeperiod');
  }

  async deletePeriod(data: MarketContract.Actions.DelPeriod.IDelPeriod): Promise<InnerTransactResult> {
    return this.submitAsCoop(data.coopname, MarketContract.contractName.production, MarketContract.Actions.DelPeriod.actionName, data, 'delperiod');
  }

  async chargePeriod(data: MarketContract.Actions.ChargePeriod.IChargePeriod): Promise<InnerTransactResult> {
    return this.submitAsCoop(data.coopname, MarketContract.contractName.production, MarketContract.Actions.ChargePeriod.actionName, data, 'chargeperiod');
  }

  async setShares(data: MarketContract.Actions.SetShares.ISetShares): Promise<InnerTransactResult> {
    return this.submitAsCoop(data.coopname, MarketContract.contractName.production, MarketContract.Actions.SetShares.actionName, data, 'setshares');
  }

  async setInitiator(data: MarketContract.Actions.SetInitiator.ISetInitiator): Promise<InnerTransactResult> {
    return this.submitAsCoop(data.coopname, MarketContract.contractName.production, MarketContract.Actions.SetInitiator.actionName, data, 'setinitiator');
  }

  async setAidLimit(data: BranchContract.Actions.SetAidLimit.ISetaidlimit): Promise<InnerTransactResult> {
    return this.submitAsCoop(data.coopname, BranchContract.contractName.production, BranchContract.Actions.SetAidLimit.actionName, data, 'setaidlimit');
  }

  async setAidPeriod(data: BranchContract.Actions.SetAidPeriod.ISetaidperiod): Promise<InnerTransactResult> {
    return this.submitAsCoop(data.coopname, BranchContract.contractName.production, BranchContract.Actions.SetAidPeriod.actionName, data, 'setaidperiod');
  }

  async setReserve(data: BranchContract.Actions.SetReserve.ISetreserve): Promise<InnerTransactResult> {
    return this.submitAsCoop(data.coopname, BranchContract.contractName.production, BranchContract.Actions.SetReserve.actionName, data, 'setreserve');
  }

  async deleteReserve(data: BranchContract.Actions.DelReserve.IDelreserve): Promise<InnerTransactResult> {
    return this.submitAsCoop(data.coopname, BranchContract.contractName.production, BranchContract.Actions.DelReserve.actionName, data, 'delreserve');
  }

  async admitClaim(data: MarketContract.Actions.AdmitClaim.IAdmitClaim): Promise<InnerTransactResult> {
    return this.submitAsCoop(data.coopname, MarketContract.contractName.production, MarketContract.Actions.AdmitClaim.actionName, data, 'admitclaim');
  }


  async findCouncilDecisionByHash(coopname: string, hash: string): Promise<SovietContract.Tables.Decisions.IDecision | null> {
    // Индекс `byhash` таблицы решений — седьмой по порядку объявления в контракте.
    return this.blockchainService.getSingleRow<SovietContract.Tables.Decisions.IDecision>(
      SovietContract.contractName.production,
      coopname,
      SovietContract.Tables.Decisions.tableName,
      hash.toLowerCase(),
      'seventh',
      'sha256'
    );
  }

  async setFee(data: MarketContract.Actions.SetFee.ISetFee): Promise<InnerTransactResult> {
    return this.submitAsCoop(
      data.coopname,
      MarketContract.contractName.production,
      MarketContract.Actions.SetFee.actionName,
      data,
      'setfee'
    );
  }

  async distribute(data: BranchContract.Actions.Distribute.IDistribute): Promise<InnerTransactResult> {
    return this.submitAsCoop(
      data.coopname,
      BranchContract.contractName.production,
      BranchContract.Actions.Distribute.actionName,
      data,
      'distribute'
    );
  }

  async setWeight(data: BranchContract.Actions.SetWeight.ISetweight): Promise<InnerTransactResult> {
    return this.submitAsCoop(
      data.coopname,
      BranchContract.contractName.production,
      BranchContract.Actions.SetWeight.actionName,
      data,
      'setweight'
    );
  }

  async delWeight(data: BranchContract.Actions.DelWeight.IDelweight): Promise<InnerTransactResult> {
    return this.submitAsCoop(
      data.coopname,
      BranchContract.contractName.production,
      BranchContract.Actions.DelWeight.actionName,
      data,
      'delweight'
    );
  }


  async createAid(data: BranchContract.Actions.CreateAid.ICreateaid): Promise<InnerTransactResult> {
    return this.submitAsCoop(
      data.coopname,
      BranchContract.contractName.production,
      BranchContract.Actions.CreateAid.actionName,
      data,
      'createaid'
    );
  }

  async createBranchExpense(
    data: BranchContract.Actions.CreateExp.ICreateexp
  ): Promise<InnerTransactResult> {
    return this.submitAsCoop(
      data.coopname,
      BranchContract.contractName.production,
      BranchContract.Actions.CreateExp.actionName,
      data,
      'createexp'
    );
  }

  // ── Чтение on-chain состояния экономики КУ ───────────────────────────

  async getEconomyConfig(coopname: string): Promise<MarketContract.Tables.Config.IMktConfig | null> {
    const rows = await this.blockchainService.getAllRows(
      MarketContract.contractName.production,
      coopname,
      MarketContract.Tables.Config.tableName
    );
    return (rows[0] as MarketContract.Tables.Config.IMktConfig | undefined) ?? null;
  }

  async getBranchWeights(coopname: string, braname: string): Promise<BranchContract.Tables.Weights.IBranchWeight[]> {
    // Индексы таблицы весов: второй — контракт и участок, третий — участок.
    return this.rowsByName(BranchContract.contractName.production, coopname, BranchContract.Tables.Weights.tableName, 'tertiary', braname);
  }

  async getBranchWeightTotals(coopname: string, braname: string): Promise<BranchContract.Tables.WeightTotals.IBranchWeightTotal[]> {
    return this.rowsByName(BranchContract.contractName.production, coopname, BranchContract.Tables.WeightTotals.tableName, 'tertiary', braname);
  }

  async getAidMonth(coopname: string, username: string): Promise<BranchContract.Tables.AidMonths.IBranchAidmonth | null> {
    return this.blockchainService.getSingleRow<BranchContract.Tables.AidMonths.IBranchAidmonth>(
      BranchContract.contractName.production, coopname, BranchContract.Tables.AidMonths.tableName, username, 'primary', 'name'
    );
  }

  async listAids(coopname: string, username?: string): Promise<BranchContract.Tables.Aids.IBranchAid[]> {
    // Заявления одного получателя — по третьему индексу (получатель).
    if (username) {
      return this.rowsByName(BranchContract.contractName.production, coopname, BranchContract.Tables.Aids.tableName, 'tertiary', username);
    }
    // Стол администратора читает все заявления в работе: строка живёт от подачи
    // до выплаты либо отказа, после чего контракт её стирает.
    return this.blockchainService.getAllRows(
      BranchContract.contractName.production,
      coopname,
      BranchContract.Tables.Aids.tableName
    );
  }

  async listBranchPeriods(coopname: string, braname: string): Promise<MarketContract.Tables.Periods.IKuPeriod[]> {
    return this.rowsByName(MarketContract.contractName.production, coopname, MarketContract.Tables.Periods.tableName, 'secondary', braname);
  }

  async getInitiator(coopname: string, braname: string): Promise<MarketContract.Tables.Initiators.IMktInitiator | null> {
    // Первичный ключ строки инициатора — имя участка.
    return this.blockchainService.getSingleRow<MarketContract.Tables.Initiators.IMktInitiator>(
      MarketContract.contractName.production,
      coopname,
      MarketContract.Tables.Initiators.tableName,
      braname,
      'primary',
      'name'
    );
  }

  async listBranchReserves(coopname: string, braname: string): Promise<BranchContract.Tables.Reserves.IBranchReserve[]> {
    return this.rowsByName(BranchContract.contractName.production, coopname, BranchContract.Tables.Reserves.tableName, 'secondary', braname);
  }

  async getBranchConfig(coopname: string): Promise<BranchContract.Tables.BranchConfig.IBranchConfig | null> {
    const rows = await this.blockchainService.getAllRows(
      BranchContract.contractName.production,
      coopname,
      BranchContract.Tables.BranchConfig.tableName
    );
    return (rows[0] as BranchContract.Tables.BranchConfig.IBranchConfig | undefined) ?? null;
  }

  async listAccumulationFunds(coopname: string): Promise<FundContract.Tables.Funds.IFund[]> {
    // Реестр фондов `funds` (задача 99D-25): пять строк настроек, остатки — в
    // ledger2 по кошельку фонда. Отдаём только фонды накопления: у них процент.
    const rows: FundContract.Tables.Funds.IFund[] = await this.blockchainService.getAllRows(
      FundContract.contractName.production,
      coopname,
      FundContract.Tables.Funds.tableName
    );
    return rows.filter((row) => row.kind === FundContract.Tables.Funds.KIND_ACCUMULATION);
  }

  async getUserWallet(coopname: string, walletName: string, username: string): Promise<Ledger2Contract.Tables.UserWallets.IUserWallet | null> {
    // Третий индекс таблицы кошельков — владелец: узел отдаёт только кошельки
    // этого пайщика (их число ограничено числом видов кошельков), нужный берётся
    // по имени. Чтение не зависит от числа пайщиков кооператива.
    const wallets = await this.rowsByName<Ledger2Contract.Tables.UserWallets.IUserWallet>(
      Ledger2Contract.contractName.production,
      coopname,
      Ledger2Contract.Tables.UserWallets.tableName,
      'tertiary',
      username
    );
    return wallets.find((w) => String(w.wallet_name) === walletName) ?? null;
  }

  // ── Инвестиционный этап кооперативного участка (задача 99D-30) ──
  async signInvestAgreement(data: MarketContract.Actions.SignInvAgr.ISignInvAgr): Promise<InnerTransactResult> {
    return this.submitAsCoop(data.coopname, MarketContract.contractName.production, MarketContract.Actions.SignInvAgr.actionName, data, 'signinvagr');
  }

  async investMoney(data: MarketContract.Actions.InvestMoney.IInvestMoney): Promise<InnerTransactResult> {
    return this.submitAsCoop(data.coopname, MarketContract.contractName.production, MarketContract.Actions.InvestMoney.actionName, data, 'investmoney');
  }

  async createInvestProperty(data: MarketContract.Actions.CreateIProp.ICreateIProp): Promise<InnerTransactResult> {
    return this.submitAsCoop(data.coopname, MarketContract.contractName.production, MarketContract.Actions.CreateIProp.actionName, data, 'createiprop');
  }

  async approveInvestProperty(data: MarketContract.Actions.ApproveIProp.IApproveIProp): Promise<InnerTransactResult> {
    return this.submitAsCoop(data.coopname, MarketContract.contractName.production, MarketContract.Actions.ApproveIProp.actionName, data, 'approveiprop');
  }

  async declineInvestProperty(data: MarketContract.Actions.DeclineIProp.IDeclineIProp): Promise<InnerTransactResult> {
    return this.submitAsCoop(data.coopname, MarketContract.contractName.production, MarketContract.Actions.DeclineIProp.actionName, data, 'declineiprop');
  }

  async signInvestPropertyAct1(data: MarketContract.Actions.Act1IProp.IAct1IProp): Promise<InnerTransactResult> {
    return this.submitAsCoop(data.coopname, MarketContract.contractName.production, MarketContract.Actions.Act1IProp.actionName, data, 'act1iprop');
  }


  async claimInvestment(data: MarketContract.Actions.ClaimInv.IClaimInv): Promise<InnerTransactResult> {
    return this.submitAsCoop(data.coopname, MarketContract.contractName.production, MarketContract.Actions.ClaimInv.actionName, data, 'claiminv');
  }

  async getInvestAgreement(coopname: string, username: string): Promise<MarketContract.Tables.InvAgreements.IMktInvAgreement | null> {
    return this.blockchainService.getSingleRow<MarketContract.Tables.InvAgreements.IMktInvAgreement>(
      MarketContract.contractName.production, coopname, MarketContract.Tables.InvAgreements.tableName, username, 'primary', 'name'
    );
  }

  async getInvestBranch(coopname: string, braname: string): Promise<MarketContract.Tables.InvBranches.IMktInvBranch | null> {
    return this.blockchainService.getSingleRow<MarketContract.Tables.InvBranches.IMktInvBranch>(
      MarketContract.contractName.production, coopname, MarketContract.Tables.InvBranches.tableName, braname, 'primary', 'name'
    );
  }

  async listBranchInvestors(coopname: string, braname: string): Promise<MarketContract.Tables.Investors.IMktInvestor[]> {
    // Индексы `investors`: bybranch — второй, byuser — третий (lib/domain/table_marketplace_invest.hpp).
    return this.rowsByName(MarketContract.contractName.production, coopname, MarketContract.Tables.Investors.tableName, 'secondary', braname);
  }

  async listUserInvestments(coopname: string, username: string): Promise<MarketContract.Tables.Investors.IMktInvestor[]> {
    return this.rowsByName(MarketContract.contractName.production, coopname, MarketContract.Tables.Investors.tableName, 'tertiary', username);
  }

  async listBranchInvestProperties(coopname: string, braname: string): Promise<MarketContract.Tables.InvProps.IMktInvProp[]> {
    // Индексы `invprops`: byhash — второй, bybranch — третий, byuser — четвёртый.
    return this.rowsByName(MarketContract.contractName.production, coopname, MarketContract.Tables.InvProps.tableName, 'tertiary', braname);
  }

  async getInvestProperty(coopname: string, hash: string): Promise<MarketContract.Tables.InvProps.IMktInvProp | null> {
    return this.blockchainService.getSingleRow<MarketContract.Tables.InvProps.IMktInvProp>(
      MarketContract.contractName.production, coopname, MarketContract.Tables.InvProps.tableName, hash.toLowerCase(), 'secondary', 'sha256'
    );
  }

  /**
   * Строки таблицы, у которых ключ индекса равен имени (участок, пайщик):
   * узел отдаёт только их, размер таблицы на чтение не влияет.
   */
  private rowsByName<T>(code: string, coopname: string, tableName: string, indexPosition: string, name: string): Promise<T[]> {
    return this.blockchainService.queryRows<T>(code, coopname, tableName, { indexPosition, keyType: 'name', from: name, to: name });
  }

}
