import { Mutations, Queries, Zeus } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

const DEFECT_CATEGORY_LABELS: Record<string, string> = {
  [Zeus.MarketplaceReturnClaimDefectCategory.BROKEN]: 'Повреждено / сломано',
  [Zeus.MarketplaceReturnClaimDefectCategory.EXPIRED]: 'Истёк срок годности',
  [Zeus.MarketplaceReturnClaimDefectCategory.NOT_AS_DESCRIBED]: 'Не соответствует описанию',
  [Zeus.MarketplaceReturnClaimDefectCategory.WRONG_ITEM]: 'Не тот товар',
  [Zeus.MarketplaceReturnClaimDefectCategory.OTHER]: 'Другое',
};

// Человекочитаемая метка категории дефекта; для незнакомых значений возвращаем
// исходное (а не сырой enum «BROKEN» в UI председателя КУ).
export function defectCategoryLabel(category?: string | null): string {
  if (!category) return '';
  return DEFECT_CATEGORY_LABELS[category] ?? category;
}

type _RawReturnClaim =
  Queries.Marketplace.ListReturnClaimsByBraname.IOutput['marketplaceListReturnClaimsByBraname'][number];

/** DateTime из Zeus приходит как `unknown`; дату создания переопределяем на строку для UI. */
export type MarketplaceReturnClaimView = Omit<_RawReturnClaim, 'created_at'> & {
  created_at: string;
};

export type MarketplaceReturnClaimResultView =
  Mutations.Marketplace.ApproveReturnVisit.IOutput['marketplaceApproveReturnVisit'];

export type IListReturnClaimsByBranameInput =
  Queries.Marketplace.ListReturnClaimsByBraname.IInput['data'];

export type IApproveReturnVisitInput =
  Mutations.Marketplace.ApproveReturnVisit.IInput['data'];

export type IRejectReturnRemoteInput =
  Mutations.Marketplace.RejectReturnRemote.IInput['data'];

export type IAcceptReturnAtVisitInput =
  Mutations.Marketplace.AcceptReturnAtVisit.IInput['data'];

export type IRejectReturnAtVisitInput =
  Mutations.Marketplace.RejectReturnAtVisit.IInput['data'];

/** Агрегат документа: тело + подпись пайщика. Председатель со-подписывает поверх, не перегенерируя документ. */
type _RawChairmanSignablePayload =
  Queries.Marketplace.ReturnClaimChairmanSignablePayload.IOutput['marketplaceReturnClaimChairmanSignablePayload'];

export type MarketplaceReturnClaimDocumentAggregateView = Omit<_RawChairmanSignablePayload, 'rawDocument'> & {
  rawDocument: NonNullable<_RawChairmanSignablePayload['rawDocument']>;
};

export async function fetchChairmanReturnSignablePayload(
  claim_id: string,
): Promise<MarketplaceReturnClaimDocumentAggregateView> {
  const { [Queries.Marketplace.ReturnClaimChairmanSignablePayload.name]: result } = await client.Query(
    Queries.Marketplace.ReturnClaimChairmanSignablePayload.query,
    { variables: { claim_id } },
  );
  // Backend всегда возвращает rawDocument; в Zeus оно опционально — фиксируем как обязательное.
  return result as MarketplaceReturnClaimDocumentAggregateView;
}

export async function listReturnClaimsByBraname(
  data: IListReturnClaimsByBranameInput,
): Promise<MarketplaceReturnClaimView[]> {
  const { [Queries.Marketplace.ListReturnClaimsByBraname.name]: result } = await client.Query(
    Queries.Marketplace.ListReturnClaimsByBraname.query,
    { variables: { data } },
  );
  // Zeus отдаёт DateTime как unknown; сужаем дату создания до строки во view-типе.
  return result as MarketplaceReturnClaimView[];
}

export async function approveReturnVisit(
  data: IApproveReturnVisitInput,
): Promise<MarketplaceReturnClaimResultView> {
  const { [Mutations.Marketplace.ApproveReturnVisit.name]: result } = await client.Mutation(
    Mutations.Marketplace.ApproveReturnVisit.mutation,
    { variables: { data } },
  );
  return result;
}

export async function rejectReturnRemote(
  data: IRejectReturnRemoteInput,
): Promise<MarketplaceReturnClaimResultView> {
  const { [Mutations.Marketplace.RejectReturnRemote.name]: result } = await client.Mutation(
    Mutations.Marketplace.RejectReturnRemote.mutation,
    { variables: { data } },
  );
  return result;
}

export async function acceptReturnAtVisit(
  data: IAcceptReturnAtVisitInput,
): Promise<MarketplaceReturnClaimResultView> {
  const { [Mutations.Marketplace.AcceptReturnAtVisit.name]: result } = await client.Mutation(
    Mutations.Marketplace.AcceptReturnAtVisit.mutation,
    { variables: { data } },
  );
  return result;
}

export type IHandBackReturnInput = Mutations.Marketplace.HandBackReturn.IInput['data'];

/** Оператор выдал имущество обратно: после отказа совета либо по истечении срока ожидания. */
export async function handBackReturn(data: IHandBackReturnInput): Promise<MarketplaceReturnClaimResultView> {
  const { [Mutations.Marketplace.HandBackReturn.name]: result } = await client.Mutation(
    Mutations.Marketplace.HandBackReturn.mutation,
    { variables: { data } },
  );
  return result as MarketplaceReturnClaimResultView;
}

export async function rejectReturnAtVisit(
  data: IRejectReturnAtVisitInput,
): Promise<MarketplaceReturnClaimResultView> {
  const { [Mutations.Marketplace.RejectReturnAtVisit.name]: result } = await client.Mutation(
    Mutations.Marketplace.RejectReturnAtVisit.mutation,
    { variables: { data } },
  );
  return result;
}
