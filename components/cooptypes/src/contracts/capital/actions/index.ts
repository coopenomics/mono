// Актуальные действия контракта Capital из capital.hpp

// Импорт участников
export * as ImportContributor from './importContributor'

// Управление конфигурацией
export * as SetConfig from './setConfig'

// Управление проектами
export * as CreateProject from './createProject'
export * as EditProject from './editProject'
export * as OpenProject from './openProject'
export * as CloseProject from './closeProject'
export * as StartProject from './startProject'
export * as StopProject from './stopProject'
export * as StartVoting from './startVoting'
export * as CompleteVoting from './completeVoting'
export * as CalculateVotes from './calcVotes'
export * as SubmitVote from './submitVote'
export * as DeleteProject from './deleteProject'
export * as SetMaster from './setMaster'
export * as SetPlan from './setPlan'
export * as ExpandExpenses from './expandExpenses'

// Конвертация сегментов
export * as ConvertSegment from './convertSegment'

// Возврат из программы (createwthd3, capauthwthd3, approvewthd3, capdeclwthd3)
export * as CreateWithdrawProgram from './createWithdrawProgram'

// Результаты
export * as PushResult from './pushResult'
export * as SignAct1 from './signAct1'
export * as SignAct2 from './signAct2'
// Программные имущественные взносы (новые действия)
export * as CreateProgramProperty from './createProgramProperty'
export * as Act1ProgramProperty from './act1ProgramProperty'
export * as Act2ProgramProperty from './act2ProgramProperty'

// Авторы
export * as AddAuthor from './addAuthor'

// Коммиты
export * as CreateCommit from './createCommit'
export * as CommitApprove from './commitApprove'
export * as CommitDecline from './commitDecline'

// Долги
export * as CreateDebt from './createDebt'

// Расходы программы через шасси expense (Эпик 5 шасси)
// capital — инициатор+callback, весь flow обслуживает контракт expense.
export * as TopupProgramExpense from './topupProgramExpense'
export * as CreateProgramExpense from './createProgramExpense'
export * as OnProgramExpenseDone from './onProgramExpenseDone'

// Регистрация участников
export * as RegisterContributor from './registerContributor'

// Редактирование участников
export * as EditContributor from './editContributor'

// Приложения к договору УХД
export * as GetClearance from './getClearance'
/**
 * @description Одобрение приложения к договору УХД
 * @private
 */
export * as ConfirmClearance from './confirmClearance'

/**
 * @description Отклонение приложения к договору УХД
 * @private
 */
export * as DeclineClearance from './declineClearance'

// Инвестиции в проекты
export * as CreateProjectInvest from './createInvest'

// Программные инвестиции
export * as CreateProgramInvest from './createProgramInvest'
// Проектные имущественные взносы (новые действия)
export * as CreateProjectProperty from './createProjectProperty'

// Аллокация программных инвестиций
export * as Allocate from './allocate'
export * as Deallocate from './deallocate'

// Расходы
export * as CreateExpense from './createExpense'

// Членские взносы
export * as FundProgram from './fundProgram'
export * as RefreshProgram from './refreshProgram'

// CRPS
export * as RefreshSegment from './refreshSegment'

// Участники проектов
export * as RegisterShare from './registerShare'

// Обновление участника
export * as RefreshContributor from './refreshContributor'

// Финализация проекта
export * as FinalizeProject from './finalizeProject'
