import { sendPOST } from 'src/shared/api/axios';
import type {
  MarketplaceCategoryView,
  MarketplaceCreateOfferPayload,
  MarketplaceCreateOfferResult,
} from '../types';

/**
 * Story 4.7: raw GraphQL для публикации Offer'а с cycle_type.
 *
 * Техдолг как и в MarketplaceCatalog/api: до регенерации Zeus в
 * `@coopenomics/sdk` используем raw POST `/v1/graphql`. Переписать
 * на типизированные `Mutations.Marketplace.CreateOffer` позже.
 */

const CREATE_OFFER_MUTATION = `
  mutation MarketplaceCreateOffer($input: MarketplaceCreateOfferInput!) {
    marketplaceCreateOffer(input: $input) {
      id
      product_name
      cycle_type
      status
    }
  }
`;

const LIST_CATEGORIES_QUERY = `
  query MarketplaceListCategories {
    marketplaceListCategories {
      id
      display_name
      sort_order
    }
  }
`;

export async function createOffer(
  payload: MarketplaceCreateOfferPayload
): Promise<MarketplaceCreateOfferResult> {
  const body = await sendPOST('/v1/graphql', {
    query: CREATE_OFFER_MUTATION,
    variables: { input: payload },
  });
  if (body?.errors?.length) {
    throw new Error(body.errors[0].message);
  }
  return body.data.marketplaceCreateOffer;
}

export async function fetchCategories(): Promise<MarketplaceCategoryView[]> {
  const body = await sendPOST('/v1/graphql', { query: LIST_CATEGORIES_QUERY });
  if (body?.errors?.length) {
    throw new Error(body.errors[0].message);
  }
  return body.data.marketplaceListCategories;
}
