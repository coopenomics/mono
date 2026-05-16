import { sendPOST } from 'src/shared/api/axios';
import type {
  MarketplaceCategoryView,
  MarketplaceCreateOfferPayload,
  MarketplaceCreateOfferResult,
} from '../types';

// TODO техдолг marketplace2: переписать на Mutations.Marketplace.* из @coopenomics/sdk
// после общего cleanup'а legacy GraphQL операций. Сейчас regen Zeus
// (generate-schema + generate-client) блокируется устаревшими legacy resolver'ами
// (`application/marketplace/*` + `domain/marketplace/*` + соответствующие
// SDK-мутации в `components/sdk/src/mutations/marketplace/`) — они ссылаются
// на cooptypes-actions, исчезнувшие после переименования cooplace→marketplace.
// Чистка отдельной story в backlog'е cleanup'а маркетплейса.

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
