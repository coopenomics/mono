import { Classes, Mutations, Queries, type Types } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

/**
 * Акты приёма-передачи (АПП) поставки — сторона поставщика.
 *
 * Раньше жило в `pages/Marketplace/OffererPendingAplReceptions/api`, но у
 * поставщика больше нет отдельной страницы «Подпись передачи»: подпись —
 * действие на карточке партии во «Входящих заказах». Читают эти операции трое
 * (входящие заказы, стол ПВЗ, глобальный гейт подписи на месте), поэтому по
 * правилу DRY они и переехали в entity, а не остались в api одной из страниц.
 */

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
 * ПАРАЛЛЕЛЬНО по актам, с изоляцией ошибок: сбой по одному акту не теряет уже
 * подписанные. У каждого акта свой документ(ы) и своя транзакция (разные хэши —
 * гонок на цепи нет), поэтому подписи уходят почти в один блок. Внутри акта
 * payloads подписываются по очереди (один акт — одна транзакция). Алерты/
 * прогресс — на стороне вызывающего (диалог стола поставщика ИЛИ глобальный
 * гейт подписи на месте): `onProgress(done)` — по мере завершения (JS
 * однопоточный, счётчик безопасен).
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
  await Promise.all(
    receptions.map(async (r) => {
      try {
        const payloads = await fetchSupplierSignablePayloads(r.id);
        const signed_documents: SignedDocumentInput[] = [];
        for (const payload of payloads) {
          const signed = await signer.signDocument(payload, r.offerer_account, 1);
          signed_documents.push(signed);
        }
        // Пустой список payload = все позиции акта сняты оператором при приёмке
        // (некондиция): подписывать нечего. Mutation с пустыми документами уводит
        // акт в отмену (полный возврат заказчикам, поставщику без штрафа) — это
        // легитимный путь, не ошибка.
        await signAsSupplier(r.id, signed_documents);
        done += 1;
        onProgress?.(done);
      } catch (error) {
        errors.push({ receptionId: r.id, error });
      }
    }),
  );
  return { done, errors };
}
