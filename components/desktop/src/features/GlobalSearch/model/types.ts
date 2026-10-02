import type { Queries } from '@coopenomics/sdk';

export type IGlobalSearchInput = Queries.Search.GlobalSearch.IInput['data'];
export type IGlobalSearchGroup =
  Queries.Search.GlobalSearch.IOutput[typeof Queries.Search.GlobalSearch.name][number];
