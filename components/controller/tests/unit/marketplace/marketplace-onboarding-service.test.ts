/**
 * Unit-тесты MarketplaceOnboardingService (Story 1.4).
 *
 * Покрывают AC:
 *   (a) MARKETPLACE_OFFER_TEMPLATE_REGISTRY_ID = 0 (Story 1.7 не выполнена)
 *       → requires_gate=false, source='not_configured';
 *   (b) есть подписанная оферта marketplace в core `soviet::agreements3`
 *       → requires_gate=false, source='agreement_signed', completed_at/agreement_id
 *       заполнены;
 *   (c) подписи нет → requires_gate=true, source='gate_required'.
 *
 * Для случая (b/c) подменяем константу через jest.doMock — она captured
 * сервисом в момент вызова, не на import-time.
 */

const makeAgreement = (overrides: any = {}) => ({
  id: 42,
  type: 'marketplace',
  draft_id: 7,
  username: 'alice',
  coopname: 'voskhod',
  updated_at: '2026-05-14T12:00:00Z',
  ...overrides,
});

const makeRepo = (agreements: any[]) =>
  ({
    findByUsername: jest.fn().mockResolvedValue(agreements),
  } as any);

const makeLogger = () =>
  ({
    setContext: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  } as any);

describe('MarketplaceOnboardingService.getOnboardingState', () => {
  afterEach(() => {
    jest.resetModules();
  });

  it('placeholder=0 (rollback Story 1.7) → requires_gate=false, source=not_configured', async () => {
    jest.doMock('~/extensions/marketplace/constants/marketplace-agreement-ids', () => ({
      __esModule: true,
      MARKETPLACE_EXTENSION_NAME: 'market',
      MARKETPLACE_OFFER_AGREEMENT_ID: 'marketplace_offer',
      MARKETPLACE_AGREEMENT_TYPE: 'marketplace',
      MARKETPLACE_OFFER_TEMPLATE_REGISTRY_ID: 0,
    }));
    const { MarketplaceOnboardingService } = await import(
      '~/extensions/marketplace/application/onboarding/marketplace-onboarding.service'
    );
    const repo = makeRepo([]);
    const service = new MarketplaceOnboardingService(repo, makeLogger());

    const state = await service.getOnboardingState('alice');
    expect(state.requires_gate).toBe(false);
    expect(state.source).toBe('not_configured');
    expect(state.template_registry_id).toBe(0);
    expect(repo.findByUsername).not.toHaveBeenCalled();
  });

  it('Story 1.7 размещена (template_registry_id=1100 из cooptypes), подписи нет → requires_gate=true', async () => {
    jest.dontMock('~/extensions/marketplace/constants/marketplace-agreement-ids');
    const { MarketplaceOnboardingService } = await import(
      '~/extensions/marketplace/application/onboarding/marketplace-onboarding.service'
    );
    const repo = makeRepo([]);
    const service = new MarketplaceOnboardingService(repo, makeLogger());

    const state = await service.getOnboardingState('alice');
    expect(state.template_registry_id).toBe(1100);
    expect(state.requires_gate).toBe(true);
    expect(state.source).toBe('gate_required');
  });

  it('подпись marketplace есть → requires_gate=false, source=agreement_signed, completed_at/agreement_id заполнены', async () => {
    jest.doMock('~/extensions/marketplace/constants/marketplace-agreement-ids', () => ({
      __esModule: true,
      MARKETPLACE_EXTENSION_NAME: 'market',
      MARKETPLACE_OFFER_AGREEMENT_ID: 'marketplace_offer',
      MARKETPLACE_AGREEMENT_TYPE: 'marketplace',
      MARKETPLACE_OFFER_TEMPLATE_REGISTRY_ID: 7,
    }));

    const { MarketplaceOnboardingService } = await import(
      '~/extensions/marketplace/application/onboarding/marketplace-onboarding.service'
    );
    const repo = makeRepo([makeAgreement({ draft_id: 7 })]);
    const service = new MarketplaceOnboardingService(repo, makeLogger());

    const state = await service.getOnboardingState('alice');
    expect(state.requires_gate).toBe(false);
    expect(state.source).toBe('agreement_signed');
    expect(state.template_registry_id).toBe(7);
    expect(state.agreement_id).toBe(42);
    expect(state.completed_at).toBe('2026-05-14T12:00:00Z');
    expect(repo.findByUsername).toHaveBeenCalledWith('alice');
  });

  it('подписи нет → requires_gate=true, source=gate_required', async () => {
    jest.doMock('~/extensions/marketplace/constants/marketplace-agreement-ids', () => ({
      __esModule: true,
      MARKETPLACE_EXTENSION_NAME: 'market',
      MARKETPLACE_OFFER_AGREEMENT_ID: 'marketplace_offer',
      MARKETPLACE_AGREEMENT_TYPE: 'marketplace',
      MARKETPLACE_OFFER_TEMPLATE_REGISTRY_ID: 7,
    }));

    const { MarketplaceOnboardingService } = await import(
      '~/extensions/marketplace/application/onboarding/marketplace-onboarding.service'
    );
    const repo = makeRepo([
      makeAgreement({ type: 'capital', draft_id: 999 }), // не marketplace — игнор
      makeAgreement({ type: 'marketplace', draft_id: 8 }), // другой шаблон — игнор
    ]);
    const service = new MarketplaceOnboardingService(repo, makeLogger());

    const state = await service.getOnboardingState('alice');
    expect(state.requires_gate).toBe(true);
    expect(state.source).toBe('gate_required');
    expect(state.template_registry_id).toBe(7);
    expect(state.agreement_id).toBeUndefined();
  });

  it('запись marketplace без draft_id (если контракт не проставил) считается совпадающей по type', async () => {
    jest.doMock('~/extensions/marketplace/constants/marketplace-agreement-ids', () => ({
      __esModule: true,
      MARKETPLACE_EXTENSION_NAME: 'market',
      MARKETPLACE_OFFER_AGREEMENT_ID: 'marketplace_offer',
      MARKETPLACE_AGREEMENT_TYPE: 'marketplace',
      MARKETPLACE_OFFER_TEMPLATE_REGISTRY_ID: 7,
    }));

    const { MarketplaceOnboardingService } = await import(
      '~/extensions/marketplace/application/onboarding/marketplace-onboarding.service'
    );
    const repo = makeRepo([makeAgreement({ type: 'marketplace', draft_id: undefined, id: 99 })]);
    const service = new MarketplaceOnboardingService(repo, makeLogger());

    const state = await service.getOnboardingState('alice');
    expect(state.requires_gate).toBe(false);
    expect(state.agreement_id).toBe(99);
  });
});
