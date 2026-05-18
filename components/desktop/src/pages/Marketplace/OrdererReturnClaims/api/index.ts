import { Mutations, Queries, type Types } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

/**
 * Эпик 7 — orderer-стол: заявления текущего пайщика на гарантийный возврат.
 * Типы выведены из Zeus SDK (без `as unknown as`, без raw GraphQL-строк) по
 * правилу `feedback_graphql_no_raw_strings_desktop`.
 */

export type MarketplaceReturnClaimView =
  Queries.Marketplace.ListMyReturnClaims.IOutput['marketplaceListMyReturnClaims'][number];

export type MarketplaceReturnClaimResultView =
  Mutations.Marketplace.CreateReturnClaim.IOutput['marketplaceCreateReturnClaim'];

export type SignedStatementInput = Types.Document.ISignedDocumentInput;

export type MarketplaceGeneratedDocumentView = Types.Document.IGeneratedDocument;

export interface ReturnClaimPhotoUploadInput {
  base64: string;
  mime_type: string;
}

export async function listMyReturnClaims(): Promise<MarketplaceReturnClaimView[]> {
  const { [Queries.Marketplace.ListMyReturnClaims.name]: result } = await client.Query(
    Queries.Marketplace.ListMyReturnClaims.query,
    {},
  );
  return result;
}

export async function getReturnClaimSignablePayload(
  order_id: string,
  actual_quantity?: number,
): Promise<MarketplaceGeneratedDocumentView> {
  const { [Queries.Marketplace.ReturnClaimSignablePayload.name]: result } = await client.Query(
    Queries.Marketplace.ReturnClaimSignablePayload.query,
    { variables: { data: { order_id, actual_quantity } } },
  );
  return result as MarketplaceGeneratedDocumentView;
}

export interface CreateReturnClaimArgs {
  order_id: string;
  reason_text: string;
  defect_category?: string;
  actual_quantity?: number;
  signed_statement: SignedStatementInput;
  photos: ReturnClaimPhotoUploadInput[];
}

export async function createReturnClaim(
  args: CreateReturnClaimArgs,
): Promise<MarketplaceReturnClaimResultView> {
  const { [Mutations.Marketplace.CreateReturnClaim.name]: result } = await client.Mutation(
    Mutations.Marketplace.CreateReturnClaim.mutation,
    {
      variables: {
        data: {
          order_id: args.order_id,
          reason_text: args.reason_text,
          defect_category: args.defect_category,
          actual_quantity: args.actual_quantity,
          signed_statement: args.signed_statement,
          photos: args.photos,
        },
      },
    },
  );
  return result;
}
