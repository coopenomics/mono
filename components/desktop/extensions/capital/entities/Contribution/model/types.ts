import type { Queries } from '@coopenomics/sdk';

export type IGetContributionsInput = Queries.Capital.GetContributions.IInput;
export type IContributionsPage = Queries.Capital.GetContributions.IOutput[typeof Queries.Capital.GetContributions.name];
export type IContribution = IContributionsPage['items'][number];
