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
 * Оператор отмечает заказ готовым к выдаче: имущество поступило на участок,
 * заказчику уходит «приходите заберите». Подписи нет — статус заказа меняется
 * на «готов к получению». Мутация на один заказ — карточка получателя
 * вызывает её циклом по своим позициям.
 */
export async function readyIssue(order_id: string): Promise<MarketplaceOrderIssuanceView> {
  const data: Mutations.Marketplace.ReadyIssue.IInput['data'] = { order_id };
  const { [Mutations.Marketplace.ReadyIssue.name]: result } = await client.Mutation(
    Mutations.Marketplace.ReadyIssue.mutation,
    { variables: { data } },
  );
  return result as MarketplaceOrderIssuanceView;
}

// ── Сага выдачи (компонент 68): заявление → совет → акт → закрытие ──────────

/** Ход выдачи по заказу: этап, чей ход, документы. */
export type MarketplaceIssuanceSagaView =
  Queries.Marketplace.ListIssuanceSagas.IOutput['marketplaceListIssuanceSagas'][number];
export type ListIssuanceSagasInput = NonNullable<Queries.Marketplace.ListIssuanceSagas.IInput['data']>;
export type IssuanceClosePayloadView =
  Queries.Marketplace.IssuanceClosePayload.IOutput['marketplaceIssuanceClosePayload'];
export type SignIssuanceActInput = Mutations.Marketplace.CloseIssuance.IInput['data'];

export async function listIssuanceSagas(data?: ListIssuanceSagasInput): Promise<MarketplaceIssuanceSagaView[]> {
  const { [Queries.Marketplace.ListIssuanceSagas.name]: result } = await client.Query(
    Queries.Marketplace.ListIssuanceSagas.query,
    { variables: { data } },
  );
  return result as MarketplaceIssuanceSagaView[];
}

export async function getIssuanceSaga(order_id: string): Promise<MarketplaceIssuanceSagaView | null> {
  const { [Queries.Marketplace.IssuanceSaga.name]: result } = await client.Query(
    Queries.Marketplace.IssuanceSaga.query,
    { variables: { data: { order_id } } },
  );
  return (result ?? null) as MarketplaceIssuanceSagaView | null;
}

/** Акт с подписью заказчика — к закрывающей подписи оператора. */
export async function getIssuanceClosePayload(order_id: string): Promise<IssuanceClosePayloadView> {
  const { [Queries.Marketplace.IssuanceClosePayload.name]: result } = await client.Query(
    Queries.Marketplace.IssuanceClosePayload.query,
    { variables: { data: { order_id } } },
  );
  return result as IssuanceClosePayloadView;
}

/** Закрывающая подпись оператора: имущество выдано, деньги проведены. */
export async function closeIssuance(data: SignIssuanceActInput): Promise<MarketplaceIssuanceSagaView> {
  const { [Mutations.Marketplace.CloseIssuance.name]: result } = await client.Mutation(
    Mutations.Marketplace.CloseIssuance.mutation,
    { variables: { data } },
  );
  return result as MarketplaceIssuanceSagaView;
}

/** Заявление о возврате паевого взноса имуществом (1113) к подписи заказчиком. */
export async function getIssuanceStatementPayload(order_id: string): Promise<MarketplaceGeneratedDocumentView> {
  const { [Queries.Marketplace.IssuanceStatementPayload.name]: result } = await client.Query(
    Queries.Marketplace.IssuanceStatementPayload.query,
    { variables: { data: { order_id } } },
  );
  return result as MarketplaceGeneratedDocumentView;
}

/**
 * Заявление о конвертации паевого взноса в членский (1110) на довзнос по факту —
 * только когда выдаётся больше заказанного и членского кошелька «Стола заказов»
 * не хватает; иначе null и подписывать нечего.
 */
export async function getIssuanceConvertPayload(order_id: string): Promise<MarketplaceGeneratedDocumentView | null> {
  const { [Queries.Marketplace.IssuanceConvertPayload.name]: result } = await client.Query(
    Queries.Marketplace.IssuanceConvertPayload.query,
    { variables: { data: { order_id } } },
  );
  return (result ?? null) as MarketplaceGeneratedDocumentView | null;
}

export type SignIssuanceStatementInput = Mutations.Marketplace.SignIssuanceStatement.IInput['data'];

/** Заказчик подписал заявление: оно уходит в цепь и на повестку совета; ответ — сага после ответа робота. */
export async function signIssuanceStatement(data: SignIssuanceStatementInput): Promise<MarketplaceIssuanceSagaView> {
  const { [Mutations.Marketplace.SignIssuanceStatement.name]: result } = await client.Mutation(
    Mutations.Marketplace.SignIssuanceStatement.mutation,
    { variables: { data } },
  );
  return result as MarketplaceIssuanceSagaView;
}

/** Акт приёма-передачи (1115) к первой подписи заказчиком — после решения совета. */
export async function getIssuanceActPayload(order_id: string): Promise<MarketplaceGeneratedDocumentView> {
  const { [Queries.Marketplace.IssuanceActPayload.name]: result } = await client.Query(
    Queries.Marketplace.IssuanceActPayload.query,
    { variables: { data: { order_id } } },
  );
  return result as MarketplaceGeneratedDocumentView;
}

/** Заказчик подписал акт: осталась закрывающая подпись оператора. */
export async function signIssuanceAct(data: SignIssuanceActInput): Promise<MarketplaceIssuanceSagaView> {
  const { [Mutations.Marketplace.SignIssuanceAct.name]: result } = await client.Mutation(
    Mutations.Marketplace.SignIssuanceAct.mutation,
    { variables: { data } },
  );
  return result as MarketplaceIssuanceSagaView;
}

/** Оператор снимает выдачу до решения совета / до акта: паевой взнос остаётся на месте. */
export async function cancelIssuance(order_id: string): Promise<MarketplaceIssuanceSagaView> {
  const { [Mutations.Marketplace.CancelIssuance.name]: result } = await client.Mutation(
    Mutations.Marketplace.CancelIssuance.mutation,
    { variables: { data: { order_id } } },
  );
  return result as MarketplaceIssuanceSagaView;
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

/** Строка корзины докладки для подготовки бандла (offer_id + quantity + упаковка). */
export type StockIssuancePayloadInput = Queries.Marketplace.StockIssuancePayloads.IInput['data'];
/** Строка подготовки докладки: order_hash будущего заказа, цена, упаковка. */
export type IStockIssuanceOperatorLine =
  Queries.Marketplace.StockIssuancePayloads.IOutput['marketplaceStockIssuancePayloads'][number];

/**
 * Нагрузка к ОДНОЙ подписи пайщика по бандлу: по строке — заказ (или будущий
 * заказ из остатка), заявление о возврате паевого взноса имуществом (1113) и,
 * если членского кошелька не хватает на взнос участка, заявление о
 * конвертации паевого в членский (1110) на недостающую часть.
 */
export type IStockProposalAcceptPayload =
  Queries.Marketplace.StockProposalSignablePayloads.IOutput['marketplaceStockProposalSignablePayloads'];

export type IStockFinalizeInput = Mutations.Marketplace.FinalizeStockIssuance.IInput['data'];
/** Строка подписания (order_hash + подписанные пайщиком заявления: 1113 и, если было выдано, 1110). */
export type IStockFinalizeOrderLine = IStockFinalizeInput['order_lines'][number];
/** Результат подписи бандла: бандл, заказы и саги выдачи по ним. */
export type IStockFinalizeResult =
  Mutations.Marketplace.FinalizeStockIssuance.IOutput['marketplaceFinalizeStockIssuance'];

/** Подготовка строк докладки при формировании бандла (без подписи оператора). */
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
 * Пайщик одной подписью подписывает заявления по всем строкам бандла. Ответ
 * несёт саги: если робот совета решил у стойки — следующий шаг (акт) сразу,
 * иначе — спокойное ожидание.
 */
export async function finalizeStockIssuance(
  proposal_id: string,
  order_lines: IStockFinalizeOrderLine[],
): Promise<IStockFinalizeResult> {
  const data: IStockFinalizeInput = { proposal_id, order_lines };
  const { [Mutations.Marketplace.FinalizeStockIssuance.name]: result } = await client.Mutation(
    Mutations.Marketplace.FinalizeStockIssuance.mutation,
    { variables: { data } },
  );
  return result as IStockFinalizeResult;
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

/** Подпись этапа саги выдачи для карточек стола оператора и «Моих заказов». */
export function issuanceStageDisplay(saga: { stage: string; decision_mode: string }): {
  label: string;
  variant: 'info' | 'warn' | 'pos' | 'neg' | 'neutral';
} {
  switch (saga.stage) {
    case 'FACT_FIXED':
      return { label: 'Ждём подпись заявления пайщиком', variant: 'warn' };
    case 'STATEMENT_SIGNED':
      return { label: 'Заявление подано в совет', variant: 'info' };
    case 'DECISION_PENDING':
      return {
        label: saga.decision_mode === 'MANUAL' ? 'На рассмотрении совета' : 'Ждём решение совета',
        variant: 'info',
      };
    case 'DECISION_AUTHORIZED':
      return { label: 'Совет согласовал — ждём подпись акта пайщиком', variant: 'warn' };
    case 'ACT1_SIGNED':
      return { label: 'Акт подписан — закрываем выдачу', variant: 'pos' };
    case 'CLOSED':
      return { label: 'Выдано', variant: 'pos' };
    case 'DECLINED':
      return { label: 'Совет отказал', variant: 'neg' };
    case 'CANCELLED':
      return { label: 'Выдача снята', variant: 'neutral' };
    default:
      return { label: saga.stage, variant: 'neutral' };
  }
}
