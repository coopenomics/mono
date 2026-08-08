import { MarketplaceConsolidatedRequestDomainEntity } from './marketplace-consolidated-request.entity';
import type { MarketplaceConsolidatedRequestProps } from './marketplace-consolidated-request.types';

function buildProps(
  overrides: Partial<MarketplaceConsolidatedRequestProps> = {}
): MarketplaceConsolidatedRequestProps {
  return {
    id: 'cycle-uuid-1',
    coopname: 'voskhod',
    offer_id: 'offer-uuid-1',
    supplier_account: 'supplier1',
    total_quantity: 25,
    total_amount: '2500.0000',
    status: 'PENDING_SUPPLIER_ACCEPT',
    cycle_started_at: new Date('2026-05-01T00:00:00Z'),
    cycle_ended_at: new Date('2026-05-08T00:00:00Z'),
    expires_at: new Date('2026-05-10T00:00:00Z'),
    accepted_at: null,
    declined_at: null,
    decline_reason: null,
    triggered_by_supplier_at: null,
    created_at: new Date('2026-05-08T00:00:00Z'),
    updated_at: new Date('2026-05-08T00:00:00Z'),
    ...overrides,
  };
}

describe('MarketplaceConsolidatedRequestDomainEntity', () => {
  it('PENDING_SUPPLIER_ACCEPT — is_pending true, is_terminal false', () => {
    const r = new MarketplaceConsolidatedRequestDomainEntity(buildProps());
    expect(r.is_pending).toBe(true);
    expect(r.is_terminal).toBe(false);
  });

  it('ACCEPTED — is_pending false, is_terminal true', () => {
    const r = new MarketplaceConsolidatedRequestDomainEntity(
      buildProps({ status: 'ACCEPTED', accepted_at: new Date() })
    );
    expect(r.is_pending).toBe(false);
    expect(r.is_terminal).toBe(true);
  });

  it.each([
    'DECLINED_BY_SUPPLIER',
    'EXPIRED_NO_RESPONSE',
  ] as const)('is_terminal true для %s', (status) => {
    const r = new MarketplaceConsolidatedRequestDomainEntity(buildProps({ status }));
    expect(r.is_terminal).toBe(true);
    expect(r.is_pending).toBe(false);
  });

  it('ручной запуск партии с triggered_by_supplier_at — фиксируется как поле', () => {
    const triggered = new Date('2026-05-08T12:00:00Z');
    const r = new MarketplaceConsolidatedRequestDomainEntity(
      buildProps({
        status: 'ACCEPTED',
        cycle_ended_at: null,
        expires_at: null,
        accepted_at: triggered,
        triggered_by_supplier_at: triggered,
      })
    );
    expect(r.triggered_by_supplier_at).toEqual(triggered);
  });
});
