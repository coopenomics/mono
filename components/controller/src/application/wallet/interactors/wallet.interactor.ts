import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cooperative, Ledger2 } from 'cooptypes';
import { GeneratorInfrastructureService } from '~/infrastructure/generator/generator.service';
import { DocumentDomainEntity } from '~/domain/document/entity/document-domain.entity';
import { WalletBlockchainPort, WALLET_BLOCKCHAIN_PORT } from '~/domain/wallet/ports/wallet-blockchain.port';
import { BLOCKCHAIN_PORT, BlockchainPort } from '~/domain/common/ports/blockchain.port';
import {
  UserWalletRepository,
  USER_WALLET_REPOSITORY,
} from '~/domain/wallet/repositories/user-wallet.repository';
import {
  UserAgreementRepository,
  USER_AGREEMENT_REPOSITORY,
} from '~/domain/wallet/repositories/user-agreement.repository';
import type { UserWalletDomainEntity } from '~/domain/wallet/entities/user-wallet-domain.entity';
import type { UserAgreementDomainEntity } from '~/domain/wallet/entities/user-agreement-domain.entity';
import { ProgramWalletDomainEntity } from '~/domain/wallet/entities/program-wallet-domain.entity';
import type { CreateWithdrawInputDomainInterface } from '~/domain/wallet/interfaces/create-withdraw-input-domain.interface';
import { GATEWAY_INTERACTOR_PORT, GatewayInteractorPort } from '~/domain/wallet/ports/gateway-interactor.port';
import type { CreateDepositPaymentInputDomainInterface } from '~/domain/gateway/interfaces/create-deposit-payment-input-domain.interface';
import { PaymentDomainEntity } from '~/domain/gateway/entities/payment-domain.entity';
import { PaymentStatusEnum } from '~/domain/gateway/enums/payment-status.enum';
import type { ProgramWalletFilterInputDTO } from '../dto/program-wallet-filter-input.dto';
import { PaginationResult, PaginationInputDTO } from '~/application/common/dto/pagination.dto';
import { getProgramId, getProgramType } from '~/domain/wallet/enums/program-type.enum';
import { config } from '~/config';

/**
 * Интерактор приложения wallet для управления паевыми взносами, их возвратами, генерацией документов и работой с программными кошельками
 */
@Injectable()
export class WalletInteractor {
  private readonly logger = new Logger(WalletInteractor.name);

  constructor(
    private readonly generatorInfrastructureService: GeneratorInfrastructureService,
    @Inject(WALLET_BLOCKCHAIN_PORT)
    private readonly walletBlockchainPort: WalletBlockchainPort,
    @Inject(BLOCKCHAIN_PORT)
    private readonly blockchainPort: BlockchainPort,
    @Inject(USER_WALLET_REPOSITORY)
    private readonly userWalletRepository: UserWalletRepository,
    @Inject(USER_AGREEMENT_REPOSITORY)
    private readonly userAgreementRepository: UserAgreementRepository,
    @Inject(GATEWAY_INTERACTOR_PORT)
    private readonly gatewayInteractorPort: GatewayInteractorPort
  ) {}

  /**
   * Создать депозитный платеж
   */
  async createDepositPayment(data: CreateDepositPaymentInputDomainInterface): Promise<PaymentDomainEntity> {
    return await this.gatewayInteractorPort.createDeposit(data);
  }

  /**
   * Генерация документа заявления на возврат паевого взноса (900)
   */
  async generateReturnByMoneyStatementDocument(
    data: Cooperative.Registry.ReturnByMoney.Action,
    options: Cooperative.Document.IGenerationOptions
  ): Promise<DocumentDomainEntity> {
    // Устанавливаем registry_id для документа заявления
    data.registry_id = Cooperative.Registry.ReturnByMoney.registry_id;
    return await this.generatorInfrastructureService.generateDocument({ data, options });
  }

  /**
   * Генерация документа решения совета о возврате паевого взноса (901)
   */
  async generateReturnByMoneyDecisionDocument(
    data: Cooperative.Registry.ReturnByMoneyDecision.Action,
    options: Cooperative.Document.IGenerationOptions
  ): Promise<DocumentDomainEntity> {
    // Устанавливаем registry_id для документа решения
    data.registry_id = Cooperative.Registry.ReturnByMoneyDecision.registry_id;
    return await this.generatorInfrastructureService.generateDocument({ data, options });
  }

  /**
   * Создание заявки на вывод средств (createWithdraw)
   * Данный метод создает платеж в gateway и withdraw в blockchain
   */
  async createWithdraw(data: CreateWithdrawInputDomainInterface): Promise<{ withdraw_hash: string }> {
    // Используем payment_hash из параметров вместо генерации нового
    const withdraw_hash = data.payment_hash;

    let createdPayment: PaymentDomainEntity | null = null;

    try {
      // 1. Создаем исходящий платеж в gateway для отслеживания
      createdPayment = await this.gatewayInteractorPort.createWithdraw({
        coopname: data.coopname,
        username: data.username,
        quantity: data.quantity,
        symbol: data.symbol,
        method_id: data.method_id,
        statement: data.statement,
        payment_hash: data.payment_hash,
      });

      // 2. Создаем withdraw в wallet контракте
      // wallet контракт автоматически создаст outcome в gateway контракте
      await this.walletBlockchainPort.createWithdraw({
        coopname: data.coopname,
        username: data.username,
        withdraw_hash,
        quantity: `${data.quantity} ${data.symbol}`,
        statement: data.statement,
      });

      this.logger.log(`Создан withdraw в wallet: ${withdraw_hash}, outcome будет создан автоматически в gateway`);

      return { withdraw_hash };
    } catch (error: any) {
      this.logger.error(`Ошибка при создании withdraw: ${error.message}`, error);

      // Если платеж был создан, но произошла ошибка при создании withdraw в блокчейне
      if (createdPayment?.id) {
        try {
          // Обновляем статус платежа на FAILED с сообщением об ошибке
          await this.gatewayInteractorPort.setPaymentStatus({
            id: createdPayment.id,
            status: PaymentStatusEnum.FAILED,
          });

          this.logger.log(`Платеж ${createdPayment.id} помечен как FAILED из-за ошибки создания withdraw`);
        } catch (updateError: any) {
          this.logger.error(`Ошибка при обновлении статуса платежа: ${updateError.message}`, updateError);
        }
      }

      throw error;
    }
  }

  /**
   * Получить программные кошельки с пагинацией.
   *
   * После Эпика 3 источником служит `ledger2::userwallets` (репозиторий
   * `user_wallet`). Для program_id=1 (ЦК) баланс собирается из двух
   * USER_SHARED-кошельков: `w.wal.share` (available/blocked) +
   * `w.wal.member` (membership_contribution). Для прочих программ — один
   * `wallet_name`.
   *
   * Возвращаем `ProgramWalletDomainEntity` ради совместимости с
   * существующими DTO-конвертерами (фронт пока ждёт прежний контракт).
   */
  async getProgramWalletsPaginated(
    filter?: ProgramWalletFilterInputDTO,
    pagination?: PaginationInputDTO
  ): Promise<PaginationResult<ProgramWalletDomainEntity>> {
    const coopname = filter?.coopname || config.coopname;

    let program_id = filter?.program_id;
    if (filter?.program_type && !program_id) {
      program_id = getProgramId(filter.program_type);
    }

    const paginationOptions = {
      page: pagination?.page || 1,
      limit: pagination?.limit || 10,
      sortBy: pagination?.sortBy,
      sortOrder: (pagination?.sortOrder || 'ASC') as 'ASC' | 'DESC',
    };

    const wallets = await this.assembleProgramWallets({ coopname, username: filter?.username, program_id });

    const totalCount = wallets.length;
    const totalPages = Math.ceil(totalCount / paginationOptions.limit);
    const offset = (paginationOptions.page - 1) * paginationOptions.limit;
    const items = wallets.slice(offset, offset + paginationOptions.limit);

    return { items, totalCount, totalPages, currentPage: paginationOptions.page };
  }

  /**
   * Получить один программный кошелек по фильтру.
   */
  async getProgramWallet(filter: ProgramWalletFilterInputDTO): Promise<ProgramWalletDomainEntity | null> {
    const coopname = filter.coopname || config.coopname;

    let program_id = filter.program_id;
    if (filter.program_type && !program_id) {
      program_id = getProgramId(filter.program_type);
    }

    const wallets = await this.assembleProgramWallets({ coopname, username: filter.username, program_id });
    return wallets.length > 0 ? wallets[0] : null;
  }

  /**
   * Собирает плоский ряд `ProgramWalletDomainEntity` для пайщика(ов).
   *
   * Видимость кошелька = факт подписанного программного соглашения
   * (`wallet::users.programs[]`), а не наличие L3-баланса. Контракт ledger2
   * стирает запись `userwallets` при достижении нуля (Эпик 3 §6) — без
   * stub'ов пайщик с подписанной программой, но без переводов, не увидел бы
   * свой кошелёк. Поэтому для каждой пары (username, program_id) из
   * `wallet::users` создаём запись со суммой из L3 либо нулём в валюте
   * кооператива.
   *
   * Split-кошельки (ЦК = w.wal.share + w.wal.member) сворачиваются в один
   * `ProgramWalletDomainEntity` с available/blocked из share и
   * membership_contribution из member.
   *
   * @internal используется агрегацией внутри интерактора и капитал-расширением.
   */
  private async assembleProgramWallets(filter: {
    coopname: string;
    username?: string;
    program_id?: string;
  }): Promise<ProgramWalletDomainEntity[]> {
    const filterPid = filter.program_id ? Number(filter.program_id) : undefined;

    const targetWalletNames =
      filterPid !== undefined
        ? Ledger2.walletNamesForProgram(filterPid)
        : [...Ledger2.ALL_PROGRAM_WALLET_NAMES];
    if (targetWalletNames.length === 0) return [];

    // 1. L3-rows — балансы.
    const rows: UserWalletDomainEntity[] = [];
    if (filter.username) {
      const userRows = await this.userWalletRepository.findByUsername(filter.coopname, filter.username);
      rows.push(...userRows.filter((r) => r.wallet_name && targetWalletNames.includes(r.wallet_name)));
    } else {
      for (const wallet_name of targetWalletNames) {
        const walletRows = await this.userWalletRepository.findByWallet(filter.coopname, wallet_name);
        rows.push(...walletRows);
      }
    }

    // 2. Подписанные соглашения — источник «открытости» кошелька.
    const owners: UserAgreementDomainEntity[] = filter.username
      ? await this.resolveAgreementOwners(filter.coopname, filter.username)
      : filterPid !== undefined
        ? await this.userAgreementRepository.findByProgramId(filter.coopname, filterPid)
        : await this.userAgreementRepository.findByCoopname(filter.coopname);

    type ExpectedMeta = { signed_at?: string; block_num?: number };
    const expected = new Map<string, ExpectedMeta>(); // ключ "username::pid"
    for (const owner of owners) {
      if (owner.present === false) continue;
      for (const p of owner.programs) {
        const pid = Number(p.program_id);
        if (filterPid !== undefined && pid !== filterPid) continue;
        if (Ledger2.walletNamesForProgram(pid).length === 0) continue; // marketplace и т.п.
        expected.set(`${owner.username}::${pid}`, {
          signed_at: p.signed_at,
          block_num: owner.block_num,
        });
      }
    }

    // 3. Buckets из L3-rows.
    type Bucket = { share?: UserWalletDomainEntity; member?: UserWalletDomainEntity; single?: UserWalletDomainEntity };
    const buckets = new Map<string, Bucket>();
    for (const row of rows) {
      if (row.present === false) continue;
      const wn = row.wallet_name as string;
      const pid = Ledger2.programIdForWallet(wn);
      if (pid === undefined) continue;
      if (filterPid !== undefined && pid !== filterPid) continue;

      const key = `${row.coopname}::${row.username}::${pid}`;
      const bucket = buckets.get(key) ?? {};
      if (pid === 1) {
        if (wn === Ledger2.MEMBERSHIP_WALLET_NAME) bucket.member = row;
        else bucket.share = row;
      } else {
        bucket.single = row;
      }
      buckets.set(key, bucket);
    }

    // 4. Pre-create пустые buckets для каждой ожидаемой пары — это и есть stub.
    for (const expectedKey of expected.keys()) {
      const [username, pidStr] = expectedKey.split('::');
      const fullKey = `${filter.coopname}::${username}::${pidStr}`;
      if (!buckets.has(fullKey)) buckets.set(fullKey, {});
    }

    // 5. Образец asset для нулей в чистых stub'ах.
    let sampleAsset = rows.find((r) => r.available)?.available;
    if (!sampleAsset && expected.size > 0) {
      const coop = await this.blockchainPort.getCooperative(filter.coopname);
      sampleAsset = (coop?.initial as string | undefined) ?? '0.0000 RUB';
    }

    // 6. Сборка entities.
    const result: ProgramWalletDomainEntity[] = [];
    for (const [key, bucket] of buckets) {
      const [coopname, username, pidStr] = key.split('::');
      const pid = Number(pidStr);
      const head = bucket.single ?? bucket.share ?? bucket.member;
      const expectedMeta = expected.get(`${username}::${pid}`);

      // Bucket из L3 без агримента + program_id отсутствует в реестре =
      // не стоит показывать. На практике сюда не попасть: программа без записи
      // в маппинге фильтруется ранее.
      if (!head && !expectedMeta) continue;

      const zero = (s?: string) => this.zeroAssetLike(s ?? sampleAsset);
      const available = (bucket.single ?? bucket.share)?.available ?? zero(head?.available);
      const blocked = (bucket.single ?? bucket.share)?.blocked ?? zero(head?.blocked);
      const membership = bucket.member?.available ?? zero(head?.available);

      const stubDate = expectedMeta?.signed_at ? new Date(expectedMeta.signed_at) : new Date(0);

      const entity = new ProgramWalletDomainEntity(
        {
          _id: head?._id ?? `stub-${coopname}-${username}-${pid}`,
          _created_at: head?._created_at ?? stubDate,
          _updated_at: head?._updated_at ?? stubDate,
          block_num: head?.block_num ?? expectedMeta?.block_num,
          present: true,
        },
        {
          id: head?.id ?? `${pid}-${username}`,
          coopname,
          program_id: String(pid),
          agreement_id: '0',
          username,
          available,
          blocked,
          membership_contribution: membership,
        }
      );
      entity.program_type = getProgramType(String(pid));
      result.push(entity);
    }

    return result;
  }

  private async resolveAgreementOwners(coopname: string, username: string): Promise<UserAgreementDomainEntity[]> {
    const owner = await this.userAgreementRepository.findByUsername(coopname, username);
    return owner ? [owner] : [];
  }

  private zeroAssetLike(asset: string | undefined): string {
    if (!asset) return '0.0000 RUB';
    const [amount, sym] = asset.split(' ');
    const decimals = (amount?.split('.')[1] || '').length;
    return `${(0).toFixed(decimals)} ${sym ?? 'RUB'}`;
  }
}
