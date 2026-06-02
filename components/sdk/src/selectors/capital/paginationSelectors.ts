import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { paginationSelector } from '../../utils/paginationSelector'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'
import { rawCapitalCandidateSelector } from './capitalCandidateSelector'
import { rawCommitSelector } from './commitSelector'
import { rawContributorSelector } from './contributorSelector'
import { rawCycleSelector } from './cycleSelector'
import { rawDebtSelector } from './debtSelector'
import { rawExpenseSelector } from './expenseSelector'
import { rawProgramExpenseSelector } from './programExpenseSelector'
import { rawInvestSelector } from './investSelector'
import { rawIssueSelector } from './issueSelector'
import { rawLogSelector } from './logSelector'
import { rawProjectSelector } from './projectSelector'
import { rawResultSelector } from './resultSelector'
import { rawSegmentSelector } from './segmentSelector'
import { rawStorySelector } from './storySelector'
import { rawTimeEntriesByIssuesSelector } from './timeEntriesByIssuesSelector'
import { rawTimeEntrySelector } from './timeEntrySelector'
import { rawVoteSelector } from './voteSelector'

// Пагинированный селектор для Capital кандидатов
export const rawCapitalCandidatesPaginationSelector = { ...paginationSelector, items: rawCapitalCandidateSelector }

const _validateCapitalCandidates: MakeAllFieldsRequired<ValueTypes['PaginatedCapitalCandidatesPaginationResult']>
  = rawCapitalCandidatesPaginationSelector

export type capitalCandidatesPaginationModel = ModelTypes['PaginatedCapitalCandidatesPaginationResult']
export const capitalCandidatesPaginationSelector = Selector('PaginatedCapitalCandidatesPaginationResult')(
  rawCapitalCandidatesPaginationSelector,
)

// Пагинированный селектор для голосований
const rawVotesPaginationSelector = { ...paginationSelector, items: rawVoteSelector }
const _validateVotes: MakeAllFieldsRequired<ValueTypes['PaginatedCapitalVotesPaginationResult']> = rawVotesPaginationSelector
export type votesPaginationModel = ModelTypes['PaginatedCapitalVotesPaginationResult']
export const votesPaginationSelector = Selector('PaginatedCapitalVotesPaginationResult')(rawVotesPaginationSelector)

// Пагинированный селектор для проектов
const rawProjectsPaginationSelector = { ...paginationSelector, items: rawProjectSelector }
const _validateProjects: MakeAllFieldsRequired<ValueTypes['PaginatedCapitalProjectsPaginationResult']> = rawProjectsPaginationSelector
export type projectsPaginationModel = ModelTypes['PaginatedCapitalProjectsPaginationResult']
export const projectsPaginationSelector = Selector('PaginatedCapitalProjectsPaginationResult')(rawProjectsPaginationSelector)

// Пагинированный селектор для участников
const rawContributorsPaginationSelector = { ...paginationSelector, items: rawContributorSelector }
const _validateContributors: MakeAllFieldsRequired<ValueTypes['PaginatedCapitalContributorsPaginationResult']> = rawContributorsPaginationSelector
export type contributorsPaginationModel = ModelTypes['PaginatedCapitalContributorsPaginationResult']
export const contributorsPaginationSelector = Selector('PaginatedCapitalContributorsPaginationResult')(rawContributorsPaginationSelector)

// Пагинированный селектор для инвестиций
const rawInvestsPaginationSelector = { ...paginationSelector, items: rawInvestSelector }
const _validateInvests: MakeAllFieldsRequired<ValueTypes['PaginatedCapitalInvestsPaginationResult']> = rawInvestsPaginationSelector
export type investsPaginationModel = ModelTypes['PaginatedCapitalInvestsPaginationResult']
export const investsPaginationSelector = Selector('PaginatedCapitalInvestsPaginationResult')(rawInvestsPaginationSelector)

// Пагинированный селектор для долгов
const rawDebtsPaginationSelector = { ...paginationSelector, items: rawDebtSelector }
const _validateDebts: MakeAllFieldsRequired<ValueTypes['PaginatedCapitalDebtsPaginationResult']> = rawDebtsPaginationSelector
export type debtsPaginationModel = ModelTypes['PaginatedCapitalDebtsPaginationResult']
export const debtsPaginationSelector = Selector('PaginatedCapitalDebtsPaginationResult')(rawDebtsPaginationSelector)

// Пагинированный селектор для результатов
const rawResultsPaginationSelector = { ...paginationSelector, items: rawResultSelector }
const _validateResults: MakeAllFieldsRequired<ValueTypes['PaginatedCapitalResultsPaginationResult']> = rawResultsPaginationSelector
export type resultsPaginationModel = ModelTypes['PaginatedCapitalResultsPaginationResult']
export const resultsPaginationSelector = Selector('PaginatedCapitalResultsPaginationResult')(rawResultsPaginationSelector)

// Пагинированный селектор для историй
const rawStoriesPaginationSelector = { ...paginationSelector, items: rawStorySelector }
const _validateStories: MakeAllFieldsRequired<ValueTypes['PaginatedCapitalStoriesPaginationResult']> = rawStoriesPaginationSelector
export type storiesPaginationModel = ModelTypes['PaginatedCapitalStoriesPaginationResult']
export const storiesPaginationSelector = Selector('PaginatedCapitalStoriesPaginationResult')(rawStoriesPaginationSelector)

// Пагинированный селектор для задач
const rawIssuesPaginationSelector = { ...paginationSelector, items: rawIssueSelector }
const _validateIssues: MakeAllFieldsRequired<ValueTypes['PaginatedCapitalIssuesPaginationResult']> = rawIssuesPaginationSelector
export type issuesPaginationModel = ModelTypes['PaginatedCapitalIssuesPaginationResult']
export const issuesPaginationSelector = Selector('PaginatedCapitalIssuesPaginationResult')(rawIssuesPaginationSelector)

// Пагинированный селектор для коммитов
const rawCommitsPaginationSelector = { ...paginationSelector, items: rawCommitSelector }
const _validateCommits: MakeAllFieldsRequired<ValueTypes['PaginatedCapitalCommitsPaginationResult']> = rawCommitsPaginationSelector
export type commitsPaginationModel = ModelTypes['PaginatedCapitalCommitsPaginationResult']
export const commitsPaginationSelector = Selector('PaginatedCapitalCommitsPaginationResult')(rawCommitsPaginationSelector)

// Пагинированный селектор для циклов
const rawCyclesPaginationSelector = { ...paginationSelector, items: rawCycleSelector }
const _validateCycles: MakeAllFieldsRequired<ValueTypes['PaginatedCapitalCyclesPaginationResult']> = rawCyclesPaginationSelector
export type cyclesPaginationModel = ModelTypes['PaginatedCapitalCyclesPaginationResult']
export const cyclesPaginationSelector = Selector('PaginatedCapitalCyclesPaginationResult')(rawCyclesPaginationSelector)

// Пагинированный селектор для расходов
const rawExpensesPaginationSelector = { ...paginationSelector, items: rawExpenseSelector }
const _validateExpenses: MakeAllFieldsRequired<ValueTypes['PaginatedCapitalExpensesPaginationResult']> = rawExpensesPaginationSelector
export type expensesPaginationModel = ModelTypes['PaginatedCapitalExpensesPaginationResult']
export const expensesPaginationSelector = Selector('PaginatedCapitalExpensesPaginationResult')(rawExpensesPaginationSelector)

// Пагинированный селектор для программных расходов
const rawProgramExpensesPaginationSelector = { ...paginationSelector, items: rawProgramExpenseSelector }
const _validateProgramExpenses: MakeAllFieldsRequired<ValueTypes['PaginatedCapitalProgramExpensesPaginationResult']> = rawProgramExpensesPaginationSelector
export type programExpensesPaginationModel = ModelTypes['PaginatedCapitalProgramExpensesPaginationResult']
export const programExpensesPaginationSelector = Selector('PaginatedCapitalProgramExpensesPaginationResult')(rawProgramExpensesPaginationSelector)

// Пагинированный селектор для записей времени
const rawTimeEntriesPaginationSelector = { ...paginationSelector, items: rawTimeEntrySelector }
const _validateTimeEntries: MakeAllFieldsRequired<ValueTypes['PaginatedCapitalTimeEntriesPaginationResult']> = rawTimeEntriesPaginationSelector
export type timeEntriesPaginationModel = ModelTypes['PaginatedCapitalTimeEntriesPaginationResult']
export const timeEntriesPaginationSelector = Selector('PaginatedCapitalTimeEntriesPaginationResult')(rawTimeEntriesPaginationSelector)

// Пагинированный селектор для агрегированных записей времени по задачам
const rawTimeEntriesByIssuesPaginationSelector = { ...paginationSelector, items: rawTimeEntriesByIssuesSelector }
const _validateTimeEntriesByIssues: MakeAllFieldsRequired<ValueTypes['PaginatedCapitalTimeEntriesByIssuesPaginationResult']> = rawTimeEntriesByIssuesPaginationSelector
export type timeEntriesByIssuesPaginationModel = ModelTypes['PaginatedCapitalTimeEntriesByIssuesPaginationResult']
export const timeEntriesByIssuesPaginationSelector = Selector('PaginatedCapitalTimeEntriesByIssuesPaginationResult')(rawTimeEntriesByIssuesPaginationSelector)

// Пагинированный селектор для сегментов
const rawSegmentsPaginationSelector = { ...paginationSelector, items: rawSegmentSelector }
const _validateSegments: MakeAllFieldsRequired<ValueTypes['PaginatedCapitalSegmentsPaginationResult']> = rawSegmentsPaginationSelector
export type segmentsPaginationModel = ModelTypes['PaginatedCapitalSegmentsPaginationResult']
export const segmentsPaginationSelector = Selector('PaginatedCapitalSegmentsPaginationResult')(rawSegmentsPaginationSelector)

// Пагинированный селектор для логов
const rawLogsPaginationSelector = { ...paginationSelector, items: rawLogSelector }
const _validateLogs: MakeAllFieldsRequired<ValueTypes['PaginatedCapitalLogsPaginationResult']> = rawLogsPaginationSelector
export type logsPaginationModel = ModelTypes['PaginatedCapitalLogsPaginationResult']
export const logsPaginationSelector = Selector('PaginatedCapitalLogsPaginationResult')(rawLogsPaginationSelector)
