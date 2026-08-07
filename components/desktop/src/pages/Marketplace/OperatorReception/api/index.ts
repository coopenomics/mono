import { Classes, Mutations, Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import type {
  MarketplaceAplReceptionView,
  SignedDocumentInput,
} from '../../OffererPendingAplReceptions/api';

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

// Входные типы — строго из SDK (IInput['data']); функции принимают `data`
// целиком и передают его в `variables: { data }` без разворачивания полей.
export type AplReceptionChairmanSignablePayloadsInput =
  Queries.Marketplace.AplReceptionChairmanSignablePayloads.IInput['data'];
export type ListAplReceptionsByBranameInput =
  Queries.Marketplace.ListAplReceptionsByBraname.IInput['data'];
export type SignAplReceptionAsChairmanInput =
  Mutations.Marketplace.SignAplReceptionAsChairman.IInput['data'];
export type ListExpressPickupsByBranameInput =
  Queries.Marketplace.ListExpressPickupsByBraname.IInput['data'];
export type ListSupplierPickupOrdersInput =
  Queries.Marketplace.ListSupplierPickupOrders.IInput['data'];
export type CreateAplReceptionInput = Mutations.Marketplace.CreateAplReception.IInput['data'];
export type CreateExpressReceptionInput = Mutations.Marketplace.CreateExpressReception.IInput['data'];
export type CancelAplReceptionInput = Mutations.Marketplace.CancelAplReception.IInput['data'];

export async function fetchChairmanSignablePayloads(
  data: AplReceptionChairmanSignablePayloadsInput,
): Promise<MarketplaceDocumentAggregateView[]> {
  const { [Queries.Marketplace.AplReceptionChairmanSignablePayloads.name]: result } =
    await client.Query(Queries.Marketplace.AplReceptionChairmanSignablePayloads.query, {
      variables: { data },
    });
  // Backend всегда возвращает rawDocument; в Zeus оно опционально — фиксируем как обязательное.
  return result as MarketplaceDocumentAggregateView[];
}

export async function listAplReceptionsByBraname(
  data: ListAplReceptionsByBranameInput,
): Promise<MarketplaceAplReceptionView[]> {
  const { [Queries.Marketplace.ListAplReceptionsByBraname.name]: result } = await client.Query(
    Queries.Marketplace.ListAplReceptionsByBraname.query,
    { variables: { data } },
  );
  // Zeus отдаёт ID/DateTime как unknown; сужаем скаляры до строк во view-типе.
  return result as MarketplaceAplReceptionView[];
}

export async function createAplReception(
  data: CreateAplReceptionInput,
): Promise<Mutations.Marketplace.CreateAplReception.IOutput['marketplaceCreateAplReception']> {
  const { [Mutations.Marketplace.CreateAplReception.name]: result } = await client.Mutation(
    Mutations.Marketplace.CreateAplReception.mutation,
    { variables: { data } },
  );
  return result;
}

export async function cancelAplReception(
  data: CancelAplReceptionInput,
): Promise<Mutations.Marketplace.CancelAplReception.IOutput['marketplaceCancelAplReception']> {
  const { [Mutations.Marketplace.CancelAplReception.name]: result } = await client.Mutation(
    Mutations.Marketplace.CancelAplReception.mutation,
    { variables: { data } },
  );
  return result;
}

export async function signAsChairman(
  data: SignAplReceptionAsChairmanInput,
): Promise<Mutations.Marketplace.SignAplReceptionAsChairman.IOutput['marketplaceSignAplReceptionAsChairman']> {
  const { [Mutations.Marketplace.SignAplReceptionAsChairman.name]: result } = await client.Mutation(
    Mutations.Marketplace.SignAplReceptionAsChairman.mutation,
    { variables: { data } },
  );
  return result;
}

export interface SignReceptionsChairmanResult {
  done: number;
  errors: { receptionId: string; error: unknown }[];
}

/**
 * Эпик 19: оприходование одного заказа, уходящее вместе с закрывающей подписью,
 * — наклеенная этикетка и место хранения. Место — ровно одно из двух: бокс либо
 * ячейка напрямую (негабарит).
 *
 * И то, и другое планируется ДО подписи: председатель проходит шаги маркировки
 * и раскладки, а подпись закрывает приёмку уже вместе с их результатом. Иначе
 * оприходование распадалось бы на «подписал» и «дошёл до конца», и первое
 * происходило бы без второго.
 */
export interface ChairmanPlacement {
  order_id: string;
  container_id?: string | null;
  cell_id?: string | null;
  barcode_value?: string | null;
  /**
   * Сколько принятого по заказу кладут в это место; null — всё количество.
   * Заказ раскладывается по нескольким местам строкой на каждое: то, что не
   * влезло в один бокс, уходит в следующий.
   */
  quantity?: number | null;
}

/**
 * Закрывающая подпись председателя по группе приёмок (зеркало
 * signReceptionGroupAsSupplier). По каждой приёмке — отдельная мутация
 * (блокчейн не проведёт всю поставку одной tx), идут параллельно; ошибка по
 * одной не теряет уже подписанные — копится по-актно, остальные продолжаются.
 * Внутри приёмки подпись поверх подписи поставщика тем же ключом активной
 * сессии, документ не перегенерируется.
 *
 * Оприходование (Эпик 19) едет тем же вызовом: backend валидирует места ДО
 * отправки в цепь, поэтому подписанного акта с неразмещаемым имуществом не
 * возникает. Каждому акту уходят только ЕГО размещения — на чужой `order_id`
 * сервер отвечает отказом, а акты подписываются параллельно и независимо.
 */
export async function signReceptionGroupAsChairman(
  receptions: Pick<MarketplaceAplReceptionView, 'id' | 'fact_quantity_per_order'>[],
  wif: string,
  username: string,
  onProgress?: (done: number) => void,
  placements: ChairmanPlacement[] = [],
): Promise<SignReceptionsChairmanResult> {
  const signer = new Classes.Document(wif);
  let done = 0;
  const errors: { receptionId: string; error: unknown }[] = [];
  await Promise.all(
    receptions.map(async (r) => {
      try {
        const aggregates = await fetchChairmanSignablePayloads({ apl_reception_id: r.id });
        if (aggregates.length === 0) {
          throw new Error('Backend не вернул ни одного акта для закрывающей подписи.');
        }
        const signed_documents: SignedDocumentInput[] = [];
        for (const aggregate of aggregates) {
          const signed = await signer.signDocument(aggregate.rawDocument, username, 2, [
            aggregate.document,
          ]);
          signed_documents.push(signed);
        }
        const ownOrderIds = new Set(r.fact_quantity_per_order.map((f) => f.order_id));
        const ownPlacements = placements.filter((p) => ownOrderIds.has(p.order_id));
        await signAsChairman({
          apl_reception_id: r.id,
          signed_documents,
          ...(ownPlacements.length ? { placements: ownPlacements } : {}),
        });
        done += 1;
        onProgress?.(done);
      } catch (error) {
        errors.push({ receptionId: r.id, error });
      }
    }),
  );
  return { done, errors };
}

/** Story 14.2: поставщики с принятыми заказами, ожидающими самовывоза на КУ. */
export type MarketplaceExpressPickupCandidateView =
  Queries.Marketplace.ListExpressPickupsByBraname.IOutput['marketplaceListExpressPickupsByBraname'][number];

export async function listExpressPickupsByBraname(
  data: ListExpressPickupsByBranameInput,
): Promise<MarketplaceExpressPickupCandidateView[]> {
  const { [Queries.Marketplace.ListExpressPickupsByBraname.name]: result } = await client.Query(
    Queries.Marketplace.ListExpressPickupsByBraname.query,
    { variables: { data } },
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
  data: ListSupplierPickupOrdersInput,
): Promise<MarketplaceSupplierPickupOrderView[]> {
  const { [Queries.Marketplace.ListSupplierPickupOrders.name]: result } = await client.Query(
    Queries.Marketplace.ListSupplierPickupOrders.query,
    { variables: { data } },
  );
  return result as MarketplaceSupplierPickupOrderView[];
}

export async function createExpressReception(
  data: CreateExpressReceptionInput,
): Promise<Mutations.Marketplace.CreateExpressReception.IOutput['marketplaceCreateExpressReception']> {
  const { [Mutations.Marketplace.CreateExpressReception.name]: result } = await client.Mutation(
    Mutations.Marketplace.CreateExpressReception.mutation,
    { variables: { data } },
  );
  return result;
}
