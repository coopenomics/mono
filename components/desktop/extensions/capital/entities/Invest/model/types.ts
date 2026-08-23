import type { Queries, Mutations } from '@coopenomics/sdk';

export type IInvest =
  Queries.Capital.GetInvest.IOutput[typeof Queries.Capital.GetInvest.name];
export type IInvestsPagination =
  Queries.Capital.GetInvests.IOutput[typeof Queries.Capital.GetInvests.name];

export type IGetInvestInput = Queries.Capital.GetInvest.IInput['data'];
export type IGetInvestsInput = Queries.Capital.GetInvests.IInput;
export type ICreateProjectInvestInput =
  Mutations.Capital.CreateProjectInvest.IInput['data'];
export type ICreateProjectInvestOutput =
  Mutations.Capital.CreateProjectInvest.IOutput[typeof Mutations.Capital.CreateProjectInvest.name];

export type IAllocateFundsInput = Mutations.Capital.AllocateFunds.IInput['data'];
export type IAllocateFundsOutput =
  Mutations.Capital.AllocateFunds.IOutput[typeof Mutations.Capital.AllocateFunds.name];

export type IDeallocateFundsInput = Mutations.Capital.DeallocateFunds.IInput['data'];
export type IDeallocateFundsOutput =
  Mutations.Capital.DeallocateFunds.IOutput[typeof Mutations.Capital.DeallocateFunds.name];

export type IDeallocationLimitInput = Queries.Capital.GetDeallocationLimit.IInput['data'];
export type IDeallocationLimit =
  Queries.Capital.GetDeallocationLimit.IOutput[typeof Queries.Capital.GetDeallocationLimit.name];

