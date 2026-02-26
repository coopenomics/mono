import { CapitalContract } from 'cooptypes';
import type { TransactResult } from '@wharfkit/session';
import type { IContributorBlockchainData } from '../interfaces/contributor-blockchain.interface';
import type { IAppendixBlockchainData } from '../interfaces/appendix-blockchain.interface';

/**
 * Блокчейн порт для CAPITAL контракта
 * Определяет интерфейс взаимодействия с блокчейном
 */
export interface CapitalBlockchainPort {
  /**
   * Установка конфигурации CAPITAL контракта
   */
  setConfig(data: CapitalContract.Actions.SetConfig.ISetConfig): Promise<TransactResult>;

  /**
   * Получение состояния CAPITAL контракта (включая конфигурацию)
   */
  getConfig(coopname: string): Promise<CapitalContract.Tables.State.IState | null>;

  /**
   * Импорт участника в CAPITAL контракт
   */
  importContributor(data: CapitalContract.Actions.ImportContributor.IImportContributor): Promise<TransactResult>;

  /**
   * Создание проекта в CAPITAL контракте
   */
  createProject(data: CapitalContract.Actions.CreateProject.ICreateProject): Promise<TransactResult>;

  /**
   * Получение проекта из CAPITAL контракта по хешу
   */
  getProject(coopname: string, projectHash: string): Promise<CapitalContract.Tables.Projects.IProject | null>;

  /**
   * Редактирование проекта в CAPITAL контракте
   */
  editProject(data: CapitalContract.Actions.EditProject.IEditProject): Promise<TransactResult>;

  /**
   * Регистрация участника в CAPITAL контракте
   */
  registerContributor(data: CapitalContract.Actions.RegisterContributor.IRegisterContributor): Promise<TransactResult>;

  /**
   * Регистрация участника с полным набором соглашений (для завершения регистрации)
   * Отправляет regcontrib с основным контрактом и опциональным соглашением Благорост
   */
  registerContributorWithAgreements(data: CapitalContract.Actions.RegisterContributor.IRegisterContributor): Promise<TransactResult>;

  /**
   * Получение участника из CAPITAL контракта по хешу
   */
  getContributor(coopname: string, username: string): Promise<IContributorBlockchainData | null>;

  /**
   * Подписание приложения в CAPITAL контракте
   */
  makeClearance(data: CapitalContract.Actions.GetClearance.IGetClearance): Promise<TransactResult>;

  /**
   * Получение приложения из CAPITAL контракта по хешу
   */
  getAppendix(coopname: string, appendixHash: string): Promise<IAppendixBlockchainData | null>;

  /**
   * Получение результата из CAPITAL контракта по хэшу результата
   */
  getResultByHash(coopname: string, resultHash: string): Promise<CapitalContract.Tables.Results.IResult | null>;

  /**
   * Получение сегмента из CAPITAL контракта по проекту и пользователю
   */
  getSegmentByProjectUser(
    coopname: string,
    projectHash: string,
    username: string
  ): Promise<CapitalContract.Tables.Segments.ISegment | null>;

  /**
   * Создание коммита в CAPITAL контракте
   */
  createCommit(data: CapitalContract.Actions.CreateCommit.ICommit): Promise<TransactResult>;

  /**
   * Получение коммита из CAPITAL контракта по хешу
   */
  getCommitByHash(coopname: string, commitHash: string): Promise<CapitalContract.Tables.Commits.ICommit | null>;

  /**
   * Одобрение коммита в CAPITAL контракте
   */
  approveCommit(data: CapitalContract.Actions.CommitApprove.ICommitApprove): Promise<TransactResult>;

  /**
   * Отклонение коммита в CAPITAL контракте
   */
  declineCommit(data: CapitalContract.Actions.CommitDecline.ICommitDecline): Promise<TransactResult>;

  /**
   * Обновление сегмента в CAPITAL контракте
   */
  refreshSegment(data: CapitalContract.Actions.RefreshSegment.IRefreshSegment): Promise<TransactResult>;

  /**
   * Инвестирование в проект CAPITAL контракта
   */
  createProjectInvest(data: CapitalContract.Actions.CreateProjectInvest.ICreateInvest): Promise<TransactResult>;

  /**
   * Создание долга в CAPITAL контракте
   */
  createDebt(data: CapitalContract.Actions.CreateDebt.ICreateDebt): Promise<TransactResult>;

  /**
   * Создание проектного имущественного взноса в CAPITAL контракте
   */
  createProjectProperty(data: CapitalContract.Actions.CreateProjectProperty.ICreateProjectProperty): Promise<TransactResult>;

  /**
   * Создание программного имущественного взноса в CAPITAL контракте
   */
  createProgramProperty(data: CapitalContract.Actions.CreateProgramProperty.ICreateProgramProperty): Promise<TransactResult>;

  /**
   * Запуск голосования в CAPITAL контракте
   */
  startVoting(data: CapitalContract.Actions.StartVoting.IStartVoting): Promise<TransactResult>;

  /**
   * Голосование в CAPITAL контракте
   */
  submitVote(data: CapitalContract.Actions.SubmitVote.ISubmitVote): Promise<TransactResult>;

  /**
   * Завершение голосования в CAPITAL контракте
   */
  completeVoting(data: CapitalContract.Actions.CompleteVoting.ICompleteVoting): Promise<TransactResult>;

  /**
   * Расчет голосов в CAPITAL контракте
   */
  calculateVotes(data: CapitalContract.Actions.CalculateVotes.IFinalVoting): Promise<TransactResult>;

  /**
   * Внесение результата в CAPITAL контракте
   */
  pushResult(data: CapitalContract.Actions.PushResult.IPushResult): Promise<TransactResult>;

  /**
   * Конвертация сегмента в CAPITAL контракте
   */
  convertSegment(data: CapitalContract.Actions.ConvertSegment.IConvertSegment): Promise<TransactResult>;

  /**
   * Финансирование программы в CAPITAL контракте
   */
  fundProgram(data: CapitalContract.Actions.FundProgram.IFundProgram): Promise<TransactResult>;

  /**
   * Обновление CRPS пайщика в программе CAPITAL контракта
   */
  refreshProgram(data: CapitalContract.Actions.RefreshProgram.IRefreshProgram): Promise<TransactResult>;

  /**
   * Установка мастера проекта CAPITAL контракта
   */
  setMaster(data: CapitalContract.Actions.SetMaster.ISetMaster): Promise<TransactResult>;

  /**
   * Добавление автора проекта CAPITAL контракта
   */
  addAuthor(data: CapitalContract.Actions.AddAuthor.IAddAuthor): Promise<TransactResult>;

  /**
   * Установка плана проекта CAPITAL контракта
   */
  setPlan(data: CapitalContract.Actions.SetPlan.ISetPlan): Promise<TransactResult>;

  /**
   * Запуск проекта CAPITAL контракта
   */
  startProject(data: CapitalContract.Actions.StartProject.IStartProject): Promise<TransactResult>;

  /**
   * Открытие проекта для инвестиций CAPITAL контракта
   */
  openProject(data: CapitalContract.Actions.OpenProject.IOpenProject): Promise<TransactResult>;

  /**
   * Закрытие проекта от инвестиций CAPITAL контракта
   */
  closeProject(data: CapitalContract.Actions.CloseProject.ICloseProject): Promise<TransactResult>;

  /**
   * Финализация проекта CAPITAL контракта
   * Финализация проекта после завершения всех конвертаций участников
   */
  finalizeProject(data: CapitalContract.Actions.FinalizeProject.IFinalizeProject): Promise<TransactResult>;

  /**
   * Остановка проекта CAPITAL контракта
   */
  stopProject(data: CapitalContract.Actions.StopProject.IStopProject): Promise<TransactResult>;

  /**
   * Удаление проекта CAPITAL контракта
   */
  deleteProject(data: CapitalContract.Actions.DeleteProject.IDeleteProject): Promise<TransactResult>;

  /**
   * Создание расхода CAPITAL контракта
   */
  createExpense(data: CapitalContract.Actions.CreateExpense.ICreateExpense): Promise<TransactResult>;

  /**
   * Редактирование участника CAPITAL контракта
   */
  editContributor(data: CapitalContract.Actions.EditContributor.IEditContributor): Promise<TransactResult>;

  /**
   * Подписание акта участником CAPITAL контракта
   */
  signAct1(data: CapitalContract.Actions.SignAct1.ISignAct1): Promise<TransactResult>;

  /**
   * Подписание акта председателем CAPITAL контракта
   */
  signAct2(data: CapitalContract.Actions.SignAct2.ISignAct2): Promise<TransactResult>;

  /**
   * Обновление энергии участника в CAPITAL контракте (геймификация)
   */
  refreshContributor(data: CapitalContract.Actions.RefreshContributor.IRefreshContributor): Promise<TransactResult>;

}

/**
 * Символ для dependency injection
 */
export const CAPITAL_BLOCKCHAIN_PORT = Symbol('CapitalBlockchainPort');
