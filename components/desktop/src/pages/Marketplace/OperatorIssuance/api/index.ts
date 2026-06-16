import { Mutations, Queries, type Types } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

/**
 * Снапшот фактической выдачи (соответствует MarketplaceOrderIssuanceFactSnapshot
 * из schema.gql + IssuanceFactSnapshotSelector из orderSelector). Тип берём из
 * ленты выдач оператора — единственного запроса заказов в контексте выдачи
 * (member-запрос «готов к получению» убран вместе с legacy-путём).
 */
export type MarketplaceOrderIssuanceFactView =
  Queries.Marketplace.ListIssuancesByBraname.IOutput['marketplaceListIssuancesByBraname'][number]['issuance_fact'];

/**
 * Представление заказа в контексте выдачи — производное от типа Zeus SDK через
 * select из orderSelector (полный набор колонок Order вместе с полями выдачи).
 */
type _RawOrderIssuance =
  Queries.Marketplace.ListIssuancesByBraname.IOutput['marketplaceListIssuancesByBraname'][number];

export type MarketplaceOrderIssuanceView = Omit<_RawOrderIssuance, 'created_at'> & {
  created_at: string;
};

export type SignedDocumentInput = Types.Document.ISignedDocumentInput;
export type MarketplaceGeneratedDocumentView = Types.Document.IGeneratedDocument;

// Входные типы — строго из SDK (IInput['data']); функции принимают `data`
// целиком и передают его в `variables: { data }` без разворачивания полей.
export type ListIssuancesByBranameInput = Queries.Marketplace.ListIssuancesByBraname.IInput['data'];
export type IssueActChairmanSignablePayloadInput =
  Queries.Marketplace.IssueActChairmanSignablePayload.IInput['data'];

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

/**
 * Превью акта выдачи для подписи ОПЕРАТОРОМ КУ первой подписью (signiss1).
 * Оператор подписывает его и кладёт в бандл (createStockProposal) — на цепь акт
 * уходит только при контрподписи пайщика в marketplaceFinalizeStockIssuance.
 */
export async function getChairmanSignablePayload(
  data: IssueActChairmanSignablePayloadInput,
): Promise<MarketplaceGeneratedDocumentView> {
  const { [Queries.Marketplace.IssueActChairmanSignablePayload.name]: result } =
    await client.Query(Queries.Marketplace.IssueActChairmanSignablePayload.query, {
      variables: { data },
    });
  return result as MarketplaceGeneratedDocumentView;
}

// ── Единый бандл выдачи: заказы + докладка со склада (requirement 76) ─────────

/** Предложение/бандл выдачи (заказы и/или докладка со склада кооператива). */
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

/** Строка корзины докладки для подготовки актов оператору (offer_id + quantity). */
export type StockIssuancePayloadInput = Queries.Marketplace.StockIssuancePayloads.IInput['data'];
/** Строка к подписи оператором: order_hash + АПП-выдачи (signiss1_document). */
export type IStockIssuanceOperatorLine =
  Queries.Marketplace.StockIssuancePayloads.IOutput['marketplaceStockIssuancePayloads'][number];

/**
 * Нагрузка к ОДНОЙ подписи пайщика: по строке — order_hash и подписанный
 * оператором АПП-выдачи (signiss1_aggregate, для контрподписи получения), плюс
 * ОДНО Заявление о конвертации на весь дефицит (convert_document пустой —
 * членских средств хватает, подписывать нужно только сами акты).
 */
export type IStockProposalAcceptPayload =
  Queries.Marketplace.StockProposalSignablePayloads.IOutput['marketplaceStockProposalSignablePayloads'];

export type IStockFinalizeInput = Mutations.Marketplace.FinalizeStockIssuance.IInput['data'];
/** Строка финализации (order_hash + контрподписанный пайщиком signiss2-акт). */
export type IStockFinalizeOrderLine = IStockFinalizeInput['order_lines'][number];
/** Подписанное единое Заявление о конвертации (если был дефицит). */
export type IStockConvertSigned = NonNullable<IStockFinalizeInput['signed_convert']>;

/** Акты приёма-передачи к подписи оператором при формировании докладки. */
export async function getStockIssuancePayloads(
  data: StockIssuancePayloadInput,
): Promise<IStockIssuanceOperatorLine[]> {
  const { [Queries.Marketplace.StockIssuancePayloads.name]: result } = await client.Query(
    Queries.Marketplace.StockIssuancePayloads.query,
    { variables: { data } },
  );
  return result as IStockIssuanceOperatorLine[];
}

export async function getStockProposalSignablePayloads(
  proposal_id: string,
): Promise<IStockProposalAcceptPayload> {
  const data: Queries.Marketplace.StockProposalSignablePayloads.IInput['data'] = { proposal_id };
  const { [Queries.Marketplace.StockProposalSignablePayloads.name]: result } = await client.Query(
    Queries.Marketplace.StockProposalSignablePayloads.query,
    { variables: { data } },
  );
  return result as IStockProposalAcceptPayload;
}

/**
 * Пайщик одной подписью утверждает бандл выдачи: по строкам — контрподписанные
 * signiss2-акты, при дефиците — единое подписанное Заявление о конвертации.
 */
export async function finalizeStockIssuance(
  proposal_id: string,
  order_lines: IStockFinalizeOrderLine[],
  signed_convert?: IStockConvertSigned | null,
): Promise<{ proposal: MarketplaceStockProposalView; order_ids: string[] }> {
  const data: IStockFinalizeInput = {
    proposal_id,
    order_lines,
    signed_convert: signed_convert ?? null,
  };
  const { [Mutations.Marketplace.FinalizeStockIssuance.name]: result } = await client.Mutation(
    Mutations.Marketplace.FinalizeStockIssuance.mutation,
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
