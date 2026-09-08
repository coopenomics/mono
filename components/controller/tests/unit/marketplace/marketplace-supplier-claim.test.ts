/**
 * Гарантийная претензия поставщику (задача 99D-13).
 *
 * Претензию заводит контракт по решению совета; бэкенд зеркалит её из
 * заявления на возврат и даёт поставщику ответить. Здесь — границы ответа
 * (чужая претензия, повторный ответ, пустая причина), выставление только по
 * заказу с внешним поставщиком, хэш претензии как у контракта и автоприём
 * строго по настройке.
 */
import { createHash } from 'crypto';
import {
  MarketplaceSupplierClaimService,
  supplierClaimHashOf,
} from '~/extensions/marketplace/application/services/marketplace-supplier-claim.service';

const COOP = 'voskhod';
const REQUEST_HASH = 'a'.repeat(64);

function returnClaim(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rc-1',
    coopname: COOP,
    request_hash: REQUEST_HASH,
    order_id: 'order-1',
    order_hash: 'b'.repeat(64),
    supplier_account: 'ivanpetrov',
    orderer_account: 'ekaterina',
    delivery_braname: 'krg',
    actual_quantity: 3,
    fact_cost: '300.0000',
    reason_text: 'Скисло.',
    on_site_inspection: { result_text: 'Вздутая упаковка.' },
    photos: [],
    statement: { hash: 'h', signatures: [{ signer: 'ekaterina' }, { signer: 'chairkrg' }] },
    ...overrides,
  };
}

function pendingClaim(overrides: Record<string, unknown> = {}) {
  return {
    id: 'claim-1',
    coopname: COOP,
    claim_hash: supplierClaimHashOf(REQUEST_HASH),
    return_claim_id: 'rc-1',
    supplier_account: 'ivanpetrov',
    status: 'PENDING',
    amount: '300.0000',
    issued_at: new Date(Date.now() - 20 * 24 * 3600 * 1000),
    ...overrides,
  };
}

function makeService(config: { auto_admit_enabled?: boolean; auto_admit_days?: number } | null = null) {
  const claimRepo = {
    createIfNotExists: jest.fn(async (input: Record<string, unknown>) => ({ id: 'claim-1', status: 'PENDING', ...input })),
    findByClaimHash: jest.fn().mockResolvedValue(null),
    findById: jest.fn(),
    listPendingIssuedBefore: jest.fn().mockResolvedValue([]),
    decide: jest.fn(async (id: string, patch: Record<string, unknown>) => ({ id, ...patch })),
  };
  const chainPort = {
    admitClaim: jest.fn().mockResolvedValue({ response: { transaction_id: 'tx-admit' } }),
    refuseClaim: jest.fn().mockResolvedValue({ response: { transaction_id: 'tx-refuse' } }),
    autoClaim: jest.fn().mockResolvedValue({ response: { transaction_id: 'tx-auto' } }),
  };
  const eventBus = { emit: jest.fn() };
  const service = new MarketplaceSupplierClaimService(
    claimRepo as never,
    { findById: jest.fn() } as never,
    chainPort as never,
    { symbol: 'RUB', decimals: 4 } as never,
    { buildAggregate: jest.fn() } as never,
    { findByWalletAndUsername: jest.fn().mockResolvedValue(null) } as never,
    { get: jest.fn().mockResolvedValue(config ? { supplierClaims: config } : null) } as never,
    { getReadUrl: jest.fn() } as never,
    eventBus as never,
    { setContext: jest.fn(), log: jest.fn(), warn: jest.fn(), error: jest.fn() } as never
  );
  return { service, claimRepo, chainPort, eventBus };
}

describe('Хэш претензии', () => {
  it('считается как в контракте: sha256(байты хэша рекламации ‖ "claim") и отличается от хэша рекламации', () => {
    const expected = createHash('sha256')
      .update(Buffer.concat([Buffer.from(REQUEST_HASH, 'hex'), Buffer.from('claim')]))
      .digest('hex');
    expect(supplierClaimHashOf(REQUEST_HASH)).toBe(expected);
    expect(supplierClaimHashOf(REQUEST_HASH)).not.toBe(REQUEST_HASH);
  });
});

describe('Выставление претензии по решению совета', () => {
  it('по заказу с внешним поставщиком претензия заводится на сумму возврата с рекламацией в две подписи, поставщику уходит уведомление', async () => {
    const { service, claimRepo, eventBus } = makeService();
    const claim = await service.issueFromReturnClaim(returnClaim() as never, 'tx-1');

    expect(claim).not.toBeNull();
    const input = claimRepo.createIfNotExists.mock.calls[0][0];
    expect(input.claim_hash).toBe(supplierClaimHashOf(REQUEST_HASH));
    expect(input.amount).toBe('300.0000');
    expect(input.supplier_account).toBe('ivanpetrov');
    expect(input.reclamation).toEqual(returnClaim().statement);
    expect(input.inspection_result).toBe('Вздутая упаковка.');
    expect(eventBus.emit).toHaveBeenCalledWith('marketplace.supplierClaim.issued', expect.objectContaining({
      supplier_account: 'ivanpetrov',
      amount: '300.0000 RUB',
    }));
  });

  it('по заказу из остатка кооператива претензии нет — поставщик там сам кооператив', async () => {
    const { service, claimRepo, eventBus } = makeService();
    const claim = await service.issueFromReturnClaim(returnClaim({ supplier_account: COOP }) as never, 'tx-1');
    expect(claim).toBeNull();
    expect(claimRepo.createIfNotExists).not.toHaveBeenCalled();
    expect(eventBus.emit).not.toHaveBeenCalled();
  });

  it('повтор события совета не плодит уведомлений', async () => {
    const { service, claimRepo, eventBus } = makeService();
    claimRepo.findByClaimHash.mockResolvedValue(pendingClaim());
    await service.issueFromReturnClaim(returnClaim() as never, 'tx-1');
    expect(eventBus.emit).not.toHaveBeenCalled();
  });
});

describe('Ответ поставщика', () => {
  it('признание проходит в цепь и переводит претензию в ADMITTED', async () => {
    const { service, claimRepo, chainPort } = makeService();
    claimRepo.findById.mockResolvedValue(pendingClaim());
    const result = await service.admit({ coopname: COOP, supplier: 'ivanpetrov', claim_id: 'claim-1' });
    expect(chainPort.admitClaim).toHaveBeenCalledWith({ coopname: COOP, supplier: 'ivanpetrov', claim_hash: supplierClaimHashOf(REQUEST_HASH) });
    expect(claimRepo.decide).toHaveBeenCalledWith('claim-1', expect.objectContaining({ status: 'ADMITTED', decide_tx_hash: 'tx-admit' }));
    expect(result.tx_hash).toBe('tx-admit');
  });

  it('чужую претензию признать нельзя', async () => {
    const { service, claimRepo, chainPort } = makeService();
    claimRepo.findById.mockResolvedValue(pendingClaim());
    await expect(service.admit({ coopname: COOP, supplier: 'someoneelse', claim_id: 'claim-1' })).rejects.toThrow(
      'только поставщик, которому она выставлена'
    );
    expect(chainPort.admitClaim).not.toHaveBeenCalled();
  });

  it('повторный ответ по решённой претензии отбивается', async () => {
    const { service, claimRepo, chainPort } = makeService();
    claimRepo.findById.mockResolvedValue(pendingClaim({ status: 'ADMITTED' }));
    await expect(service.refuse({ coopname: COOP, supplier: 'ivanpetrov', claim_id: 'claim-1', reason: 'Нет.' })).rejects.toThrow(
      'ответ уже дан'
    );
    expect(chainPort.refuseClaim).not.toHaveBeenCalled();
  });

  it('отказ без причины не принимается', async () => {
    const { service, chainPort } = makeService();
    await expect(service.refuse({ coopname: COOP, supplier: 'ivanpetrov', claim_id: 'claim-1', reason: '  ' })).rejects.toThrow(
      'Укажите причину отказа'
    );
    expect(chainPort.refuseClaim).not.toHaveBeenCalled();
  });
});

describe('Автоприём по сроку', () => {
  it('выключен по умолчанию — сторож ничего не делает', async () => {
    const { service, claimRepo, chainPort } = makeService(null);
    await service.autoAdmitTick(COOP);
    expect(claimRepo.listPendingIssuedBefore).not.toHaveBeenCalled();
    expect(chainPort.autoClaim).not.toHaveBeenCalled();
  });

  it('включён — претензии старше срока признаются за поставщика, срок не меньше контрактных 14 дней', async () => {
    const { service, claimRepo, chainPort } = makeService({ auto_admit_enabled: true, auto_admit_days: 3 });
    claimRepo.listPendingIssuedBefore.mockResolvedValue([pendingClaim()]);
    await service.autoAdmitTick(COOP);
    const before = claimRepo.listPendingIssuedBefore.mock.calls[0][1] as Date;
    const ageDays = (Date.now() - before.getTime()) / (24 * 3600 * 1000);
    expect(ageDays).toBeGreaterThanOrEqual(13.99);
    expect(chainPort.autoClaim).toHaveBeenCalledWith({ coopname: COOP, claim_hash: supplierClaimHashOf(REQUEST_HASH) });
    expect(claimRepo.decide).toHaveBeenCalledWith('claim-1', expect.objectContaining({ status: 'ADMITTED', auto_admitted: true }));
  });
});
