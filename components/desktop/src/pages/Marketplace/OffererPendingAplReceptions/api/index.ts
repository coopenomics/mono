import { Classes, Mutations, Queries, type Types } from '@coopenomics/sdk';
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

export interface SignReceptionsSupplierResult {
  /** Сколько актов поставки успешно подписано первой подписью. */
  done: number;
  /** Акты, по которым подпись не прошла, с исходной ошибкой — для алертов вызывающего. */
  errors: { receptionId: string; error: unknown }[];
}

/**
 * On-chain первая подпись поставщика (`signsupp`) по всем актам одной поставки.
 *
 * Последовательно, с изоляцией ошибок: сбой по одному акту не теряет уже
 * подписанные. По каждому акту — свой документ(ы) и своя транзакция (цикл по
 * receptions, внутри — цикл по payloads). Алерты/прогресс — на стороне
 * вызывающего (диалог стола поставщика ИЛИ глобальный гейт подписи на месте):
 * `onProgress(done)` вызывается после каждого успешно подписанного акта.
 *
 * Единый источник логики подписи — чтобы стол и гейт не расходились в крипто-
 * флоу (DRY: вынесено из SignAplReceptionDialog при добавлении гейта Фазы 1).
 */
export async function signReceptionGroupAsSupplier(
  receptions: Pick<MarketplaceAplReceptionView, 'id' | 'offerer_account'>[],
  wif: string,
  onProgress?: (done: number) => void,
): Promise<SignReceptionsSupplierResult> {
  const signer = new Classes.Document(wif);
  let done = 0;
  const errors: { receptionId: string; error: unknown }[] = [];
  for (const r of receptions) {
    try {
      const payloads = await fetchSupplierSignablePayloads(r.id);
      if (payloads.length === 0) {
        throw new Error('Backend не вернул ни одного акта для подписи.');
      }
      const signed_documents: SignedDocumentInput[] = [];
      for (const payload of payloads) {
        const signed = await signer.signDocument(payload, r.offerer_account, 1);
        signed_documents.push(signed);
      }
      await signAsSupplier(r.id, signed_documents);
      done += 1;
      onProgress?.(done);
    } catch (error) {
      errors.push({ receptionId: r.id, error });
    }
  }
  return { done, errors };
}
