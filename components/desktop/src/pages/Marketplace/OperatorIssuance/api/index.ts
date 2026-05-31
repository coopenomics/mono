import { Mutations, Queries, type Types } from '@coopenomics/sdk';
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
