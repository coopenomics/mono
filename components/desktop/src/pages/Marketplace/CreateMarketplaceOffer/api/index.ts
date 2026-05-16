import { Mutations, Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import type {
  MarketplaceCategoryView,
  MarketplaceCreateOfferPayload,
  MarketplaceCreateOfferResult,
} from '../types';

export async function createOffer(
  payload: MarketplaceCreateOfferPayload
): Promise<MarketplaceCreateOfferResult> {
  const result = await client.Mutation(Mutations.Marketplace.CreateOffer.mutation, {
    variables: { input: payload },
  });
  return result[Mutations.Marketplace.CreateOffer.name] as MarketplaceCreateOfferResult;
}

export async function fetchCategories(): Promise<MarketplaceCategoryView[]> {
  const result = await client.Query(Queries.Marketplace.ListCategories.query);
  return (result[Queries.Marketplace.ListCategories.name] ?? []) as MarketplaceCategoryView[];
}
