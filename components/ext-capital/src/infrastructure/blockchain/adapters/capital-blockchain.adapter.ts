import { Injectable } from '@nestjs/common';
import { CapitalContract } from 'cooptypes';
import { CapitalBlockchainPort } from '../../../domain/interfaces/capital-blockchain.port';
import { Checksum256, Name, UInt128, type TransactResult } from '@wharfkit/session';
import { BlockchainService } from '~/infrastructure/blockchain/blockchain.service';
import { VaultDomainService, VAULT_DOMAIN_SERVICE } from '~/domain/vault/services/vault-domain.service';
import { Inject } from '@nestjs/common';
import httpStatus from 'http-status';
import { HttpApiError } from '~/utils/httpApiError';
import { DomainToBlockchainUtils } from '~/shared/utils/domain-to-blockchain.utils';
import type { IContributorBlockchainData } from '../../../domain/interfaces/contributor-blockchain.interface';
import type { IAppendixBlockchainData } from '../../../domain/interfaces/appendix-blockchain.interface';
import { ContributorDeltaMapper } from '../mappers/contributor-delta.mapper';
import { AppendixDeltaMapper } from '../mappers/appendix-delta.mapper';

/**
 * Инфраструктурный сервис для реализации блокчейн порта CAPITAL
 * Осуществляет взаимодействие с блокчейном через BlockchainService
 */
@Injectable()
export class CapitalBlockchainAdapter implements CapitalBlockchainPort {
  constructor(
    private readonly blockchainService: BlockchainService,
    private readonly domainToBlockchainUtils: DomainToBlockchainUtils,
    private readonly contributorDeltaMapper: ContributorDeltaMapper,
    private readonly appendixDeltaMapper: AppendixDeltaMapper,
    @Inject(VAULT_DOMAIN_SERVICE) private readonly vaultDomainService: VaultDomainService
  ) {}

  /**
   * Установка конфигурации CAPITAL контракта
   */
  async setConfig(data: CapitalContract.Actions.SetConfig.ISetConfig): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ для совершения операции');

    this.blockchainService.initialize(data.coopname, wif);

    return await this.blockchainService.transact({
      account: CapitalContract.contractName.production,
      name: CapitalContract.Actions.SetConfig.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    });
  }

  /**
   * Получение состояния CAPITAL контракта (включая конфигурацию)
   */
  async getConfig(coopname: string): Promise<CapitalContract.Tables.State.IState | null> {
    // Получаем состояние из таблицы state контракта capital
    // scope = coopname, primary_key = coopname
    const state = await this.blockchainService.getSingleRow<CapitalContract.Tables.State.IState>(
      CapitalContract.contractName.production,
      CapitalContract.contractName.production,
      CapitalContract.Tables.State.tableName,
      Name.from(coopname)
    );

    return state;
  }

  /**
   * Импорт участника в CAPITAL контракт
   */
  async importContributor(data: CapitalContract.Actions.ImportContributor.IImportContributor): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ для совершения операции');

    this.blockchainService.initialize(data.coopname, wif);

    return await this.blockchainService.transact({
      account: CapitalContract.contractName.production,
      name: CapitalContract.Actions.ImportContributor.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    });
  }

  /**
   * Создание проекта в CAPITAL контракте
   */
  async createProject(data: CapitalContract.Actions.CreateProject.ICreateProject): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ для совершения операции');

    this.blockchainService.initialize(data.coopname, wif);
    if (data.parent_hash === '') data.parent_hash = DomainToBlockchainUtils.getEmptyHash();

    return await this.blockchainService.transact({
      account: CapitalContract.contractName.production,
      name: CapitalContract.Actions.CreateProject.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    });
  }

  /**
   * Получение проекта из CAPITAL контракта по хешу
   */
  async getProject(coopname: string, projectHash: string): Promise<CapitalContract.Tables.Projects.IProject | null> {
    // Получаем проект из таблицы projects контракта capital
    const project = await this.blockchainService.getSingleRow<CapitalContract.Tables.Projects.IProject>(
      CapitalContract.contractName.production,
      coopname,
      CapitalContract.Tables.Projects.tableName,
      Checksum256.from(projectHash),
      'tertiary',
      'sha256'
    );

    return project;
  }

  /**
   * Редактирование проекта в CAPITAL контракте
   */
  async editProject(data: CapitalContract.Actions.EditProject.IEditProject): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ для совершения операции');

    this.blockchainService.initialize(data.coopname, wif);

    return await this.blockchainService.transact({
      account: CapitalContract.contractName.production,
      name: CapitalContract.Actions.EditProject.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    });
  }

  /**
   * Регистрация участника в CAPITAL контракте
   */
  async registerContributor(
    data: CapitalContract.Actions.RegisterContributor.IRegisterContributor
  ): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ для совершения операции');

    this.blockchainService.initialize(data.coopname, wif);

    // Выполняем транзакцию регистрации
    const result = await this.blockchainService.transact({
      account: CapitalContract.contractName.production,
      name: CapitalContract.Actions.RegisterContributor.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    });

    return result;
  }

  /**
   * Регистрация участника с полным набором соглашений
   * Отправляет regcontrib с основным контрактом и опциональным соглашением Благорост
   */
  async registerContributorWithAgreements(data: CapitalContract.Actions.RegisterContributor.IRegisterContributor): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ для совершения операции');

    this.blockchainService.initialize(data.coopname, wif);

    // Формируем данные для regcontrib
    const regcontribData: CapitalContract.Actions.RegisterContributor.IRegisterContributor = {
      coopname: data.coopname,
      username: data.username,
      contributor_hash: data.contributor_hash,
      rate_per_hour: data.rate_per_hour,
      hours_per_day: data.hours_per_day,
      is_external_contract: data.is_external_contract,
      contract: data.contract,
      storage_agreement: data.storage_agreement,
      blagorost_agreement: data.blagorost_agreement ?? undefined, // Опциональное соглашение
      generator_agreement: data.generator_agreement ?? undefined, // Опциональное соглашение
    };

    // Выполняем транзакцию regcontrib
    const result = await this.blockchainService.transact({
      account: CapitalContract.contractName.production,
      name: CapitalContract.Actions.RegisterContributor.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data: regcontribData,
    });

    return result;
  }

  /**
   * Получение участника из CAPITAL контракта по хешу
   */
  async getContributor(coopname: string, username: string): Promise<IContributorBlockchainData | null> {
    // Получаем участника из таблицы contributors контракта capital
    const contributor = await this.blockchainService.getSingleRow<CapitalContract.Tables.Contributors.IContributor>(
      CapitalContract.contractName.production,
      coopname,
      CapitalContract.Tables.Contributors.tableName,
      Name.from(username),
      'secondary',
      'name'
    );

    if (!contributor) {
      return null;
    }

    // Используем delta mapper для преобразования данных
    return this.contributorDeltaMapper.mapDeltaToBlockchainData({ value: contributor });
  }

  /**
   * Получение приложения из CAPITAL контракта по хешу
   */
  async getAppendix(coopname: string, appendixHash: string): Promise<IAppendixBlockchainData | null> {
    // Получаем приложение из таблицы appendixes контракта capital
    const appendix = await this.blockchainService.getSingleRow<CapitalContract.Tables.Appendixes.IAppendix>(
      CapitalContract.contractName.production,
      coopname,
      CapitalContract.Tables.Appendixes.tableName,
      Checksum256.from(appendixHash),
      'fourth',
      'sha256'
    );

    if (!appendix) {
      return null;
    }

    // Используем delta mapper для преобразования данных
    return this.appendixDeltaMapper.mapDeltaToBlockchainData({ value: appendix });
  }

  /**
   * Подписание приложения в CAPITAL контракте
   */
  async makeClearance(data: CapitalContract.Actions.GetClearance.IGetClearance): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ для совершения операции');

    this.blockchainService.initialize(data.coopname, wif);

    return await this.blockchainService.transact({
      account: CapitalContract.contractName.production,
      name: CapitalContract.Actions.GetClearance.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    });
  }

  /**
   * Создание коммита в CAPITAL контракте
   */
  async createCommit(data: CapitalContract.Actions.CreateCommit.ICommit): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ для совершения операции');

    this.blockchainService.initialize(data.coopname, wif);

    return await this.blockchainService.transact({
      account: CapitalContract.contractName.production,
      name: CapitalContract.Actions.CreateCommit.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    });
  }

  /**
   * Получение коммита из CAPITAL контракта по хешу
   */
  async getCommitByHash(coopname: string, commitHash: string): Promise<CapitalContract.Tables.Commits.ICommit | null> {
    // Получаем коммит из таблицы commits контракта capital по индексу by_hash (позиция 3)
    const commit = await this.blockchainService.getSingleRow<CapitalContract.Tables.Commits.ICommit>(
      CapitalContract.contractName.production,
      coopname,
      CapitalContract.Tables.Commits.tableName,
      Checksum256.from(commitHash),
      'tertiary', // Индекс by_hash находится на позиции 3
      'sha256' // Тип ключа checksum256
    );

    return commit;
  }

  /**
   * Одобрение коммита в CAPITAL контракте
   */
  async approveCommit(data: CapitalContract.Actions.CommitApprove.ICommitApprove): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ для совершения операции');

    this.blockchainService.initialize(data.coopname, wif);

    return await this.blockchainService.transact({
      account: CapitalContract.contractName.production,
      name: CapitalContract.Actions.CommitApprove.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    });
  }

  /**
   * Отклонение коммита в CAPITAL контракте
   */
  async declineCommit(data: CapitalContract.Actions.CommitDecline.ICommitDecline): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ для совершения операции');

    this.blockchainService.initialize(data.coopname, wif);

    return await this.blockchainService.transact({
      account: CapitalContract.contractName.production,
      name: CapitalContract.Actions.CommitDecline.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    });
  }

  /**
   * Обновление сегмента в CAPITAL контракте
   */
  async refreshSegment(data: CapitalContract.Actions.RefreshSegment.IRefreshSegment): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ для совершения операции');

    this.blockchainService.initialize(data.coopname, wif);

    return await this.blockchainService.transact({
      account: CapitalContract.contractName.production,
      name: CapitalContract.Actions.RefreshSegment.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    });
  }

  /**
   * Инвестирование в проект CAPITAL контракта
   */
  async createProjectInvest(data: CapitalContract.Actions.CreateProjectInvest.ICreateInvest): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ для совершения операции');

    this.blockchainService.initialize(data.coopname, wif);

    return await this.blockchainService.transact({
      account: CapitalContract.contractName.production,
      name: CapitalContract.Actions.CreateProjectInvest.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    });
  }

  /**
   * Создание долга в CAPITAL контракте
   */
  async createDebt(data: CapitalContract.Actions.CreateDebt.ICreateDebt): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ для совершения операции');

    this.blockchainService.initialize(data.coopname, wif);

    return await this.blockchainService.transact({
      account: CapitalContract.contractName.production,
      name: CapitalContract.Actions.CreateDebt.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    });
  }

  /**
   * Создание проектного имущественного взноса в CAPITAL контракте
   */
  async createProjectProperty(
    data: CapitalContract.Actions.CreateProjectProperty.ICreateProjectProperty
  ): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ для совершения операции');

    this.blockchainService.initialize(data.coopname, wif);

    return await this.blockchainService.transact({
      account: CapitalContract.contractName.production,
      name: CapitalContract.Actions.CreateProjectProperty.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    });
  }

  /**
   * Создание программного имущественного взноса в CAPITAL контракте
   */
  async createProgramProperty(
    data: CapitalContract.Actions.CreateProgramProperty.ICreateProgramProperty
  ): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ для совершения операции');

    this.blockchainService.initialize(data.coopname, wif);

    return await this.blockchainService.transact({
      account: CapitalContract.contractName.production,
      name: CapitalContract.Actions.CreateProgramProperty.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    });
  }

  /**
   * Запуск голосования в CAPITAL контракте
   */
  async startVoting(data: CapitalContract.Actions.StartVoting.IStartVoting): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ для совершения операции');

    this.blockchainService.initialize(data.coopname, wif);

    return await this.blockchainService.transact({
      account: CapitalContract.contractName.production,
      name: CapitalContract.Actions.StartVoting.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    });
  }

  /**
   * Голосование в CAPITAL контракте
   */
  async submitVote(data: CapitalContract.Actions.SubmitVote.ISubmitVote): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ для совершения операции');

    this.blockchainService.initialize(data.coopname, wif);

    return await this.blockchainService.transact({
      account: CapitalContract.contractName.production,
      name: CapitalContract.Actions.SubmitVote.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    });
  }

  /**
   * Завершение голосования в CAPITAL контракте
   */
  async completeVoting(data: CapitalContract.Actions.CompleteVoting.ICompleteVoting): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ для совершения операции');

    this.blockchainService.initialize(data.coopname, wif);

    return await this.blockchainService.transact({
      account: CapitalContract.contractName.production,
      name: CapitalContract.Actions.CompleteVoting.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    });
  }

  /**
   * Расчет голосов в CAPITAL контракте
   */
  async calculateVotes(data: CapitalContract.Actions.CalculateVotes.IFinalVoting): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ для совершения операции');

    this.blockchainService.initialize(data.coopname, wif);

    return await this.blockchainService.transact({
      account: CapitalContract.contractName.production,
      name: CapitalContract.Actions.CalculateVotes.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    });
  }

  /**
   * Внесение результата в CAPITAL контракте
   */
  async pushResult(data: CapitalContract.Actions.PushResult.IPushResult): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ для совершения операции');

    this.blockchainService.initialize(data.coopname, wif);

    return await this.blockchainService.transact({
      account: CapitalContract.contractName.production,
      name: CapitalContract.Actions.PushResult.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    });
  }

  /**
   * Конвертация сегмента в CAPITAL контракте
   */
  async convertSegment(data: CapitalContract.Actions.ConvertSegment.IConvertSegment): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ для совершения операции');

    this.blockchainService.initialize(data.coopname, wif);

    return await this.blockchainService.transact({
      account: CapitalContract.contractName.production,
      name: CapitalContract.Actions.ConvertSegment.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    });
  }

  /**
   * Финансирование программы в CAPITAL контракте
   */
  async fundProgram(data: CapitalContract.Actions.FundProgram.IFundProgram): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ для совершения операции');

    this.blockchainService.initialize(data.coopname, wif);

    return await this.blockchainService.transact({
      account: CapitalContract.contractName.production,
      name: CapitalContract.Actions.FundProgram.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    });
  }

  /**
   * Обновление CRPS пайщика в программе CAPITAL контракта
   */
  async refreshProgram(data: CapitalContract.Actions.RefreshProgram.IRefreshProgram): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ для совершения операции');

    this.blockchainService.initialize(data.coopname, wif);

    return await this.blockchainService.transact({
      account: CapitalContract.contractName.production,
      name: CapitalContract.Actions.RefreshProgram.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    });
  }

  /**
   * Установка мастера проекта CAPITAL контракта
   */
  async setMaster(data: CapitalContract.Actions.SetMaster.ISetMaster): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ для совершения операции');

    this.blockchainService.initialize(data.coopname, wif);

    return await this.blockchainService.transact({
      account: CapitalContract.contractName.production,
      name: CapitalContract.Actions.SetMaster.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    });
  }

  /**
   * Добавление автора проекта CAPITAL контракта
   */
  async addAuthor(data: CapitalContract.Actions.AddAuthor.IAddAuthor): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ для совершения операции');

    this.blockchainService.initialize(data.coopname, wif);

    return await this.blockchainService.transact({
      account: CapitalContract.contractName.production,
      name: CapitalContract.Actions.AddAuthor.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    });
  }

  /**
   * Установка плана проекта CAPITAL контракта
   */
  async setPlan(data: CapitalContract.Actions.SetPlan.ISetPlan): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ для совершения операции');

    this.blockchainService.initialize(data.coopname, wif);

    return await this.blockchainService.transact({
      account: CapitalContract.contractName.production,
      name: CapitalContract.Actions.SetPlan.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    });
  }

  /**
   * Запуск проекта CAPITAL контракта
   */
  async startProject(data: CapitalContract.Actions.StartProject.IStartProject): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ для совершения операции');

    this.blockchainService.initialize(data.coopname, wif);

    return await this.blockchainService.transact({
      account: CapitalContract.contractName.production,
      name: CapitalContract.Actions.StartProject.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    });
  }

  /**
   * Открытие проекта для инвестиций CAPITAL контракта
   */
  async openProject(data: CapitalContract.Actions.OpenProject.IOpenProject): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ для совершения операции');

    this.blockchainService.initialize(data.coopname, wif);

    return await this.blockchainService.transact({
      account: CapitalContract.contractName.production,
      name: CapitalContract.Actions.OpenProject.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    });
  }

  /**
   * Закрытие проекта от инвестиций CAPITAL контракта
   */
  async closeProject(data: CapitalContract.Actions.CloseProject.ICloseProject): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ для совершения операции');

    this.blockchainService.initialize(data.coopname, wif);

    return await this.blockchainService.transact({
      account: CapitalContract.contractName.production,
      name: CapitalContract.Actions.CloseProject.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    });
  }

  /**
   * Остановка проекта CAPITAL контракта
   */
  async stopProject(data: CapitalContract.Actions.StopProject.IStopProject): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ для совершения операции');

    this.blockchainService.initialize(data.coopname, wif);

    return await this.blockchainService.transact({
      account: CapitalContract.contractName.production,
      name: CapitalContract.Actions.StopProject.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    });
  }


  /**
   * Финализация проекта CAPITAL контракта
   * Финализация проекта после завершения всех конвертаций участников
   */
  async finalizeProject(data: CapitalContract.Actions.FinalizeProject.IFinalizeProject): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ для совершения операции');

    this.blockchainService.initialize(data.coopname, wif);

    return await this.blockchainService.transact({
      account: CapitalContract.contractName.production,
      name: CapitalContract.Actions.FinalizeProject.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    });
  }

  /**
   * Удаление проекта CAPITAL контракта
   */
  async deleteProject(data: CapitalContract.Actions.DeleteProject.IDeleteProject): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ для совершения операции');

    this.blockchainService.initialize(data.coopname, wif);

    return await this.blockchainService.transact({
      account: CapitalContract.contractName.production,
      name: CapitalContract.Actions.DeleteProject.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    });
  }

  /**
   * Создание расхода CAPITAL контракта
   */
  async createExpense(data: CapitalContract.Actions.CreateExpense.ICreateExpense): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ для совершения операции');

    this.blockchainService.initialize(data.coopname, wif);

    return await this.blockchainService.transact({
      account: CapitalContract.contractName.production,
      name: CapitalContract.Actions.CreateExpense.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    });
  }

  /**
   * Редактирование участника CAPITAL контракта
   */
  async editContributor(data: CapitalContract.Actions.EditContributor.IEditContributor): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ для совершения операции');

    this.blockchainService.initialize(data.coopname, wif);

    return await this.blockchainService.transact({
      account: CapitalContract.contractName.production,
      name: CapitalContract.Actions.EditContributor.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    });
  }

  /**
   * Подписание акта участником CAPITAL контракта
   */
  async signAct1(data: CapitalContract.Actions.SignAct1.ISignAct1): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ для совершения операции');

    this.blockchainService.initialize(data.coopname, wif);

    return await this.blockchainService.transact({
      account: CapitalContract.contractName.production,
      name: CapitalContract.Actions.SignAct1.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    });
  }

  /**
   * Подписание акта председателем CAPITAL контракта
   */
  async signAct2(data: CapitalContract.Actions.SignAct2.ISignAct2): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ для совершения операции');

    this.blockchainService.initialize(data.coopname, wif);

    return await this.blockchainService.transact({
      account: CapitalContract.contractName.production,
      name: CapitalContract.Actions.SignAct2.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    });
  }

  /**
   * Обновление энергии участника в CAPITAL контракте (геймификация)
   */
  async refreshContributor(data: CapitalContract.Actions.RefreshContributor.IRefreshContributor): Promise<TransactResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ для совершения операции');

    this.blockchainService.initialize(data.coopname, wif);

    return await this.blockchainService.transact({
      account: CapitalContract.contractName.production,
      name: CapitalContract.Actions.RefreshContributor.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    });
  }

  /**
   * Получение результата из CAPITAL контракта по хэшу результата
   */
  async getResultByHash(coopname: string, resultHash: string): Promise<CapitalContract.Tables.Results.IResult | null> {
    // Получаем результат из таблицы results контракта capital по индексу by_hash (позиция 3)
    const result = await this.blockchainService.getSingleRow<CapitalContract.Tables.Results.IResult>(
      CapitalContract.contractName.production,
      coopname,
      CapitalContract.Tables.Results.tableName,
      Checksum256.from(resultHash),
      'tertiary', // Индекс by_hash находится на позиции 3
      'sha256' // Тип ключа checksum256
    );

    return result;
  }

  /**
   * Получение сегмента из CAPITAL контракта по проекту и пользователю
   */
  async getSegmentByProjectUser(
    coopname: string,
    projectHash: string,
    username: string
  ): Promise<CapitalContract.Tables.Segments.ISegment | null> {
    // Создаем составной ключ для поиска по индексу by_project_user (позиция 3)
    const compositeKey = this.domainToBlockchainUtils.combineChecksumAndUsername(projectHash, username);
    const keyUInt128 = UInt128.from(compositeKey);

    // Получаем сегмент из таблицы segments контракта capital
    const segment = await this.blockchainService.getSingleRow<CapitalContract.Tables.Segments.ISegment>(
      CapitalContract.contractName.production,
      coopname,
      CapitalContract.Tables.Segments.tableName,
      keyUInt128,
      'tertiary', // Индекс by_project_user находится на позиции 3
      'i128' // Тип ключа uint128_t
    );

    return segment;
  }
}
