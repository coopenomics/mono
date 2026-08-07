import type { Queries, Mutations } from '@coopenomics/sdk';

/**
 * Базовый тип участника из SDK, расширенный параметрами документов.
 *
 * NonNullable обязателен: Zeus помечает КАЖДОЕ корневое поле запроса как
 * опциональное, поэтому без него тип означал бы «участник или его отсутствие».
 * Как элемент списка это бессмысленно — в выдаче не бывает пустых участников,
 * — и порождало «'row' is possibly undefined» на каждом обращении в шаблонах.
 */
export type IContributor = NonNullable<
  Queries.Capital.GetContributor.IOutput[typeof Queries.Capital.GetContributor.name]
>;

export type IContributorsPagination =
  Queries.Capital.GetContributors.IOutput[typeof Queries.Capital.GetContributors.name];

export type IGetContributorInput =
  Queries.Capital.GetContributor.IInput['data'];
export type IGetContributorsInput = Queries.Capital.GetContributors.IInput;
export type IRegisterContributorInput =
  Mutations.Capital.RegisterContributor.IInput['data'];
export type IRegisterContributorOutput =
  Mutations.Capital.RegisterContributor.IOutput[typeof Mutations.Capital.RegisterContributor.name];

/**
 * Тип для импорта участника (обновлен для новых полей)
 * Локальный тип до пересборки SDK
 */
export interface IImportContributorInput {
  coopname: string;
  username: string;
  contribution_amount: string;
  contributor_contract_number: string;
  contributor_contract_created_at: string;
  blagorost_agreement_number: string;
  blagorost_agreement_created_at: string;
  memo?: string;
}

export type IImportContributorOutput =
  Mutations.Capital.ImportContributor.IOutput[typeof Mutations.Capital.ImportContributor.name];
