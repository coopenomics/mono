import { Injectable } from '@nestjs/common';
import { BlockchainService } from '../blockchain.service';
import { SovietContract } from 'cooptypes';
import { TransactResult, UInt64 } from '@wharfkit/session';
import { VaultDomainService, VAULT_DOMAIN_SERVICE } from '~/domain/vault/services/vault-domain.service';
import { Inject } from '@nestjs/common';
import httpStatus from 'http-status';
import { HttpApiError } from '~/utils/httpApiError';
import type {
  EnsureProgramParams,
  EnsureProgramResult,
  SovietBlockchainPort,
} from '~/domain/common/ports/soviet-blockchain.port';
import { config } from '~/config';
import { waitAfterTransactBeforeChainTableRead } from '~/shared/utils/post-transact-chain-read-delay';

@Injectable()
export class SovietBlockchainAdapter implements SovietBlockchainPort {
  constructor(
    private readonly blockchainService: BlockchainService,
    @Inject(VAULT_DOMAIN_SERVICE) private readonly vaultDomainService: VaultDomainService
  ) {}

  async getDecisions(coopname: string): Promise<SovietContract.Tables.Decisions.IDecision[]> {
    return this.blockchainService.getAllRows(
      SovietContract.contractName.production,
      coopname,
      SovietContract.Tables.Decisions.tableName
    );
  }

  async getDecision(coopname: string, decision_id: string): Promise<SovietContract.Tables.Decisions.IDecision | null> {
    return this.blockchainService.getSingleRow(
      SovietContract.contractName.production,
      coopname,
      SovietContract.Tables.Decisions.tableName,
      UInt64.from(decision_id)
    );
  }

  async getBoards(coopname: string): Promise<SovietContract.Tables.Boards.IBoards[]> {
    // Per-coop советов единицы строк; full scan адекватен.
    return await this.blockchainService.getAllRows<SovietContract.Tables.Boards.IBoards>(
      SovietContract.contractName.production,
      coopname,
      SovietContract.Tables.Boards.tableName
    );
  }

  async getCoagreement(
    coopname: string,
    agreement_type: string
  ): Promise<SovietContract.Tables.CoopAgreements.ICoopAgreement | null> {
    const rows = await this.getCoagreements(coopname);
    return rows.find((r) => r.type === agreement_type) ?? null;
  }

  async getCoagreements(coopname: string): Promise<SovietContract.Tables.CoopAgreements.ICoopAgreement[]> {
    // Per-coop coagreements ~6-7 rows; full scan дешевле, чем uint64-конверсия из name на стороне JS.
    return await this.blockchainService.getAllRows<SovietContract.Tables.CoopAgreements.ICoopAgreement>(
      SovietContract.contractName.production,
      coopname,
      SovietContract.Tables.CoopAgreements.tableName
    );
  }

  async getPrograms(coopname: string): Promise<SovietContract.Tables.Programs.IProgram[]> {
    // Per-coop programs ~единицы строк; full scan адекватен.
    return await this.blockchainService.getAllRows<SovietContract.Tables.Programs.IProgram>(
      SovietContract.contractName.production,
      coopname,
      SovietContract.Tables.Programs.tableName
    );
  }

  async ensureProgram(params: EnsureProgramParams): Promise<EnsureProgramResult> {
    const { coopname, type } = params;

    // Ищем по coagreements: это индекс «тип программы → program_id», который
    // `createprog` заполняет той же транзакцией, что и `programs`. Отсутствие
    // записи означает, что программа в кооперативе не открыта.
    const coagreement = await this.getCoagreement(coopname, type);
    const existingProgramId = coagreement ? Number(coagreement.program_id) : 0;
    if (existingProgramId > 0) {
      return { created: false, program_id: existingProgramId };
    }

    const wif = await this.vaultDomainService.getWif(coopname);
    if (!wif) throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ для совершения операции');

    this.blockchainService.initialize(coopname, wif);

    // `username` = сам кооператив: `check_auth_or_fail` пропускает
    // `has_auth(coopname)` без председателя, и RAM за строку `soviet::programs`
    // (payer = username) платит кооператив, а не человек.
    //
    // `calculation_type: 'free'` с нулевыми взносами — единственная рабочая
    // комбинация: контракт требует нули и для процента, и для фиксированного
    // взноса. Членские взносы программ (`addmemberfee`/`progwallets`) —
    // мёртвая ветка, её не вызывает ни один контракт, поэтому расчётных
    // параметров у ЦПП сейчас нет.
    const data: SovietContract.Actions.Programs.CreateProgram.ICreateProgram = {
      coopname,
      username: coopname,
      type,
      title: params.title,
      announce: '',
      description: '',
      preview: '',
      images: '',
      calculation_type: 'free',
      fixed_membership_contribution: `${Number(0).toFixed(config.blockchain.root_govern_precision)} ${
        config.blockchain.root_govern_symbol
      }`,
      membership_percent_fee: 0,
      is_can_coop_spend_share_contributions: params.is_can_coop_spend_share_contributions ?? true,
      meta: '',
    };

    await this.blockchainService.transact({
      account: SovietContract.contractName.production,
      name: SovietContract.Actions.Programs.CreateProgram.actionName,
      authorization: [{ actor: coopname, permission: 'active' }],
      data,
    });

    // program_id и шаблон оферты назначает сам контракт по своему реестру ЦПП —
    // перечитываем. Пауза обязательна: на узле-последователе строка появляется
    // в chain state позже ответа RPC.
    await waitAfterTransactBeforeChainTableRead();
    const created = await this.getCoagreement(coopname, type);
    return { created: true, program_id: created ? Number(created.program_id) : 0 };
  }

  async publishProjectOfFreeDecision(
    data: SovietContract.Actions.Decisions.CreateFreeDecision.ICreateFreeDecision
  ): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ для совершения операции');

    this.blockchainService.initialize(data.coopname, wif);

    return await this.blockchainService.transact({
      account: SovietContract.contractName.production,
      name: SovietContract.Actions.Decisions.CreateFreeDecision.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    });
  }

  async cancelExpiredDecision(data: SovietContract.Actions.Decisions.Cancelexprd.ICancelExpired): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ для совершения операции');

    this.blockchainService.initialize(data.coopname, wif);

    return await this.blockchainService.transact({
      account: SovietContract.contractName.production,
      name: SovietContract.Actions.Decisions.Cancelexprd.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    });
  }

  async declineDecision(data: SovietContract.Actions.Decisions.Declinedec.IDeclineDecision): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ для совершения операции');

    this.blockchainService.initialize(data.coopname, wif);

    return await this.blockchainService.transact({
      account: SovietContract.contractName.production,
      name: SovietContract.Actions.Decisions.Declinedec.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    });
  }

  async sendAgreement(data: SovietContract.Actions.Agreements.SendAgreement.ISendAgreement): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ для совершения операции');

    this.blockchainService.initialize(data.coopname, wif);

    return await this.blockchainService.transact({
      account: SovietContract.contractName.production,
      name: SovietContract.Actions.Agreements.SendAgreement.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    });
  }

  async confirmAgreement(
    data: SovietContract.Actions.Agreements.ConfirmAgreement.IConfirmAgreement
  ): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ для совершения операции');

    this.blockchainService.initialize(data.coopname, wif);

    return await this.blockchainService.transact({
      account: SovietContract.contractName.production,
      name: SovietContract.Actions.Agreements.ConfirmAgreement.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    });
  }

  async declineAgreement(
    data: SovietContract.Actions.Agreements.DeclineAgreement.IDeclineAgreement
  ): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ для совершения операции');

    this.blockchainService.initialize(data.coopname, wif);

    return await this.blockchainService.transact({
      account: SovietContract.contractName.production,
      name: SovietContract.Actions.Agreements.DeclineAgreement.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    });
  }

  async authorizeDecision(
    authorizeData: SovietContract.Actions.Decisions.Authorize.IAuthorize,
    execData: SovietContract.Actions.Decisions.Exec.IExec
  ): Promise<TransactResult> {
    // Утверждение + исполнение проводятся через бэкенд ключом кооператива
    // (soviet::authorize/exec — require_auth(coopname)). Согласие председателя
    // криптографически закреплено в подписанном им документе authorizeData.document.
    const wif = await this.vaultDomainService.getWif(authorizeData.coopname);
    if (!wif) throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ для совершения операции');

    this.blockchainService.initialize(authorizeData.coopname, wif);

    return await this.blockchainService.transact([
      {
        account: SovietContract.contractName.production,
        name: SovietContract.Actions.Decisions.Authorize.actionName,
        authorization: [{ actor: authorizeData.coopname, permission: 'active' }],
        data: authorizeData,
      },
      {
        account: SovietContract.contractName.production,
        name: SovietContract.Actions.Decisions.Exec.actionName,
        authorization: [{ actor: execData.coopname, permission: 'active' }],
        data: execData,
      },
    ]);
  }
}
