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

export async function listIssuancesByBraname(
  delivery_braname: string,
): Promise<MarketplaceOrderIssuanceView[]> {
  const { [Queries.Marketplace.ListIssuancesByBraname.name]: result } = await client.Query(
    Queries.Marketplace.ListIssuancesByBraname.query,
    { variables: { data: { delivery_braname } } },
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
  order_id: string,
): Promise<MarketplaceGeneratedDocumentView> {
  const { [Queries.Marketplace.IssueActChairmanSignablePayload.name]: result } =
    await client.Query(Queries.Marketplace.IssueActChairmanSignablePayload.query, {
      variables: { data: { order_id } },
    });
  return result as MarketplaceGeneratedDocumentView;
}

export async function getOrdererSignablePayload(
  order_id: string,
): Promise<MarketplaceIssuanceAggregateView> {
  const { [Queries.Marketplace.IssueActOrdererSignablePayload.name]: result } =
    await client.Query(Queries.Marketplace.IssueActOrdererSignablePayload.query, {
      variables: { data: { order_id } },
    });
  // Backend всегда возвращает rawDocument; в Zeus оно опционально — фиксируем как обязательное.
  return result as MarketplaceIssuanceAggregateView;
}

export async function openIssuance(
  order_id: string,
  signed_document: SignedDocumentInput,
): Promise<MarketplaceIssuanceResultView> {
  const { [Mutations.Marketplace.OpenIssuance.name]: result } = await client.Mutation(
    Mutations.Marketplace.OpenIssuance.mutation,
    { variables: { data: { order_id, signed_document } } },
  );
  return result;
}

export async function finalizeIssuance(
  order_id: string,
  actual_quantity: number,
  delivery_signer: string,
  signed_document: SignedDocumentInput,
): Promise<MarketplaceIssuanceResultView> {
  const { [Mutations.Marketplace.FinalizeIssuance.name]: result } = await client.Mutation(
    Mutations.Marketplace.FinalizeIssuance.mutation,
    {
      variables: {
        data: { order_id, actual_quantity, delivery_signer, signed_document },
      },
    },
  );
  return result;
}
