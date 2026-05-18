import { Mutations, Queries, type Types } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

/**
 * Эпик 7 — operator-стол председателя КУ: заявления на гарантийный возврат
 * по своему ПВЗ. Mutations соответствуют четырём действиям председателя:
 *  - aprretrem  → marketplaceApproveReturnVisit
 *  - rejretrem  → marketplaceRejectReturnRemote
 *  - accretrn   → marketplaceAcceptReturnAtVisit  (compensating forward)
 *  - rejretrn   → marketplaceRejectReturnAtVisit
 */

export type MarketplaceReturnClaimView =
  Queries.Marketplace.ListReturnClaimsByBraname.IOutput['marketplaceListReturnClaimsByBraname'][number];

export type MarketplaceReturnClaimResultView =
  Mutations.Marketplace.ApproveReturnVisit.IOutput['marketplaceApproveReturnVisit'];

export type SignedDecisionInput = Types.Document.ISignedDocumentInput;

export interface ReturnClaimPhotoUploadInput {
  base64: string;
  mime_type: string;
}

export async function listReturnClaimsByBraname(
  delivery_braname: string,
): Promise<MarketplaceReturnClaimView[]> {
  const { [Queries.Marketplace.ListReturnClaimsByBraname.name]: result } = await client.Query(
    Queries.Marketplace.ListReturnClaimsByBraname.query,
    { variables: { data: { delivery_braname } } },
  );
  return result;
}

export async function approveReturnVisit(args: {
  claim_id: string;
  braname: string;
  comment: string;
  signed_decision?: SignedDecisionInput;
}): Promise<MarketplaceReturnClaimResultView> {
  const { [Mutations.Marketplace.ApproveReturnVisit.name]: result } = await client.Mutation(
    Mutations.Marketplace.ApproveReturnVisit.mutation,
    {
      variables: {
        data: {
          claim_id: args.claim_id,
          braname: args.braname,
          comment: args.comment,
          signed_decision: args.signed_decision,
        },
      },
    },
  );
  return result;
}

export async function rejectReturnRemote(args: {
  claim_id: string;
  braname: string;
  comment: string;
  signed_decision?: SignedDecisionInput;
}): Promise<MarketplaceReturnClaimResultView> {
  const { [Mutations.Marketplace.RejectReturnRemote.name]: result } = await client.Mutation(
    Mutations.Marketplace.RejectReturnRemote.mutation,
    {
      variables: {
        data: {
          claim_id: args.claim_id,
          braname: args.braname,
          comment: args.comment,
          signed_decision: args.signed_decision,
        },
      },
    },
  );
  return result;
}

export async function acceptReturnAtVisit(args: {
  claim_id: string;
  braname: string;
  inspection_result: string;
  scanned_barcode?: string;
  inspection_photos?: ReturnClaimPhotoUploadInput[];
  signed_decision?: SignedDecisionInput;
}): Promise<MarketplaceReturnClaimResultView> {
  const { [Mutations.Marketplace.AcceptReturnAtVisit.name]: result } = await client.Mutation(
    Mutations.Marketplace.AcceptReturnAtVisit.mutation,
    {
      variables: {
        data: {
          claim_id: args.claim_id,
          braname: args.braname,
          inspection_result: args.inspection_result,
          scanned_barcode: args.scanned_barcode,
          inspection_photos: args.inspection_photos,
          signed_decision: args.signed_decision,
        },
      },
    },
  );
  return result;
}

export async function rejectReturnAtVisit(args: {
  claim_id: string;
  braname: string;
  inspection_result: string;
  inspection_photos?: ReturnClaimPhotoUploadInput[];
  signed_decision?: SignedDecisionInput;
}): Promise<MarketplaceReturnClaimResultView> {
  const { [Mutations.Marketplace.RejectReturnAtVisit.name]: result } = await client.Mutation(
    Mutations.Marketplace.RejectReturnAtVisit.mutation,
    {
      variables: {
        data: {
          claim_id: args.claim_id,
          braname: args.braname,
          inspection_result: args.inspection_result,
          inspection_photos: args.inspection_photos,
          signed_decision: args.signed_decision,
        },
      },
    },
  );
  return result;
}
