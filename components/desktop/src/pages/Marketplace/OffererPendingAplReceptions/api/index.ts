import { Mutations, Queries, type Types } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

type _RawAplReception =
  Queries.Marketplace.ListAplReceptionsAsSupplier.IOutput['marketplaceListAplReceptionsAsSupplier'][number];

/**
 * Zeus маппит GraphQL-скаляры ID/DateTime в `unknown`. Структуру и enum'ы
 * (status/variant) оставляем из Zeus-вывода, но скалярные поля-идентификаторы
 * и даты переопределяем на строгие строковые типы, чтобы потребители в UI
 * (slice по id, форматирование дат) типизировались без unknown.
 */
export type MarketplaceAplReceptionView = Omit<
  _RawAplReception,
  'id' | 'shipment_id' | 'cycle_id' | 'created_at' | 'updated_at' | 'supplier_signed_at' | 'chairman_signed_at'
> & {
  id: string;
  shipment_id: string;
  cycle_id: string;
  created_at: string;
  updated_at: string;
  supplier_signed_at: string | null;
  chairman_signed_at: string | null;
};

export type SignedDocumentInput = Types.Document.ISignedDocumentInput;
export type MarketplaceAplReceptionDocumentView = Types.Document.IGeneratedDocument;

export async function listAplReceptionsAsSupplier(): Promise<MarketplaceAplReceptionView[]> {
  const { [Queries.Marketplace.ListAplReceptionsAsSupplier.name]: result } = await client.Query(
    Queries.Marketplace.ListAplReceptionsAsSupplier.query,
    {},
  );
  // Zeus отдаёт ID/DateTime как unknown; сужаем скаляры до строк во view-типе.
  return result as MarketplaceAplReceptionView[];
}

export async function fetchSupplierSignablePayloads(
  apl_reception_id: string,
): Promise<MarketplaceAplReceptionDocumentView[]> {
  const { [Queries.Marketplace.AplReceptionSupplierSignablePayloads.name]: result } =
    await client.Query(Queries.Marketplace.AplReceptionSupplierSignablePayloads.query, {
      variables: { data: { apl_reception_id } },
    });
  return result;
}

export async function signAsSupplier(
  apl_reception_id: string,
  signed_documents: SignedDocumentInput[],
): Promise<{ apl_reception: MarketplaceAplReceptionView }> {
  const { [Mutations.Marketplace.SignAplReceptionAsSupplier.name]: result } =
    await client.Mutation(Mutations.Marketplace.SignAplReceptionAsSupplier.mutation, {
      variables: { data: { apl_reception_id, signed_documents } },
    });
  // Zeus отдаёт ID/DateTime как unknown; сужаем скаляры до строк во view-типе.
  return result as { apl_reception: MarketplaceAplReceptionView };
}
