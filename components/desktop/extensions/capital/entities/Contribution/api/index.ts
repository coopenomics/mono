import { client } from 'src/shared/api/client';
import { Queries } from '@coopenomics/sdk';
import type { IContributionsPage, IGetContributionsInput } from '../model';

/** История паевых взносов пайщика в программы Благороста (книга учёта). */
async function loadContributions(data: IGetContributionsInput): Promise<IContributionsPage> {
  const { [Queries.Capital.GetContributions.name]: output } = await client.Query(Queries.Capital.GetContributions.query, {
    variables: data,
  });
  return output;
}

export const api = { loadContributions };
