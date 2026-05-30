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

/** Story 14.2: поставщики с принятыми заказами, ожидающими самовывоза на КУ. */
export type MarketplaceExpressPickupCandidateView =
  Queries.Marketplace.ListExpressPickupsByBraname.IOutput['marketplaceListExpressPickupsByBraname'][number];

export async function listExpressPickupsByBraname(
  braname: string,
): Promise<MarketplaceExpressPickupCandidateView[]> {
  const { [Queries.Marketplace.ListExpressPickupsByBraname.name]: result } = await client.Query(
    Queries.Marketplace.ListExpressPickupsByBraname.query,
    { variables: { data: { braname } } },
  );
  return result;
}

/**
 * Эпик 14 (агрегирующая приёмка): единицы имущества поставщика, ожидающие
 * приёмки на КУ — задекларированные в партии (SUPPLY_PREPARED) и добор по
 * акцепту (ACCEPTED). Единый базис страницы приёмки по account-bound коду.
 */
export type MarketplaceSupplierPickupOrderView =
  Queries.Marketplace.ListSupplierPickupOrders.IOutput['marketplaceListSupplierPickupOrders'][number];

export async function listSupplierPickupOrders(
  braname: string,
  offerer_account: string,
): Promise<MarketplaceSupplierPickupOrderView[]> {
  const { [Queries.Marketplace.ListSupplierPickupOrders.name]: result } = await client.Query(
    Queries.Marketplace.ListSupplierPickupOrders.query,
    { variables: { data: { braname, offerer_account } } },
  );
  return result as MarketplaceSupplierPickupOrderView[];
}

export type CreateExpressReceptionVariables =
  Mutations.Marketplace.CreateExpressReception.IInput['data'];

export async function createExpressReception(
  data: CreateExpressReceptionVariables,
): Promise<Mutations.Marketplace.CreateExpressReception.IOutput['marketplaceCreateExpressReception']> {
  const { [Mutations.Marketplace.CreateExpressReception.name]: result } = await client.Mutation(
    Mutations.Marketplace.CreateExpressReception.mutation,
    { variables: { data } },
  );
  return result;
}
