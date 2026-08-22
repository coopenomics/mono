import { client } from 'src/shared/api/client';
import { Mutations, Queries } from '@coopenomics/sdk';
import type { IFavorite, IFavoriteInput, IGetFavoritesInput } from '../model/types';

async function loadFavorites(filter: IGetFavoritesInput): Promise<IFavorite[]> {
  const { [Queries.Capital.GetFavorites.name]: output } = await client.Query(
    Queries.Capital.GetFavorites.query,
    { variables: { filter } },
  );
  return output;
}

async function addFavorite(data: IFavoriteInput): Promise<IFavorite[]> {
  const { [Mutations.Capital.AddFavorite.name]: output } = await client.Mutation(
    Mutations.Capital.AddFavorite.mutation,
    { variables: { data } },
  );
  return output;
}

async function removeFavorite(data: IFavoriteInput): Promise<IFavorite[]> {
  const { [Mutations.Capital.RemoveFavorite.name]: output } = await client.Mutation(
    Mutations.Capital.RemoveFavorite.mutation,
    { variables: { data } },
  );
  return output;
}

export const api = { loadFavorites, addFavorite, removeFavorite };
