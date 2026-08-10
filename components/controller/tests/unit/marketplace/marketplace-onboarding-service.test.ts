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

import { MarketplaceOnboardingSource } from '~/extensions/marketplace/application/dto/marketplace-onboarding-state.dto';

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

const makeSovietPort = (coagreement: any, programs: any[] = []) =>
  ({
    getCoagreement: jest.fn().mockResolvedValue(coagreement),
    getPrograms: jest.fn().mockResolvedValue(programs),
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
    expect(state.source).toBe(MarketplaceOnboardingSource.NOT_CONFIGURED);
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
    expect(state.source).toBe(MarketplaceOnboardingSource.NOT_CONFIGURED);
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
    expect(state.source).toBe(MarketplaceOnboardingSource.AGREEMENT_SIGNED);
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
    expect(state.source).toBe(MarketplaceOnboardingSource.GATE_REQUIRED);
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

describe('MarketplaceOnboardingService.signOnboardingOffer', () => {
  const DOCUMENT = { hash: 'deadbeef' } as any;

  it('draft_id берётся из программы, а не из коагримента', async () => {
    // `wallet::signagree` сверяет присланный draft_id с
    // `soviet::programs[program_id].draft_id`. После правки шаблона через
    // `soviet::editprog` коагримент остаётся со старым значением — взяли бы его,
    // подпись падала бы «draft_id соглашения не совпадает с draft_id программы».
    jest.dontMock('~/extensions/marketplace/constants/marketplace-agreement-ids');
    const { MarketplaceOnboardingService } = await import(
      '~/extensions/marketplace/application/onboarding/marketplace-onboarding.service'
    );
    const wallet = makeWalletPort();
    const soviet = makeSovietPort({ ...COAGREEMENT, draft_id: 699 }, [
      { id: PROGRAM_ID, draft_id: 1102 },
    ]);
    const service = new MarketplaceOnboardingService(
      makeUserAgreementRepo(null),
      soviet,
      wallet,
      makeLogger()
    );

    await service.signOnboardingOffer({
      coopname: 'voskhod',
      username: 'alice',
      document: DOCUMENT,
    });

    expect(wallet.signProgramAgreement).toHaveBeenCalledWith(
      expect.objectContaining({ program_id: PROGRAM_ID, draft_id: 1102 })
    );
  });

  it('программа ЦПП не создана в кооперативе → отказ, подпись не отправляется', async () => {
    jest.dontMock('~/extensions/marketplace/constants/marketplace-agreement-ids');
    const { MarketplaceOnboardingService } = await import(
      '~/extensions/marketplace/application/onboarding/marketplace-onboarding.service'
    );
    const wallet = makeWalletPort();
    const service = new MarketplaceOnboardingService(
      makeUserAgreementRepo(null),
      makeSovietPort(COAGREEMENT, []),
      wallet,
      makeLogger()
    );

    await expect(
      service.signOnboardingOffer({
        coopname: 'voskhod',
        username: 'alice',
        document: DOCUMENT,
      })
    ).rejects.toThrow(/не найдена/);
    expect(wallet.signProgramAgreement).not.toHaveBeenCalled();
  });

  it('коагримента нет → отказ, подпись не отправляется', async () => {
    jest.dontMock('~/extensions/marketplace/constants/marketplace-agreement-ids');
    const { MarketplaceOnboardingService } = await import(
      '~/extensions/marketplace/application/onboarding/marketplace-onboarding.service'
    );
    const wallet = makeWalletPort();
    const service = new MarketplaceOnboardingService(
      makeUserAgreementRepo(null),
      makeSovietPort(null),
      wallet,
      makeLogger()
    );

    await expect(
      service.signOnboardingOffer({
        coopname: 'voskhod',
        username: 'alice',
        document: DOCUMENT,
      })
    ).rejects.toThrow(/не настроено соглашение/);
    expect(wallet.signProgramAgreement).not.toHaveBeenCalled();
  });
});
