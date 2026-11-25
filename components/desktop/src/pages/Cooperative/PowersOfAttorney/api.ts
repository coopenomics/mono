import { client } from 'src/shared/api/client';
import { Queries } from '@coopenomics/sdk';

export type IPowersOfAttorneyInput = Queries.Ku.GetPowersOfAttorney.IInput;
export type IPowersOfAttorneyPage = Queries.Ku.GetPowersOfAttorney.IOutput[typeof Queries.Ku.GetPowersOfAttorney.name];
export type IPowerOfAttorney = IPowersOfAttorneyPage['items'][number];

/** Реестр доверенностей кооператива — вкладка реестра документов совета. */
export async function loadPowersOfAttorney(input: IPowersOfAttorneyInput): Promise<IPowersOfAttorneyPage> {
  const { [Queries.Ku.GetPowersOfAttorney.name]: result } = await client.Query(Queries.Ku.GetPowersOfAttorney.query, {
    variables: input,
  });
  return result;
}

/** Таблица учёта доверенностей в ленте изменений (код расширения участков). */
export const POWERS_OF_ATTORNEY_LIVE_TABLES = [{ code: 'trustee', table: 'ku_powers_of_attorney' }];
