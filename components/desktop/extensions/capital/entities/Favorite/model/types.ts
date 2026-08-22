import { Mutations, Queries, Zeus } from '@coopenomics/sdk';

export type IFavorite = Zeus.ModelTypes['CapitalFavorite'];
export type IFavoriteTargetType = Zeus.CapitalFavoriteTargetType;
export type IFavoriteInput = Mutations.Capital.AddFavorite.IInput['data'];
export type IGetFavoritesInput = Queries.Capital.GetFavorites.IInput['filter'];
