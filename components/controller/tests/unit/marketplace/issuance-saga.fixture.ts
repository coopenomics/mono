/**
 * Общая фикстура саги выдачи (паевая модель, компонент 68) для unit-тестов:
 * заказ, сага в нужном этапе, in-memory репозиторий саг и сборка сервиса из
 * моков. Криптопроверка подписей и разбор ответа цепи глушатся отдельно
 * (`stubSignatureChecks`) — тесты проверяют бизнес-правила, а не крипту.
 */
import { MarketplaceIssuanceService } from '~/extensions/marketplace/application/services/marketplace-issuance.service';
import { MarketplaceIssuanceSagaDomainEntity } from '~/extensions/marketplace/domain/entities/marketplace-issuance-saga.entity';
import {
  MarketplaceIssuanceSagaStages,
  type MarketplaceIssuanceSagaProps,
  type MarketplaceIssuanceSagaStage,
} from '~/extensions/marketplace/domain/entities/marketplace-issuance-saga.types';
import type { MarketplaceOrderDomainEntity } from '~/extensions/marketplace/domain/entities/marketplace-order.entity';
import type { MarketplaceIssuanceSagaDomainRepository } from '~/extensions/marketplace/domain/repositories/marketplace-issuance-saga.repository';
import type { MarketplaceAssetConfig } from '~/extensions/marketplace/application/services/marketplace-asset.config';

export const COOP = 'voskhod';

export function buildOrder(overrides: Partial<MarketplaceOrderDomainEntity> = {}): MarketplaceOrderDomainEntity {
  return {
    id: 'order-1',
    coopname: COOP,
    order_hash: 'h-order-1',
    orderer_account: 'orderer1',
    offer_id: 'offer-1',
    supplier_account: 'supplier1',
    delivery_braname: 'krg',
    quantity: 10,
    unit_of_measure: 'piece',
    package_size: 0,
    price_per_unit: '100.0000',
    total_cost: '1000.0000',
    status: 'READY_TO_RECEIVE',
    warranty_period_secs: 0,
    ...overrides,
  } as MarketplaceOrderDomainEntity;
}

export function buildSaga(overrides: Partial<MarketplaceIssuanceSagaProps> = {}): MarketplaceIssuanceSagaDomainEntity {
  const now = new Date();
  return new MarketplaceIssuanceSagaDomainEntity({
    id: 'saga-1',
    coopname: COOP,
    order_id: 'order-1',
    order_hash: 'h-order-1',
    proposal_id: null,
    member_account: 'orderer1',
    operator_account: 'chairkrg',
    braname: 'krg',
    stage: MarketplaceIssuanceSagaStages.FACT_FIXED,
    decision_mode: 'UNKNOWN',
    fact: { actual_quantity: 10, actual_unit_price: '100.0000', fact_cost: '1000.0000' },
    statement_document: null,
    protocol_document: null,
    act1_document: null,
    act2_document: null,
    act_document_hash: null,
    decision_id: null,
    tx_hashes: {},
    last_error: null,
    attempts: 0,
    decided_at: null,
    closed_at: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  } as MarketplaceIssuanceSagaProps);
}

/** In-memory репозиторий саг: хранит одну-две саги, честно применяет переходы «из этапа». */
export function buildSagaRepo(initial: MarketplaceIssuanceSagaDomainEntity[] = []) {
  const store = new Map(initial.map((s) => [s.id, s]));
  const active = (s: MarketplaceIssuanceSagaDomainEntity) => s.is_active;
  const patchOf = (s: MarketplaceIssuanceSagaDomainEntity, patch: Record<string, unknown>) =>
    buildSaga({ ...(s as unknown as MarketplaceIssuanceSagaProps), ...patch, updated_at: new Date() } as MarketplaceIssuanceSagaProps);
  const repo = {
    createOrReuse: jest.fn(async (input: Record<string, unknown>) => {
      const existing = [...store.values()].find((s) => s.order_id === input.order_id && active(s));
      if (existing) return existing;
      const created = buildSaga({ id: `saga-${store.size + 1}`, ...(input as Partial<MarketplaceIssuanceSagaProps>) });
      store.set(created.id, created);
      return created;
    }),
    findById: jest.fn(async (id: string) => store.get(id) ?? null),
    findByOrderHash: jest.fn(async (_c: string, hash: string) => [...store.values()].find((s) => s.order_hash === hash) ?? null),
    findActiveByOrderId: jest.fn(async (_c: string, order_id: string) => [...store.values()].find((s) => s.order_id === order_id && active(s)) ?? null),
    list: jest.fn(async () => [...store.values()]),
    findStale: jest.fn(async () => []),
    transition: jest.fn(async (id: string, from: MarketplaceIssuanceSagaStage | MarketplaceIssuanceSagaStage[], patch: Record<string, unknown>) => {
      const cur = store.get(id);
      if (!cur) return null;
      const allowed = Array.isArray(from) ? from : [from];
      if (!allowed.includes(cur.stage)) return null;
      const next = patchOf(cur, patch);
      store.set(id, next);
      return next;
    }),
    update: jest.fn(async (id: string, patch: Record<string, unknown>) => {
      const cur = store.get(id);
      if (!cur) throw new Error('saga not found');
      const next = patchOf(cur, patch);
      store.set(id, next);
      return next;
    }),
  } as unknown as jest.Mocked<MarketplaceIssuanceSagaDomainRepository>;
  return { repo, store };
}

export interface IssuanceMocks {
  orderRepo: any;
  sagaRepo: jest.Mocked<MarketplaceIssuanceSagaDomainRepository>;
  sagaStore: Map<string, MarketplaceIssuanceSagaDomainEntity>;
  inventoryRepo: any;
  offerRepo: any;
  chainPort: any;
  assetConfig: MarketplaceAssetConfig;
  documentPort: any;
  /** Конвертация по заявлению 1110: по умолчанию членского кошелька хватает — довзноса и заявления нет. */
  convertService: any;
  economyService: any;
  verificationPort: any;
  robotPort: any;
  eventBus: any;
  logger: any;
}

/** asset-строка «12.3400 RUB» → минимальные единицы (4 знака), без float. */
export function toUnits(value: string): bigint {
  const numeric = String(value).trim().split(/\s+/)[0] ?? '0';
  const [int, frac = ''] = numeric.split('.');
  return BigInt(int || '0') * 10_000n + BigInt((frac + '0000').slice(0, 4) || '0');
}

export function toAsset(units: bigint): string {
  const padded = units.toString().padStart(5, '0');
  return `${padded.slice(0, -4)}.${padded.slice(-4)} RUB`;
}

export function buildMocks(opts: {
  order?: MarketplaceOrderDomainEntity;
  sagas?: MarketplaceIssuanceSagaDomainEntity[];
  /** Принято на склад по заказу (для заказа поставщика) / зарезервировано (для заказа из остатка). */
  warehouse?: number;
  robotPort?: any;
  /** Остаток членского кошелька программы пайщика в минимальных единицах (по умолчанию — хватает на всё). */
  memberAvailableUnits?: bigint;
} = {}): IssuanceMocks {
  const order = opts.order ?? buildOrder();
  const warehouse = opts.warehouse ?? 10;
  const { repo: sagaRepo, store: sagaStore } = buildSagaRepo(opts.sagas ?? []);
  const orderRepo = {
    findById: jest.fn(async (id: string) => (id === order.id ? order : null)),
    applyReadyIssue: jest.fn(async () => buildOrder({ ...order, status: 'READY_TO_RECEIVE' })),
    applyIssuanceStatement: jest.fn(async () => order),
    applyIssuanceAuthorized: jest.fn(async () => order),
    applyIssuanceAct1: jest.fn(async () => order),
    applyIssuanceClosed: jest.fn(async () => buildOrder({ ...order, status: 'RECEIVED' })),
    applyIssuanceReset: jest.fn(async () => buildOrder({ ...order, status: 'READY_TO_RECEIVE' })),
  };
  const inventoryRepo = {
    sumOnWarehouseByOrders: jest.fn(async (_c: string, ids: string[]) => new Map(ids.map((id) => [id, warehouse]))),
    sumReservedByOrders: jest.fn(async (_c: string, ids: string[]) => new Map(ids.map((id) => [id, warehouse]))),
    detachRemainderToStock: jest.fn(async () => 0),
    finalizeReservedIssue: jest.fn(async () => ({ released: 0, issued_arrival_cost: '0.0000' })),
  };
  const offerRepo = { findById: jest.fn(async () => null) };
  const chainPort = {
    readyIssue: jest.fn(async () => ({ transaction: { id: 'tx-ready' } })),
    issueStmt: jest.fn(async () => ({ transaction: { id: 'tx-stmt' } })),
    issueAct1: jest.fn(async () => ({ transaction: { id: 'tx-act1' } })),
    issueAct2: jest.fn(async () => ({ transaction: { id: 'tx-act2' } })),
    cancelIssue: jest.fn(async () => ({ transaction: { id: 'tx-cancel' } })),
    markdown: jest.fn(async () => ({ transaction: { id: 'tx-md' } })),
    findCouncilDecisionByHash: jest.fn(async () => ({ id: 77 })),
  };
  const documentPort = {
    generate: jest.fn(async ({ data }: any) => ({ full_title: 'doc', html: '<html/>', hash: `hash-${data.registry_id}`, meta: data, binary: '' })),
    buildAggregate: jest.fn(async (doc: any) => ({ hash: doc.hash, rawDocument: { hash: doc.hash }, document: doc })),
  };
  const verificationPort = {
    checkRequired: jest.fn(async () => ({ passed: true, missing: [] })),
    getVerificationTypes: jest.fn(async () => []),
  };
  const logger = { setContext: jest.fn(), debug: jest.fn(), log: jest.fn(), error: jest.fn(), warn: jest.fn(), info: jest.fn() };
  const memberAvailable = opts.memberAvailableUnits ?? 1_000_000_000n;
  const economyService = {
    assetToUnits: jest.fn((v: string) => toUnits(v)),
    unitsToAsset: jest.fn((u: bigint) => toAsset(u)),
    getMembershipFeeContractPercent: jest.fn(async () => 300000),
    toHumanFeePercent: jest.fn((v: number) => (Number(v) * 100) / 1_000_000),
  };
  const convertService = {
    memberAvailableUnits: jest.fn(async () => memberAvailable),
    shortfallUnits: jest.fn((available: bigint, fee: bigint) => (fee > available ? fee - available : 0n)),
    planConversions: jest.fn((available: bigint, fees: bigint[]) => {
      let left = available;
      return fees.map((fee_units) => {
        const convert_units = fee_units > left ? fee_units - left : 0n;
        left = left + convert_units - fee_units;
        return { fee_units, convert_units };
      });
    }),
    generateStatement: jest.fn(async (input: any) => ({
      full_title: 'convert',
      html: '<html/>',
      hash: 'hash-1110',
      meta: {
        registry_id: 1110,
        order_hash: input.order_hash,
        amount: toAsset(input.body_units + input.fee_units),
        membership_fee: toAsset(input.fee_units),
        convert_amount: toAsset(input.convert_units),
        source: input.source,
      },
      binary: '',
    })),
    verifySigned: jest.fn((signed: any) => {
      if (!signed) throw new Error('Нет подписанного заявления о конвертации');
      return { hash: signed.hash ?? 'signed-1110', meta: JSON.stringify(signed.meta), signatures: signed.signatures ?? [] };
    }),
    emptyDocument: jest.fn(() => ({ hash: '0'.repeat(64), meta: '', signatures: [] })),
  };
  return {
    orderRepo,
    sagaRepo,
    sagaStore,
    inventoryRepo,
    offerRepo,
    chainPort,
    assetConfig: { symbol: 'RUB', decimals: 4 },
    documentPort,
    convertService,
    economyService,
    verificationPort,
    robotPort: opts.robotPort ?? null,
    eventBus: { emit: jest.fn() },
    logger,
  };
}

export function buildService(m: IssuanceMocks): MarketplaceIssuanceService {
  const service = new MarketplaceIssuanceService(
    m.orderRepo,
    m.sagaRepo,
    m.inventoryRepo,
    m.offerRepo,
    m.chainPort,
    m.assetConfig,
    m.documentPort,
    m.convertService,
    m.economyService,
    m.verificationPort,
    m.robotPort,
    m.eventBus,
    m.logger
  );
  return service;
}

/** Глушит криптопроверку подписей — здесь важно, ЧЬЯ подпись, а не насколько она валидна. */
export function stubSignatureChecks(service: MarketplaceIssuanceService): void {
  jest
    .spyOn(service as never as { verifyDocumentSignature: () => void }, 'verifyDocumentSignature')
    .mockImplementation(() => undefined);
}

/** Подписанный документ в форме входного DTO: мета + подписи. */
export function signedDoc(meta: Record<string, unknown>, signers: string[], overrides: Record<string, unknown> = {}) {
  return {
    version: '1.0.0',
    hash: 'H',
    doc_hash: 'doc-hash',
    meta_hash: 'meta-hash',
    meta,
    signatures: signers.map((signer, i) => ({
      id: i + 1,
      signer,
      public_key: 'PUB',
      signature: `SIG-${signer}`,
      signed_at: new Date().toISOString(),
      signed_hash: 'H',
      meta: '',
    })),
    ...overrides,
  } as any;
}
