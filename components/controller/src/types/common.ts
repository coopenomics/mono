import { IEntrepreneurData, IGeneratedDocument, IIndividualData, IOrganizationData } from '@coopenomics/factory';
import { Cooperative, SovietContract } from 'cooptypes';
import type { IDelta } from '@coopenomics/extension-kit/sync';
import type { InnerChainActionRecord as IAction } from '@coopenomics/innercoop';

// Дельта таблицы блокчейна описана в каркасе синхронизации: с неё начинается
// работа мапперов и синкеров, а каркас живёт в пакете, чтобы расширения могли
// наследоваться от него за пределами монолита. Здесь — реэкспорт, чтобы
// исторический путь `~/types/common` продолжал работать и описание было одно.
export type { IDelta };

export type IGetResponse<T> = Cooperative.Document.IGetResponse<T>;

export interface IGetActions<T> {
  results: IAction[];
  page: number;
  limit: number;
}

export interface IGetTables<T> {
  results: IDelta[];
  page: number;
  limit: number;
}

/**
 * Действие цепи живёт в контракте `@coopenomics/innercoop`: его читают
 * расширения, следящие за своим контрактом. Здесь оно доступно под привычным
 * ядру именем — и используется тут же, поэтому импорт с ре-экспортом, а не
 * сквозной `export from`.
 */
export type { IAction };

export type IExtendedTable = IDelta;

export interface IExtendedAction extends IAction {
  user: IIndividualData | IEntrepreneurData | IOrganizationData | null;
}

export interface IComplexStatement {
  action: IExtendedAction;
  document: IGeneratedDocument;
}

export interface IComplexDecision {
  action: IExtendedAction;
  document: IGeneratedDocument;
  votes_for: IExtendedAction[];
  votes_against: IExtendedAction[];
}

export interface IComplexAct {
  action?: IExtendedAction;
  document?: IGeneratedDocument;
}

export interface IComplexDocument {
  statement: IComplexStatement;
  decision: IComplexDecision;
  acts: IComplexAct[];
}

export interface IGetComplexDocuments {
  results: IComplexDocument[];
  page: number;
  limit: number;
}

export interface IAgenda {
  row: SovietContract.Tables.Decisions.IDecision;
  action: IAction;
}

export interface IComplexAgenda extends IAgenda {
  document: IComplexDocument;
}

export interface IBCAction<T> {
  account: string;
  name: string;
  authorization: [
    {
      actor: string;
      permission: string;
    }
  ];
  data: T;
}
