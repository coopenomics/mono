import { CapitalContract } from 'cooptypes';
import type { IContributorBlockchainData } from '../interfaces/contributor-blockchain.interface';
import type { IAppendixBlockchainData } from '../interfaces/appendix-blockchain.interface';
import type { InnerTransactResult } from '@coopenomics/innercoop';

/**
 * Блокчейн порт для CAPITAL контракта
 * Определяет интерфейс взаимодействия с блокчейном
 */
export interface CapitalBlockchainPort {
  /**
   * Установка конфигурации CAPITAL контракта
   */
  setConfig(data: CapitalContract.Actions.SetConfig.ISetConfig): Promise<InnerTransactResult>;

  /**
   * Получение состояния CAPITAL контракта (включая конфигурацию)
   */
  getConfig(coopname: string): Promise<CapitalContract.Tables.State.IState | null>;

  /**
   * Импорт участника в CAPITAL контракт
   */
  importContributor(data: CapitalContract.Actions.ImportContributor.IImportContributor): Promise<InnerTransactResult>;

  /**
   * Создание проекта в CAPITAL контракте
   */
  createProject(data: CapitalContract.Actions.CreateProject.ICreateProject): Promise<InnerTransactResult>;

  /**
   * Получение проекта из CAPITAL контракта по хешу
   */
  getProject(coopname: string, projectHash: string): Promise<CapitalContract.Tables.Projects.IProject | null>;

  /**
   * Редактирование проекта в CAPITAL контракте
   */
  editProject(data: CapitalContract.Actions.EditProject.IEditProject): Promise<InnerTransactResult>;

  /**
   * Регистрация участника в CAPITAL контракте
   */
  registerContributor(data: CapitalContract.Actions.RegisterContributor.IRegisterContributor): Promise<InnerTransactResult>;

  /**
   * Регистрация участника с полным набором соглашений (для завершения регистрации)
   * Отправляет regcontrib с основным контрактом и опциональным соглашением Благорост
   */
  registerContributorWithAgreements(data: CapitalContract.Actions.RegisterContributor.IRegisterContributor): Promise<InnerTransactResult>;

  /**
   * Получение участника из CAPITAL контракта по хешу
   */
  getContributor(coopname: string, username: string): Promise<IContributorBlockchainData | null>;

  /**
   * Подписание приложения в CAPITAL контракте
   */
  makeClearance(data: CapitalContract.Actions.GetClearance.IGetClearance): Promise<InnerTransactResult>;

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
  createCommit(data: CapitalContract.Actions.CreateCommit.ICommit): Promise<InnerTransactResult>;

  /**
   * Получение коммита из CAPITAL контракта по хешу
   */
  getCommitByHash(coopname: string, commitHash: string): Promise<CapitalContract.Tables.Commits.ICommit | null>;

  /**
   * Одобрение коммита в CAPITAL контракте
   */
  approveCommit(data: CapitalContract.Actions.CommitApprove.ICommitApprove): Promise<InnerTransactResult>;

  /**
   * Отклонение коммита в CAPITAL контракте
   */
  declineCommit(data: CapitalContract.Actions.CommitDecline.ICommitDecline): Promise<InnerTransactResult>;

  /**
   * Обновление сегмента в CAPITAL контракте
   */
  refreshSegment(data: CapitalContract.Actions.RefreshSegment.IRefreshSegment): Promise<InnerTransactResult>;

  /**
   * Инвестирование в проект CAPITAL контракта
   */
  createProjectInvest(data: CapitalContract.Actions.CreateProjectInvest.ICreateInvest): Promise<InnerTransactResult>;

  /**
   * Денежная программная инвестиция (createpinv)
   */
  createProgramInvest(data: CapitalContract.Actions.CreateProgramInvest.ICreateProgramInvest): Promise<InnerTransactResult>;

  /**
   * Создание долга в CAPITAL контракте
   */
  createDebt(data: CapitalContract.Actions.CreateDebt.ICreateDebt): Promise<InnerTransactResult>;

  /**
   * Создание проектного имущественного взноса в CAPITAL контракте
   */
  createProjectProperty(data: CapitalContract.Actions.CreateProjectProperty.ICreateProjectProperty): Promise<InnerTransactResult>;

  /**
   * Создание программного имущественного взноса в CAPITAL контракте
   */
  createProgramProperty(data: CapitalContract.Actions.CreateProgramProperty.ICreateProgramProperty): Promise<InnerTransactResult>;

  /**
   * Запуск голосования в CAPITAL контракте
   */
  startVoting(data: CapitalContract.Actions.StartVoting.IStartVoting): Promise<InnerTransactResult>;

  /**
   * Голосование в CAPITAL контракте
   */
  submitVote(data: CapitalContract.Actions.SubmitVote.ISubmitVote): Promise<InnerTransactResult>;

  /**
   * Завершение голосования в CAPITAL контракте
   */
  completeVoting(data: CapitalContract.Actions.CompleteVoting.ICompleteVoting): Promise<InnerTransactResult>;

  /**
   * Расчет голосов в CAPITAL контракте
   */
  calculateVotes(data: CapitalContract.Actions.CalculateVotes.IFinalVoting): Promise<InnerTransactResult>;

  /**
   * Внесение результата в CAPITAL контракте
   */
  pushResult(data: CapitalContract.Actions.PushResult.IPushResult): Promise<InnerTransactResult>;

  /**
   * Конвертация сегмента в CAPITAL контракте
   */
  convertSegment(data: CapitalContract.Actions.ConvertSegment.IConvertSegment): Promise<InnerTransactResult>;

  /**
   * Финансирование программы в CAPITAL контракте
   */
  fundProgram(data: CapitalContract.Actions.FundProgram.IFundProgram): Promise<InnerTransactResult>;

  /**
   * Обновление CRPS пайщика в программе CAPITAL контракта
   */
  refreshProgram(data: CapitalContract.Actions.RefreshProgram.IRefreshProgram): Promise<InnerTransactResult>;

  /**
   * Регистрация / обновление доли участника в проекте по балансу целевой программы (regshare, подпись кооператива)
   */
  registerShare(data: CapitalContract.Actions.RegisterShare.IRegisterShare): Promise<InnerTransactResult>;

  /**
   * Установка мастера проекта CAPITAL контракта
   */
  setMaster(data: CapitalContract.Actions.SetMaster.ISetMaster): Promise<InnerTransactResult>;

  /**
   * Добавление автора проекта CAPITAL контракта
   */
  addAuthor(data: CapitalContract.Actions.AddAuthor.IAddAuthor): Promise<InnerTransactResult>;

  /**
   * Установка плана проекта CAPITAL контракта
   */
  setPlan(data: CapitalContract.Actions.SetPlan.ISetPlan): Promise<InnerTransactResult>;

  /**
   * Запуск проекта CAPITAL контракта
   */
  startProject(data: CapitalContract.Actions.StartProject.IStartProject): Promise<InnerTransactResult>;

  /**
   * Открытие проекта для инвестиций CAPITAL контракта
   */
  openProject(data: CapitalContract.Actions.OpenProject.IOpenProject): Promise<InnerTransactResult>;

  /**
   * Закрытие проекта от инвестиций CAPITAL контракта
   */
  closeProject(data: CapitalContract.Actions.CloseProject.ICloseProject): Promise<InnerTransactResult>;

  /**
   * Финализация проекта CAPITAL контракта
   * Финализация проекта после завершения всех конвертаций участников
   */
  finalizeProject(data: CapitalContract.Actions.FinalizeProject.IFinalizeProject): Promise<InnerTransactResult>;

  /**
   * Остановка проекта CAPITAL контракта
   */
  stopProject(data: CapitalContract.Actions.StopProject.IStopProject): Promise<InnerTransactResult>;

  /**
   * Удаление проекта CAPITAL контракта
   */
  deleteProject(data: CapitalContract.Actions.DeleteProject.IDeleteProject): Promise<InnerTransactResult>;

  /**
   * Создание расхода CAPITAL контракта
   */
  createExpense(data: CapitalContract.Actions.CreateExpense.ICreateExpense): Promise<InnerTransactResult>;

  /**
   * Программный расход через шасси: capital резервирует program_expense_pool
   * и шлёт inline action в expense::createexp с callback `{capital, onpgexpdone}`.
   */
  createProgramExpense(
    data: CapitalContract.Actions.CreateProgramExpense.ICreateProgramExpense,
  ): Promise<InnerTransactResult>;

  /**
   * Пополнение пула программных расходов из доступного остатка
   * `global_available_invest_pool` (председатель).
   */
  topupProgramExpense(
    data: CapitalContract.Actions.TopupProgramExpense.ITopupProgramExpense,
  ): Promise<InnerTransactResult>;

  /**
   * Направление средств программы в проект или компонент из доступного остатка
   * `global_available_invest_pool` (председатель).
   */
  allocateFunds(data: CapitalContract.Actions.Allocate.IAllocate): Promise<InnerTransactResult>;

  /**
   * Возврат ранее направленных средств из проекта или компонента обратно
   * в свободный остаток программы (председатель). Доступен, пока проект
   * не ушёл на голосование.
   */
  deallocateFunds(data: CapitalContract.Actions.Deallocate.IDiallocate): Promise<InnerTransactResult>;

  /**
   * Редактирование участника CAPITAL контракта
   */
  editContributor(data: CapitalContract.Actions.EditContributor.IEditContributor): Promise<InnerTransactResult>;

  /**
   * Подписание акта участником CAPITAL контракта
   */
  signAct1(data: CapitalContract.Actions.SignAct1.ISignAct1): Promise<InnerTransactResult>;

  /**
   * Подписание акта председателем CAPITAL контракта
   */
  signAct2(data: CapitalContract.Actions.SignAct2.ISignAct2): Promise<InnerTransactResult>;

  /**
   * Обновление энергии участника в CAPITAL контракте (геймификация)
   */
  refreshContributor(data: CapitalContract.Actions.RefreshContributor.IRefreshContributor): Promise<InnerTransactResult>;

}

/**
 * Символ для dependency injection
 */
export const CAPITAL_BLOCKCHAIN_PORT = Symbol('CapitalBlockchainPort');
