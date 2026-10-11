/**
 * Единый сканер стола ПВЗ (задача 598-62): сервер разбирает любой код
 * передачи и отвечает визитом — кто пришёл и какие дела у него на участке.
 * Проверяются разбор строки, порядок дел, код заявления, партия, бокс,
 * чужой кооператив и нераспознанная строка.
 */
import {
  encodeMarketplaceHandoffCode,
  HANDOFF_CODE_TTL_HOURS,
  MarketplaceHandoffCodeKind,
  normalizeToken,
  parseMarketplaceHandoffCode,
  TOKEN_LENGTH,
  tokenFromBytes,
} from '~/extensions/marketplace/domain/marketplace-handoff-code';
import {
  MarketplaceHandoffCodeKindDTO,
  MarketplaceScanMatterKind,
  MarketplaceScanTarget,
} from '~/extensions/marketplace/application/dto/marketplace-scan.dto';
import { MarketplaceScanService } from '~/extensions/marketplace/application/services/marketplace-scan.service';

const COOP = 'voskhod';
const KU = 'pvz1';
const NOW = new Date('2026-10-11T12:00:00.000Z');
const HOUR_MS = 60 * 60 * 1000;
const TOKEN = 'K7Q2M9XD4H';

function build(overrides: Partial<Record<'orders' | 'claims' | 'shipments' | 'containers' | 'reception' | 'display' | 'codes', Record<string, jest.Mock>>> = {}) {
  const codes = {
    findByToken: jest.fn().mockResolvedValue(null),
    findLiveByAccount: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation(async (input) => ({ id: 'hc1', issued_at: NOW, ...input })),
    ...overrides.codes,
  };
  const orders = { listForIssuanceByBraname: jest.fn().mockResolvedValue([]), ...overrides.orders };
  const claims = {
    findById: jest.fn().mockResolvedValue(null),
    listByDeliveryBraname: jest.fn().mockResolvedValue([]),
    ...overrides.claims,
  };
  const shipments = { findById: jest.fn().mockResolvedValue(null), ...overrides.shipments };
  const containers = { getByCode: jest.fn(), ...overrides.containers };
  const reception = { listSupplierPickupOrders: jest.fn().mockResolvedValue([]), ...overrides.reception };
  const display = { resolveAccountNames: jest.fn().mockResolvedValue(new Map([['ant', 'Иванов Иван']])), ...overrides.display };
  const service = new MarketplaceScanService(
    orders as never,
    claims as never,
    shipments as never,
    codes as never,
    containers as never,
    reception as never,
    display as never
  );
  return { service, orders, claims, shipments, containers, reception, display, codes };
}

describe('разбор кода передачи', () => {
  // mkt.scan.happy.01
  it('читает временный код пайщика, коды предметов с префиксом и без, голый логин и код бокса с этикетки', () => {
    expect(parseMarketplaceHandoffCode(TOKEN, COOP)).toEqual({ kind: 'token', coopname: COOP, ref: TOKEN });
    expect(parseMarketplaceHandoffCode(' k7q2-m9xd 4h ', COOP)).toEqual({ kind: 'token', coopname: COOP, ref: TOKEN });
    expect(parseMarketplaceHandoffCode('shipment:voskhod:sh-1', COOP)).toEqual({ kind: MarketplaceHandoffCodeKind.Shipment, coopname: COOP, ref: 'sh-1' });
    expect(parseMarketplaceHandoffCode('container:voskhod:BX-0001', COOP)?.ref).toBe('BX-0001');
    expect(parseMarketplaceHandoffCode('blago:shipment:voskhod:sh-1', COOP)?.ref).toBe('sh-1');
    expect(parseMarketplaceHandoffCode('blago:container:voskhod:BX-0001', COOP)?.kind).toBe(MarketplaceHandoffCodeKind.Container);
    expect(parseMarketplaceHandoffCode('blago:receive:voskhod:ant', COOP)).toEqual({
      kind: MarketplaceHandoffCodeKind.Receive, coopname: COOP, ref: 'ant',
    });
    expect(parseMarketplaceHandoffCode(' blago:return:voskhod:claim-1 ', COOP)?.kind).toBe(MarketplaceHandoffCodeKind.Return);
    expect(parseMarketplaceHandoffCode('ant', COOP)).toEqual({ kind: MarketplaceHandoffCodeKind.Receive, coopname: COOP, ref: 'ant' });
    expect(parseMarketplaceHandoffCode('bx-0007', COOP)).toEqual({ kind: MarketplaceHandoffCodeKind.Container, coopname: COOP, ref: 'BX-0007' });
  });

  // mkt.scan.side.01
  it('отвергает мусор, лишние сегменты и неизвестный вид', () => {
    expect(parseMarketplaceHandoffCode('', COOP)).toBeNull();
    expect(parseMarketplaceHandoffCode('https://example.org', COOP)).toBeNull();
    expect(parseMarketplaceHandoffCode('blago:receive:voskhod:ant:extra', COOP)).toBeNull();
    expect(parseMarketplaceHandoffCode('order:voskhod:1', COOP)).toBeNull();
    expect(parseMarketplaceHandoffCode('receive::ant', COOP)).toBeNull();
    expect(normalizeToken('K7Q2M9XD4')).toBeNull();
    expect(normalizeToken('K7Q2M9XD40')).toBeNull();
  });

  it('сборка и разбор взаимно обратны; случайный код длины TOKEN_LENGTH из алфавита без 0/O/1/I', () => {
    const code = { kind: MarketplaceHandoffCodeKind.Shipment, coopname: COOP, ref: 'sh-1' };
    expect(encodeMarketplaceHandoffCode(code)).toBe('shipment:voskhod:sh-1');
    expect(parseMarketplaceHandoffCode(encodeMarketplaceHandoffCode(code), COOP)).toEqual(code);
    const token = tokenFromBytes(new Uint8Array([0, 31, 32, 255, 7, 8, 9, 10, 11, 12]));
    expect(token).toHaveLength(TOKEN_LENGTH);
    expect(normalizeToken(token)).toBe(token);
    expect(token).not.toMatch(/[01OI]/);
  });
});

describe('визит по коду', () => {
  // mkt.scan.happy.02
  it('по коду заказчика собирает дела в порядке выдача, приёмка, возврат', async () => {
    const { service, orders, reception, claims } = build({
      orders: {
        listForIssuanceByBraname: jest.fn().mockResolvedValue([
          { id: 'o1', orderer_account: 'ant' },
          { id: 'o2', orderer_account: 'other' },
          { id: 'o3', orderer_account: 'ant' },
        ]),
      },
      reception: { listSupplierPickupOrders: jest.fn().mockResolvedValue([{ id: 'p1' }]) },
      claims: {
        findById: jest.fn(),
        listByDeliveryBraname: jest.fn().mockResolvedValue([
          { id: 'c1', orderer_account: 'ant' },
          { id: 'c2', orderer_account: 'other' },
        ]),
      },
    });

    const visit = await service.resolveVisit(COOP, KU, 'blago:receive:voskhod:ant');

    expect(visit.target).toBe(MarketplaceScanTarget.PERSON);
    expect(visit.account).toBe('ant');
    expect(visit.display_name).toBe('Иванов Иван');
    expect(visit.matters).toEqual([
      { kind: MarketplaceScanMatterKind.ISSUANCE, ids: ['o1', 'o3'] },
      { kind: MarketplaceScanMatterKind.RECEPTION, ids: ['p1'] },
      { kind: MarketplaceScanMatterKind.RETURN, ids: ['c1'] },
    ]);
    expect(visit.focus_claim_id).toBeNull();
    expect(orders.listForIssuanceByBraname).toHaveBeenCalledWith(COOP, KU);
    expect(reception.listSupplierPickupOrders).toHaveBeenCalledWith(COOP, KU, 'ant');
    expect(claims.listByDeliveryBraname).toHaveBeenCalledWith(COOP, KU, 'APPROVED_FOR_VISIT');
  });

  // mkt.scan.happy.03
  it('код заявления ведёт к заявителю и отмечает заявление, если оно ждёт осмотра здесь', async () => {
    const { service } = build({
      claims: {
        findById: jest.fn().mockResolvedValue({
          id: 'c1', coopname: COOP, orderer_account: 'ant', delivery_braname: KU, status: 'APPROVED_FOR_VISIT',
        }),
        listByDeliveryBraname: jest.fn().mockResolvedValue([{ id: 'c1', orderer_account: 'ant' }]),
      },
    });

    const visit = await service.resolveVisit(COOP, KU, 'blago:return:voskhod:c1');

    expect(visit.account).toBe('ant');
    expect(visit.focus_claim_id).toBe('c1');
    expect(visit.matters).toEqual([{ kind: MarketplaceScanMatterKind.RETURN, ids: ['c1'] }]);
  });

  // mkt.scan.side.02
  it('заявление другого участка или не в статусе осмотра не отмечается, но визит заявителя собирается', async () => {
    const { service } = build({
      claims: {
        findById: jest.fn().mockResolvedValue({
          id: 'c1', coopname: COOP, orderer_account: 'ant', delivery_braname: 'pvz2', status: 'APPROVED_FOR_VISIT',
        }),
        listByDeliveryBraname: jest.fn().mockResolvedValue([]),
      },
    });

    const visit = await service.resolveVisit(COOP, KU, 'blago:return:voskhod:c1');

    expect(visit.account).toBe('ant');
    expect(visit.focus_claim_id).toBeNull();
    expect(visit.matters).toEqual([]);
  });

  // mkt.scan.side.03
  it('пайщик без дел — визит с пустым списком дел, не ошибка', async () => {
    const { service } = build();
    const visit = await service.resolveVisit(COOP, KU, 'ant');
    expect(visit.target).toBe(MarketplaceScanTarget.PERSON);
    expect(visit.matters).toEqual([]);
  });

  // mkt.scan.happy.04
  it('код партии ведёт к партии своего участка', async () => {
    const { service } = build({
      shipments: { findById: jest.fn().mockResolvedValue({ id: 'sh1', coopname: COOP, braname: KU }) },
    });
    const visit = await service.resolveVisit(COOP, KU, 'blago:shipment:voskhod:sh1');
    expect(visit).toMatchObject({ target: MarketplaceScanTarget.SHIPMENT, shipment_id: 'sh1', matters: [] });
  });

  // mkt.scan.happy.05
  it('код бокса ведёт к боксу своего участка', async () => {
    const { service, containers } = build({
      containers: { getByCode: jest.fn().mockResolvedValue({ code: 'BX-0001', braname: KU }) },
    });
    const visit = await service.resolveVisit(COOP, KU, 'BX-0001');
    expect(visit).toMatchObject({ target: MarketplaceScanTarget.CONTAINER, container_code: 'BX-0001' });
    expect(containers.getByCode).toHaveBeenCalledWith(COOP, 'BX-0001');
  });

  // mkt.scan.break.01
  it('партия и бокс другого участка, чужой кооператив и мусор отвечают своим кодом', async () => {
    const { service } = build({
      shipments: { findById: jest.fn().mockResolvedValue({ id: 'sh1', coopname: COOP, braname: 'pvz2' }) },
      containers: { getByCode: jest.fn().mockResolvedValue({ code: 'BX-0001', braname: 'pvz2' }) },
    });
    await expect(service.resolveVisit(COOP, KU, 'blago:shipment:voskhod:sh1')).rejects.toMatchObject({
      code: 'MARKETPLACE_SCAN_SHIPMENT_OTHER_BRANCH',
    });
    await expect(service.resolveVisit(COOP, KU, 'BX-0001')).rejects.toMatchObject({
      code: 'MARKETPLACE_SCAN_CONTAINER_OTHER_BRANCH',
    });
    await expect(service.resolveVisit(COOP, KU, 'blago:receive:othercoop:ant')).rejects.toMatchObject({
      code: 'MARKETPLACE_SCAN_CODE_WRONG_COOP',
    });
    await expect(service.resolveVisit(COOP, KU, 'https://example.org')).rejects.toMatchObject({
      code: 'MARKETPLACE_SCAN_CODE_UNRECOGNIZED',
    });
    await expect(service.resolveVisit(COOP, KU, 'blago:return:voskhod:missing')).rejects.toMatchObject({
      code: 'MARKETPLACE_SCAN_RETURN_CLAIM_NOT_FOUND',
    });
  });

  // mkt.scan.happy.06
  it('код пайщику выдаёт сервер: случайный, на сутки; пока действует — тот же самый', async () => {
    const { service, codes } = build();
    const issued = await service.handoffCodeFor(COOP, 'ant', MarketplaceHandoffCodeKindDTO.RECEIVE, NOW);
    expect(issued.kind).toBe(MarketplaceHandoffCodeKindDTO.RECEIVE);
    expect(normalizeToken(issued.code)).toBe(issued.code);
    expect(issued.expires_at).toEqual(new Date(NOW.getTime() + HANDOFF_CODE_TTL_HOURS * HOUR_MS));
    expect(codes.create).toHaveBeenCalledWith({ coopname: COOP, account: 'ant', token: issued.code, expires_at: issued.expires_at });

    codes.findLiveByAccount.mockResolvedValue({ token: TOKEN, account: 'ant', expires_at: new Date(NOW.getTime() + HOUR_MS) });
    const same = await service.handoffCodeFor(COOP, 'ant', MarketplaceHandoffCodeKindDTO.PICKUP, NOW);
    expect(same).toEqual({ kind: MarketplaceHandoffCodeKindDTO.PICKUP, code: TOKEN, expires_at: new Date(NOW.getTime() + HOUR_MS) });
    expect(codes.create).toHaveBeenCalledTimes(1);
  });

  // mkt.scan.happy.07
  it('временный код из таблицы ведёт к пайщику; код не из таблицы разбирается как логин', async () => {
    const { service, codes } = build({
      codes: { findByToken: jest.fn().mockResolvedValue({ token: TOKEN, account: 'ant', expires_at: new Date(NOW.getTime() + HOUR_MS) }) },
    });
    const visit = await service.resolveVisit(COOP, KU, 'k7q2 m9xd 4h', NOW);
    expect(visit).toMatchObject({ target: MarketplaceScanTarget.PERSON, account: 'ant' });
    expect(codes.findByToken).toHaveBeenCalledWith(COOP, TOKEN);

    codes.findByToken.mockResolvedValue(null);
    const byLogin = await service.resolveVisit(COOP, KU, 'EKATERINA2', NOW);
    expect(byLogin).toMatchObject({ target: MarketplaceScanTarget.PERSON, account: 'ekaterina2' });
    await expect(service.resolveVisit(COOP, KU, 'K7Q2M9XD4H', NOW)).rejects.toMatchObject({ code: 'MARKETPLACE_SCAN_CODE_UNRECOGNIZED' });
  });

  // mkt.scan.break.02
  it('истёкший код отвечает своим кодом ошибки, а не «не распознан»', async () => {
    const { service } = build({
      codes: { findByToken: jest.fn().mockResolvedValue({ token: TOKEN, account: 'ant', expires_at: new Date(NOW.getTime() - 1) }) },
    });
    await expect(service.resolveVisit(COOP, KU, TOKEN, NOW)).rejects.toMatchObject({ code: 'MARKETPLACE_SCAN_CODE_EXPIRED' });
  });
});
