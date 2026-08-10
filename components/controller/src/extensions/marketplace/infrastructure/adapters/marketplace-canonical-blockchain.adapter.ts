import { Inject, Injectable } from '@nestjs/common';
import { BranchContract, Ledger2Contract, MarketContract } from 'cooptypes';
import type { TransactResult } from '@wharfkit/session';
import { BlockchainService } from '~/infrastructure/blockchain/blockchain.service';
import httpStatus from 'http-status';
import type { MarketplaceCanonicalBlockchainPort } from '../../domain/ports/marketplace-canonical-blockchain.port';
import { HttpApiError } from '@coopenomics/extension-kit';
import { VAULT_PORT, type IVaultPort } from '@coopenomics/innercoop';

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
    private readonly blockchainService: BlockchainService,
    @Inject(VAULT_PORT)
    private readonly vaultDomainService: IVaultPort
  ) {}

  async createOrder(data: MarketContract.Actions.CreateOrder.ICreateOrder): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) {
      throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ кооператива для submit createorder');
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

  async stockOrder(data: MarketContract.Actions.StockOrder.IStockOrder): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) {
      throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ кооператива для submit stockorder');
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

  async convert(data: MarketContract.Actions.Convert.IConvert): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) {
      throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ кооператива для submit convert');
    }

    this.blockchainService.initialize(data.coopname, wif);

    return await this.blockchainService.transact({
      account: MarketContract.contractName.production,
      name: MarketContract.Actions.Convert.actionName,
      authorization: [
        {
          actor: data.coopname,
          permission: 'active',
        },
      ],
      data,
    });
  }

  async markdown(data: MarketContract.Actions.Markdown.IMarkdown): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) {
      throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ кооператива для submit markdown');
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

  async expireOrder(data: MarketContract.Actions.ExpireOrder.IExpireOrder): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) {
      throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ кооператива для submit expireorder');
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

  async closeOrder(data: MarketContract.Actions.CloseOrder.ICloseOrder): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) {
      throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ кооператива для submit closeorder');
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

  async cancelOrder(data: MarketContract.Actions.CancelOrder.ICancelOrder): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) {
      throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ кооператива для submit cancelorder');
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

  async acceptOrder(data: MarketContract.Actions.AcceptOrder.IAcceptOrder): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) {
      throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ кооператива для submit acceptorder');
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

  async declineOrder(data: MarketContract.Actions.DeclineOrder.IDeclineOrder): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) {
      throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ кооператива для submit declineorder');
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

  async signSupp(data: MarketContract.Actions.SignSupp.ISignSupp): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) {
      throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ кооператива для submit signsupp');
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

  async signChair(data: MarketContract.Actions.SignChair.ISignChair): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) {
      throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ кооператива для submit signchair');
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

  async payOut(data: MarketContract.Actions.PayOut.IPayout): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) {
      throw new HttpApiError(
        httpStatus.BAD_GATEWAY,
        'Не найден приватный ключ кооператива для submit payout'
      );
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

  async signIss1(data: MarketContract.Actions.SignIss1.ISignIss1): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) {
      throw new HttpApiError(
        httpStatus.BAD_GATEWAY,
        'Не найден приватный ключ кооператива для submit signiss1'
      );
    }

    this.blockchainService.initialize(data.coopname, wif);

    return await this.blockchainService.transact({
      account: MarketContract.contractName.production,
      name: MarketContract.Actions.SignIss1.actionName,
      authorization: [
        {
          actor: data.coopname,
          permission: 'active',
        },
      ],
      data,
    });
  }

  async signIss2(data: MarketContract.Actions.SignIss2.ISignIss2): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) {
      throw new HttpApiError(
        httpStatus.BAD_GATEWAY,
        'Не найден приватный ключ кооператива для submit signiss2'
      );
    }

    this.blockchainService.initialize(data.coopname, wif);

    return await this.blockchainService.transact({
      account: MarketContract.contractName.production,
      name: MarketContract.Actions.SignIss2.actionName,
      authorization: [
        {
          actor: data.coopname,
          permission: 'active',
        },
      ],
      data,
    });
  }

  async submRetrn(data: MarketContract.Actions.SubmRetrn.ISubmRetrn): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) {
      throw new HttpApiError(
        httpStatus.BAD_GATEWAY,
        'Не найден приватный ключ кооператива для submit submretrn'
      );
    }
    this.blockchainService.initialize(data.coopname, wif);
    return await this.blockchainService.transact({
      account: MarketContract.contractName.production,
      name: MarketContract.Actions.SubmRetrn.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    });
  }

  async aprRetRem(data: MarketContract.Actions.AprRetRem.IAprRetRem): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) {
      throw new HttpApiError(
        httpStatus.BAD_GATEWAY,
        'Не найден приватный ключ кооператива для submit aprretrem'
      );
    }
    this.blockchainService.initialize(data.coopname, wif);
    return await this.blockchainService.transact({
      account: MarketContract.contractName.production,
      name: MarketContract.Actions.AprRetRem.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    });
  }

  async rejRetRem(data: MarketContract.Actions.RejRetRem.IRejRetRem): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) {
      throw new HttpApiError(
        httpStatus.BAD_GATEWAY,
        'Не найден приватный ключ кооператива для submit rejretrem'
      );
    }
    this.blockchainService.initialize(data.coopname, wif);
    return await this.blockchainService.transact({
      account: MarketContract.contractName.production,
      name: MarketContract.Actions.RejRetRem.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    });
  }

  async accRetrn(data: MarketContract.Actions.AccRetrn.IAccRetrn): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) {
      throw new HttpApiError(
        httpStatus.BAD_GATEWAY,
        'Не найден приватный ключ кооператива для submit accretrn'
      );
    }
    this.blockchainService.initialize(data.coopname, wif);
    return await this.blockchainService.transact({
      account: MarketContract.contractName.production,
      name: MarketContract.Actions.AccRetrn.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    });
  }

  async rejRetrn(data: MarketContract.Actions.RejRetrn.IRejRetrn): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) {
      throw new HttpApiError(
        httpStatus.BAD_GATEWAY,
        'Не найден приватный ключ кооператива для submit rejretrn'
      );
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

  async propWroff(data: MarketContract.Actions.PropWroff.IPropWroff): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) {
      throw new HttpApiError(
        httpStatus.BAD_GATEWAY,
        'Не найден приватный ключ кооператива для submit propwroff'
      );
    }
    this.blockchainService.initialize(data.coopname, wif);
    return await this.blockchainService.transact({
      account: MarketContract.contractName.production,
      name: MarketContract.Actions.PropWroff.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    });
  }

  async execWroff(data: MarketContract.Actions.ExecWroff.IExecWroff): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) {
      throw new HttpApiError(
        httpStatus.BAD_GATEWAY,
        'Не найден приватный ключ кооператива для submit execwroff'
      );
    }
    this.blockchainService.initialize(data.coopname, wif);
    return await this.blockchainService.transact({
      account: MarketContract.contractName.production,
      name: MarketContract.Actions.ExecWroff.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    });
  }

  async confirmWroff(data: MarketContract.Actions.ConfirmWroff.IConfirmWroff): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) {
      throw new HttpApiError(
        httpStatus.BAD_GATEWAY,
        'Не найден приватный ключ кооператива для submit confirmwroff'
      );
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
    data: unknown,
    actionLabel: string
  ): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(coopname);
    if (!wif) {
      throw new HttpApiError(
        httpStatus.BAD_GATEWAY,
        `Не найден приватный ключ кооператива для submit ${actionLabel}`
      );
    }
    this.blockchainService.initialize(coopname, wif);
    return await this.blockchainService.transact({
      account,
      name,
      authorization: [{ actor: coopname, permission: 'active' }],
      data,
    });
  }

  async setFee(data: MarketContract.Actions.SetFee.ISetFee): Promise<TransactResult> {
    return this.submitAsCoop(
      data.coopname,
      MarketContract.contractName.production,
      MarketContract.Actions.SetFee.actionName,
      data,
      'setfee'
    );
  }

  async distribute(data: BranchContract.Actions.Distribute.IDistribute): Promise<TransactResult> {
    return this.submitAsCoop(
      data.coopname,
      BranchContract.contractName.production,
      BranchContract.Actions.Distribute.actionName,
      data,
      'distribute'
    );
  }

  async setWeight(data: BranchContract.Actions.SetWeight.ISetweight): Promise<TransactResult> {
    return this.submitAsCoop(
      data.coopname,
      BranchContract.contractName.production,
      BranchContract.Actions.SetWeight.actionName,
      data,
      'setweight'
    );
  }

  async delWeight(data: BranchContract.Actions.DelWeight.IDelweight): Promise<TransactResult> {
    return this.submitAsCoop(
      data.coopname,
      BranchContract.contractName.production,
      BranchContract.Actions.DelWeight.actionName,
      data,
      'delweight'
    );
  }

  async convertBranchFunds(data: BranchContract.Actions.Convert.IConvert): Promise<TransactResult> {
    return this.submitAsCoop(
      data.coopname,
      BranchContract.contractName.production,
      BranchContract.Actions.Convert.actionName,
      data,
      'convert'
    );
  }

  async createAid(data: BranchContract.Actions.CreateAid.ICreateaid): Promise<TransactResult> {
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
  ): Promise<TransactResult> {
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

  async getBranchWeights(coopname: string): Promise<BranchContract.Tables.Weights.IBranchWeight[]> {
    return this.blockchainService.getAllRows(
      BranchContract.contractName.production,
      coopname,
      BranchContract.Tables.Weights.tableName
    );
  }

  async getBranchWeightTotals(coopname: string): Promise<BranchContract.Tables.WeightTotals.IBranchWeightTotal[]> {
    return this.blockchainService.getAllRows(
      BranchContract.contractName.production,
      coopname,
      BranchContract.Tables.WeightTotals.tableName
    );
  }

  async listAids(coopname: string): Promise<BranchContract.Tables.Aids.IBranchAid[]> {
    return this.blockchainService.getAllRows(
      BranchContract.contractName.production,
      coopname,
      BranchContract.Tables.Aids.tableName
    );
  }

  async listBranchWalletBalances(coopname: string): Promise<Ledger2Contract.Tables.UserWallets.IUserWallet[]> {
    // Полный скан userwallets кооператива с фильтром по кошелькам экономики КУ.
    // Объём = пайщики × кошельки — приемлем для MVP; при росте перевести на
    // запрос по secondary-индексу byuserwallet (i128).
    const rows: Ledger2Contract.Tables.UserWallets.IUserWallet[] =
      await this.blockchainService.getAllRows(
        Ledger2Contract.contractName.production,
        coopname,
        Ledger2Contract.Tables.UserWallets.tableName
      );
    return rows.filter(
      (r) => r.wallet_name === 'w.brn.person' || r.wallet_name === 'w.brn.common'
    );
  }

}
