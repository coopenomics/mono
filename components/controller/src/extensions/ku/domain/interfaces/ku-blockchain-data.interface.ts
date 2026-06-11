import type { BranchContract } from 'cooptypes';
import type { IBaseDatabaseData } from '~/shared/sync/interfaces/base-database.interface';

/**
 * Интерфейс данных решения собрания участка из блокчейна (таблица decisions контракта branch)
 */
export type IKuDecisionBlockchainData = BranchContract.Tables.Decisions.IDecision;

/**
 * Интерфейс данных вопроса повестки из блокчейна (таблица decisionq контракта branch)
 */
export type IKuDecisionQuestionBlockchainData = BranchContract.Tables.DecisionQuestions.IDecisionQuestion;

/**
 * Интерфейс данных заявки доверенного из блокчейна (таблица trustreqs контракта branch)
 */
export type IKuTrustRequestBlockchainData = BranchContract.Tables.TrustReqs.ITrustRequest;

/**
 * Интерфейсы данных из базы данных
 */
export type IKuDecisionDatabaseData = IBaseDatabaseData;
export type IKuDecisionQuestionDatabaseData = IBaseDatabaseData;
export type IKuTrustRequestDatabaseData = IBaseDatabaseData;
