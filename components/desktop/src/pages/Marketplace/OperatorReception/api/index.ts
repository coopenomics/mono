import { Mutations, Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import type { MarketplaceAplReceptionView, SignedDocumentInput } from '../../OffererPendingAplReceptions/api';

export type { MarketplaceAplReceptionView, SignedDocumentInput } from '../../OffererPendingAplReceptions/api';

/**
 * Агрегат документа: исходный документ (rawDocument) + документ с уже
 * наложенной подписью поставщика (document). Председатель накладывает
 * закрывающую подпись поверх, не перегенерируя документ.
 */
type _RawDocumentAggregate =
  Queries.Marketplace.AplReceptionChairmanSignablePayloads.IOutput['marketplaceAplReceptionChairmanSignablePayloads'][number];

export type MarketplaceDocumentAggregateView = Omit<_RawDocumentAggregate, 'rawDocument'> & {
  rawDocument: NonNullable<_RawDocumentAggregate['rawDocument']>;
};

export async function fetchChairmanSignablePayloads(
  apl_reception_id: string,
): Promise<MarketplaceDocumentAggregateView[]> {
  const { [Queries.Marketplace.AplReceptionChairmanSignablePayloads.name]: result } =
    await client.Query(Queries.Marketplace.AplReceptionChairmanSignablePayloads.query, {
      variables: { data: { apl_reception_id } },
    });
  // Backend всегда возвращает rawDocument; в Zeus оно опционально — фиксируем как обязательное.
  return result as MarketplaceDocumentAggregateView[];
}

export async function listAplReceptionsByBraname(braname: string): Promise<MarketplaceAplReceptionView[]> {
  const { [Queries.Marketplace.ListAplReceptionsByBraname.name]: result } = await client.Query(
    Queries.Marketplace.ListAplReceptionsByBraname.query,
    { variables: { data: { braname } } },
  );
  // Zeus отдаёт ID/DateTime как unknown; сужаем скаляры до строк во view-типе.
  return result as MarketplaceAplReceptionView[];
}

export type CreateAplReceptionVariables =
  Mutations.Marketplace.CreateAplReception.IInput['data'];

export async function createAplReception(
  data: CreateAplReceptionVariables,
): Promise<Mutations.Marketplace.CreateAplReception.IOutput['marketplaceCreateAplReception']> {
  const { [Mutations.Marketplace.CreateAplReception.name]: result } = await client.Mutation(
    Mutations.Marketplace.CreateAplReception.mutation,
    { variables: { data } },
  );
  return result;
}

export async function signAsChairman(
  apl_reception_id: string,
  signed_documents: SignedDocumentInput[],
): Promise<Mutations.Marketplace.SignAplReceptionAsChairman.IOutput['marketplaceSignAplReceptionAsChairman']> {
  const { [Mutations.Marketplace.SignAplReceptionAsChairman.name]: result } = await client.Mutation(
    Mutations.Marketplace.SignAplReceptionAsChairman.mutation,
    { variables: { data: { apl_reception_id, signed_documents } } },
  );
  return result;
}
