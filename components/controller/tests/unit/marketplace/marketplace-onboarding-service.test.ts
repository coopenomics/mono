/**
 * Unit-тесты MarketplaceOnboardingService.getOnboardingState (Story 1.4).
 *
 * ЦПП «Стол заказов» — ПРОГРАММА (program_id=2): подпись пайщика делается через
 * `wallet::signagree` в `wallet::users.programs[]`, поэтому состояние читается
 * из `UserAgreementRepository` (НЕ из `agreements3`/`AgreementRepository`).
 *
 * Покрывают:
 *   (a) MARKETPLACE_OFFER_TEMPLATE_REGISTRY_ID = 0 → not_configured;
 *   (b) ЦПП не настроена как программа (нет коагримента / program_id<=0)
 *       → not_configured (гейтить нечем);
 *   (c) пайщик подписал программу → requires_gate=false, source=agreement_signed,
 *       completed_at из signed_at;
 *   (d) подписи нет (owner=null или нет нужной program_id) → requires_gate=true;
 *   (e) owner.present=false (откат форком) → подпись не засчитывается.
 */

const PROGRAM_ID = 2;

const makeProgram = (overrides: any = {}) => ({
  program_id: PROGRAM_ID,
  doc_hash: 'abc',
  version: 1,
  draft_id: 1100,
  signed_at: '2026-05-14T12:00:00Z',
  ...overrides,
});

const makeOwner = (programs: any[], present = true) =>
  ({
    present,
    programs,
    findProgram(pid: number | string) {
      return programs.find((p) => Number(p.program_id) === Number(pid));
    },
  } as any);

const makeUserAgreementRepo = (owner: any) =>
  ({
    findByUsername: jest.fn().mockResolvedValue(owner),
  } as any);

const makeSovietPort = (coagreement: any) =>
  ({
    getCoagreement: jest.fn().mockResolvedValue(coagreement),
  } as any);

const makeWalletPort = () =>
  ({
    signProgramAgreement: jest.fn(),
  } as any);

const makeLogger = () =>
  ({
    setContext: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  } as any);

const COAGREEMENT = { program_id: PROGRAM_ID, draft_id: 1100, type: 'marketplace' };

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
    const repo = makeUserAgreementRepo(null);
    const soviet = makeSovietPort(COAGREEMENT);
    const service = new MarketplaceOnboardingService(repo, soviet, makeWalletPort(), makeLogger());

    const state = await service.getOnboardingState('alice');
    expect(state.requires_gate).toBe(false);
    expect(state.source).toBe('not_configured');
    expect(state.template_registry_id).toBe(0);
    expect(soviet.getCoagreement).not.toHaveBeenCalled();
    expect(repo.findByUsername).not.toHaveBeenCalled();
  });

  it('ЦПП не настроена как программа (нет коагримента) → not_configured', async () => {
    jest.dontMock('~/extensions/marketplace/constants/marketplace-agreement-ids');
    const { MarketplaceOnboardingService } = await import(
      '~/extensions/marketplace/application/onboarding/marketplace-onboarding.service'
    );
    const repo = makeUserAgreementRepo(null);
    const service = new MarketplaceOnboardingService(repo, makeSovietPort(null), makeWalletPort(), makeLogger());

    const state = await service.getOnboardingState('alice');
    expect(state.requires_gate).toBe(false);
    expect(state.source).toBe('not_configured');
    expect(repo.findByUsername).not.toHaveBeenCalled();
  });

  it('подпись программы есть → requires_gate=false, source=agreement_signed, completed_at из signed_at', async () => {
    jest.dontMock('~/extensions/marketplace/constants/marketplace-agreement-ids');
    const { MarketplaceOnboardingService } = await import(
      '~/extensions/marketplace/application/onboarding/marketplace-onboarding.service'
    );
    const owner = makeOwner([makeProgram()]);
    const repo = makeUserAgreementRepo(owner);
    const service = new MarketplaceOnboardingService(repo, makeSovietPort(COAGREEMENT), makeWalletPort(), makeLogger());

    const state = await service.getOnboardingState('alice');
    expect(state.requires_gate).toBe(false);
    expect(state.source).toBe('agreement_signed');
    expect(state.completed_at).toBe('2026-05-14T12:00:00Z');
  });

  it('подписи нет (owner=null) → requires_gate=true, source=gate_required', async () => {
    jest.dontMock('~/extensions/marketplace/constants/marketplace-agreement-ids');
    const { MarketplaceOnboardingService } = await import(
      '~/extensions/marketplace/application/onboarding/marketplace-onboarding.service'
    );
    const repo = makeUserAgreementRepo(null);
    const service = new MarketplaceOnboardingService(repo, makeSovietPort(COAGREEMENT), makeWalletPort(), makeLogger());

    const state = await service.getOnboardingState('alice');
    expect(state.requires_gate).toBe(true);
    expect(state.source).toBe('gate_required');
  });

  it('owner есть, но другой program_id → requires_gate=true', async () => {
    jest.dontMock('~/extensions/marketplace/constants/marketplace-agreement-ids');
    const { MarketplaceOnboardingService } = await import(
      '~/extensions/marketplace/application/onboarding/marketplace-onboarding.service'
    );
    const owner = makeOwner([makeProgram({ program_id: 1 })]); // capital, не marketplace
    const repo = makeUserAgreementRepo(owner);
    const service = new MarketplaceOnboardingService(repo, makeSovietPort(COAGREEMENT), makeWalletPort(), makeLogger());

    const state = await service.getOnboardingState('alice');
    expect(state.requires_gate).toBe(true);
  });

  it('owner.present=false (откат форком) → подпись не засчитывается, requires_gate=true', async () => {
    jest.dontMock('~/extensions/marketplace/constants/marketplace-agreement-ids');
    const { MarketplaceOnboardingService } = await import(
      '~/extensions/marketplace/application/onboarding/marketplace-onboarding.service'
    );
    const owner = makeOwner([makeProgram()], false);
    const repo = makeUserAgreementRepo(owner);
    const service = new MarketplaceOnboardingService(repo, makeSovietPort(COAGREEMENT), makeWalletPort(), makeLogger());

    const state = await service.getOnboardingState('alice');
    expect(state.requires_gate).toBe(true);
  });
});
