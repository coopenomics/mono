import { Mutations, Queries, Zeus, type Types } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

const DEFECT_CATEGORY_LABELS: Record<string, string> = {
  [Zeus.MarketplaceReturnClaimDefectCategory.BROKEN]: 'Повреждено / сломано',
  [Zeus.MarketplaceReturnClaimDefectCategory.EXPIRED]: 'Истёк срок годности',
  [Zeus.MarketplaceReturnClaimDefectCategory.NOT_AS_DESCRIBED]: 'Не соответствует описанию',
  [Zeus.MarketplaceReturnClaimDefectCategory.WRONG_ITEM]: 'Не тот товар',
  [Zeus.MarketplaceReturnClaimDefectCategory.OTHER]: 'Другое',
};

// Человекочитаемая метка категории дефекта; для незнакомых значений возвращаем
// исходное (а не сырой enum «BROKEN» в UI заказчика и председателя).
export function defectCategoryLabel(category?: string | null): string {
  if (!category) return '';
  return DEFECT_CATEGORY_LABELS[category] ?? category;
}

export type MarketplaceReturnClaimView =
  Queries.Marketplace.ListMyReturnClaims.IOutput['marketplaceListMyReturnClaims'][number];

export type MarketplaceReturnClaimResultView =
  Mutations.Marketplace.CreateReturnClaim.IOutput['marketplaceCreateReturnClaim'];

export type MarketplaceGeneratedDocumentView = Types.Document.IGeneratedDocument;

export type IReturnClaimSignablePayloadInput =
  Queries.Marketplace.ReturnClaimSignablePayload.IInput['data'];

export type ICreateReturnClaimInput =
  Mutations.Marketplace.CreateReturnClaim.IInput['data'];

export async function listMyReturnClaims(): Promise<MarketplaceReturnClaimView[]> {
  const { [Queries.Marketplace.ListMyReturnClaims.name]: result } = await client.Query(
    Queries.Marketplace.ListMyReturnClaims.query,
    {},
  );
  return result;
}

export async function getReturnClaimSignablePayload(
  data: IReturnClaimSignablePayloadInput,
): Promise<MarketplaceGeneratedDocumentView> {
  const { [Queries.Marketplace.ReturnClaimSignablePayload.name]: result } = await client.Query(
    Queries.Marketplace.ReturnClaimSignablePayload.query,
    { variables: { data } },
  );
  return result;
}

export async function createReturnClaim(
  data: ICreateReturnClaimInput,
): Promise<MarketplaceReturnClaimResultView> {
  const { [Mutations.Marketplace.CreateReturnClaim.name]: result } = await client.Mutation(
    Mutations.Marketplace.CreateReturnClaim.mutation,
    { variables: { data } },
  );
  return result;
}
