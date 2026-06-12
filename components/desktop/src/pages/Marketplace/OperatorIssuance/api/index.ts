import { Classes, Mutations, Queries, type Types } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

/**
 * Снапшот фактической выдачи (соответствует MarketplaceOrderIssuanceFactSnapshot
 * из schema.gql + IssuanceFactSnapshotSelector из orderSelector).
 */
export type MarketplaceOrderIssuanceFactView =
  Queries.Marketplace.ListMyReadyToReceive.IOutput['marketplaceListMyReadyToReceive'][number]['issuance_fact'];

/**
 * Представление заказа в контексте выдачи — производное от типа Zeus
 * SDK через select из orderSelector (полный набор колонок Order вместе
 * с полями выдачи Эпика 6).
 */
type _RawOrderIssuance =
  Queries.Marketplace.ListMyReadyToReceive.IOutput['marketplaceListMyReadyToReceive'][number];

export type MarketplaceOrderIssuanceView = Omit<_RawOrderIssuance, 'created_at'> & {
  created_at: string;
};

export type MarketplaceIssuanceResultView =
  Mutations.Marketplace.OpenIssuance.IOutput['marketplaceOpenIssuance'];

export type SignedDocumentInput = Types.Document.ISignedDocumentInput;
export type MarketplaceGeneratedDocumentView = Types.Document.IGeneratedDocument;

/**
 * Агрегат документа выдачи: исходный документ (rawDocument) + документ с
 * уже наложенной подписью председателя (document). Заказчик накладывает
 * финальную подпись поверх, не перегенерируя документ.
 */
type _RawIssuanceAggregate =
  Queries.Marketplace.IssueActOrdererSignablePayload.IOutput['marketplaceIssueActOrdererSignablePayload'];

/**
 * Backend всегда возвращает исходный документ (`rawDocument`) в агрегате
 * подписываемой выдачи — заказчик накладывает финальную подпись поверх него.
 * В Zeus поле помечено опциональным; фиксируем как обязательное и
 * ненулевое для строгой типизации подписи.
 */
export type MarketplaceIssuanceAggregateView = Omit<_RawIssuanceAggregate, 'rawDocument'> & {
  rawDocument: NonNullable<_RawIssuanceAggregate['rawDocument']>;
};

// Входные типы — строго из SDK (IInput['data']); функции принимают `data`
// целиком и передают его в `variables: { data }` без разворачивания полей.
export type ListIssuancesByBranameInput = Queries.Marketplace.ListIssuancesByBraname.IInput['data'];
export type IssueActChairmanSignablePayloadInput =
  Queries.Marketplace.IssueActChairmanSignablePayload.IInput['data'];
export type IssueActOrdererSignablePayloadInput =
  Queries.Marketplace.IssueActOrdererSignablePayload.IInput['data'];
export type OpenIssuanceInput = Mutations.Marketplace.OpenIssuance.IInput['data'];
export type FinalizeIssuanceInput = Mutations.Marketplace.FinalizeIssuance.IInput['data'];

export async function listIssuancesByBraname(
  data: ListIssuancesByBranameInput,
): Promise<MarketplaceOrderIssuanceView[]> {
  const { [Queries.Marketplace.ListIssuancesByBraname.name]: result } = await client.Query(
    Queries.Marketplace.ListIssuancesByBraname.query,
    { variables: { data } },
  );
  // Zeus отдаёт DateTime как unknown; сужаем скалярную дату до строки во view-типе.
  return result as MarketplaceOrderIssuanceView[];
}

export async function listMyReadyToReceive(): Promise<MarketplaceOrderIssuanceView[]> {
  const { [Queries.Marketplace.ListMyReadyToReceive.name]: result } = await client.Query(
    Queries.Marketplace.ListMyReadyToReceive.query,
    {},
  );
  return result as MarketplaceOrderIssuanceView[];
}

export async function getChairmanSignablePayload(
  data: IssueActChairmanSignablePayloadInput,
): Promise<MarketplaceGeneratedDocumentView> {
  const { [Queries.Marketplace.IssueActChairmanSignablePayload.name]: result } =
    await client.Query(Queries.Marketplace.IssueActChairmanSignablePayload.query, {
      variables: { data },
    });
  return result as MarketplaceGeneratedDocumentView;
}

export async function getOrdererSignablePayload(
  data: IssueActOrdererSignablePayloadInput,
): Promise<MarketplaceIssuanceAggregateView> {
  const { [Queries.Marketplace.IssueActOrdererSignablePayload.name]: result } =
    await client.Query(Queries.Marketplace.IssueActOrdererSignablePayload.query, {
      variables: { data },
    });
  // Backend всегда возвращает rawDocument; в Zeus оно опционально — фиксируем как обязательное.
  return result as MarketplaceIssuanceAggregateView;
}

export async function openIssuance(
  data: OpenIssuanceInput,
): Promise<MarketplaceIssuanceResultView> {
  const { [Mutations.Marketplace.OpenIssuance.name]: result } = await client.Mutation(
    Mutations.Marketplace.OpenIssuance.mutation,
    { variables: { data } },
  );
  return result;
}

/**
 * Финальную подпись заказчик ставит сам в своём кабинете своим ключом — он
 * лишь подтверждает уже сформированный акт. Фактическое количество и сторона
 * кооператива берутся backend'ом из заказа (зафиксированы оператором при
 * открытии), поэтому здесь передаём только подписанный документ.
 */
export async function finalizeIssuance(
  data: FinalizeIssuanceInput,
): Promise<MarketplaceIssuanceResultView> {
  const { [Mutations.Marketplace.FinalizeIssuance.name]: result } = await client.Mutation(
    Mutations.Marketplace.FinalizeIssuance.mutation,
    { variables: { data } },
  );
  return result;
}

// ── Склад кооператива: докладка (requirement 76) ─────────────────────────

/** Предложение имущества со склада кооператива (двухфазная докладка). */
export type MarketplaceStockProposalView =
  Queries.Marketplace.ListStockProposals.IOutput['marketplaceListStockProposals'][number];

export type ListStockProposalsInput = Queries.Marketplace.ListStockProposals.IInput['data'];
export type CreateStockProposalInput = Mutations.Marketplace.CreateStockProposal.IInput['data'];
export type CancelStockOrderInput = Mutations.Marketplace.CancelStockOrder.IInput['data'];

export async function listStockProposals(
  data?: ListStockProposalsInput,
): Promise<MarketplaceStockProposalView[]> {
  const { [Queries.Marketplace.ListStockProposals.name]: result } = await client.Query(
    Queries.Marketplace.ListStockProposals.query,
    { variables: { data } },
  );
  return result as MarketplaceStockProposalView[];
}

export async function createStockProposal(
  data: CreateStockProposalInput,
): Promise<MarketplaceStockProposalView> {
  const { [Mutations.Marketplace.CreateStockProposal.name]: result } = await client.Mutation(
    Mutations.Marketplace.CreateStockProposal.mutation,
    { variables: { data } },
  );
  return result as MarketplaceStockProposalView;
}

export async function cancelStockProposal(proposal_id: string): Promise<MarketplaceStockProposalView> {
  const data: Mutations.Marketplace.CancelStockProposal.IInput['data'] = { proposal_id };
  const { [Mutations.Marketplace.CancelStockProposal.name]: result } = await client.Mutation(
    Mutations.Marketplace.CancelStockProposal.mutation,
    { variables: { data } },
  );
  return result as MarketplaceStockProposalView;
}

/** Заявления о конвертации к подписи по строкам предложения со склада. */
export type IStockProposalSignableLine =
  Queries.Marketplace.StockProposalSignablePayloads.IOutput['marketplaceStockProposalSignablePayloads'][number];

/** Подписанная строка принятия предложения (offer_id + order_hash + заявление). */
export type IStockProposalSignedLine = NonNullable<
  Mutations.Marketplace.AcceptStockProposal.IInput['data']['lines']
>[number];

export async function getStockProposalSignablePayloads(
  proposal_id: string,
): Promise<IStockProposalSignableLine[]> {
  const data: Queries.Marketplace.StockProposalSignablePayloads.IInput['data'] = { proposal_id };
  const { [Queries.Marketplace.StockProposalSignablePayloads.name]: result } = await client.Query(
    Queries.Marketplace.StockProposalSignablePayloads.query,
    { variables: { data } },
  );
  return result as IStockProposalSignableLine[];
}

export async function acceptStockProposal(
  proposal_id: string,
  lines: IStockProposalSignedLine[],
): Promise<{ proposal: MarketplaceStockProposalView; order_ids: string[] }> {
  const data: Mutations.Marketplace.AcceptStockProposal.IInput['data'] = { proposal_id, lines };
  const { [Mutations.Marketplace.AcceptStockProposal.name]: result } = await client.Mutation(
    Mutations.Marketplace.AcceptStockProposal.mutation,
    { variables: { data } },
  );
  return result as { proposal: MarketplaceStockProposalView; order_ids: string[] };
}

export async function declineStockProposal(proposal_id: string): Promise<MarketplaceStockProposalView> {
  const data: Mutations.Marketplace.DeclineStockProposal.IInput['data'] = { proposal_id };
  const { [Mutations.Marketplace.DeclineStockProposal.name]: result } = await client.Mutation(
    Mutations.Marketplace.DeclineStockProposal.mutation,
    { variables: { data } },
  );
  return result as MarketplaceStockProposalView;
}

/** Отмена заказа со склада кооператива до открытия выдачи (откат докладки). */
export async function cancelStockOrder(data: CancelStockOrderInput): Promise<void> {
  await client.Mutation(Mutations.Marketplace.CancelStockOrder.mutation, { variables: { data } });
}

export interface FinalizeOrdererResult {
  /** Сколько позиций успешно получено финальной подписью заказчика. */
  ok: number;
  /** Позиции, по которым подпись не прошла, с исходной ошибкой — для алертов вызывающего. */
  failed: { order: MarketplaceOrderIssuanceView; error: unknown }[];
}

/**
 * Финальная подпись заказчика (`signiss2`) по всем позициям пункта выдачи.
 *
 * На каждый акт накладывает подпись №2 поверх подписи председателя (документ
 * НЕ перегенерируется — берётся агрегат rawDocument + document с первой
 * подписью). ПАРАЛЛЕЛЬНО: у каждого заказа свой хэш — на цепи это разные
 * документы, гонок подписи нет, и все signiss2 уходят почти в один блок (а не
 * по ~0.5с друг за другом). Сбой по одной позиции не теряет уже полученные.
 * `onProgress(ok)` — по мере завершения (JS однопоточный, счётчик безопасен).
 *
 * Единый источник логики финальной подписи получения — чтобы карточка «Моих
 * заказов» и глобальный гейт подписи на месте не расходились в крипто-флоу
 * (DRY: вынесено из OrdererFinalizeIssuanceDialog при добавлении гейта Фазы 1).
 */
export async function finalizeOrdererIssuance(
  orders: MarketplaceOrderIssuanceView[],
  wif: string,
  username: string,
  onProgress?: (ok: number) => void,
): Promise<FinalizeOrdererResult> {
  const signer = new Classes.Document(wif);
  let ok = 0;
  const failed: { order: MarketplaceOrderIssuanceView; error: unknown }[] = [];
  await Promise.all(
    orders.map(async (o) => {
      try {
        const aggregate = await getOrdererSignablePayload({ order_id: o.id });
        const fullSigned = await signer.signDocument(aggregate.rawDocument, username, 2, [
          aggregate.document,
        ]);
        await finalizeIssuance({ order_id: o.id, signed_document: fullSigned });
        ok += 1;
        onProgress?.(ok);
      } catch (error) {
        console.error('finalizeIssuance failed for order', o.id, error);
        failed.push({ order: o, error });
      }
    }),
  );
  return { ok, failed };
}
