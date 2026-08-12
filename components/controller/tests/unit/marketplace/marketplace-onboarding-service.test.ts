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

// Подпись программной оферты хранит ядро: расширение только спрашивает порт,
// есть ли она. Отсутствие записи, откат подписи форком и подпись по чужой
// программе снаружи неразличимы — во всех трёх случаях порт отвечает `null`.
const makeProgramAgreements = (signature: any) =>
  ({
    findProgramSignature: jest.fn().mockResolvedValue(signature),
  } as any);

const makeSovietPort = (coagreement: any, programs: any[] = []) =>
  ({
    getCoagreement: jest.fn().mockResolvedValue(coagreement),
    getPrograms: jest.fn().mockResolvedValue(programs),
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

import { configurePlatformSettingsForTest } from '../../mocks/platform-settings';

describe('MarketplaceOnboardingService.getOnboardingState', () => {
  afterEach(() => {
    jest.resetModules();
  });

  beforeEach(async () => {
    await configurePlatformSettingsForTest();
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
    const repo = makeProgramAgreements(null);
    const soviet = makeSovietPort(COAGREEMENT);
    const service = new MarketplaceOnboardingService(repo, soviet, makeLogger());

    const state = await service.getOnboardingState('alice');
    expect(state.requires_gate).toBe(false);
    expect(state.source).toBe(MarketplaceOnboardingSource.NOT_CONFIGURED);
    expect(state.template_registry_id).toBe(0);
    expect(soviet.getCoagreement).not.toHaveBeenCalled();
    expect(repo.findProgramSignature).not.toHaveBeenCalled();
  });

  it('ЦПП не настроена как программа (нет коагримента) → not_configured', async () => {
    jest.dontMock('~/extensions/marketplace/constants/marketplace-agreement-ids');
    const { MarketplaceOnboardingService } = await import(
      '~/extensions/marketplace/application/onboarding/marketplace-onboarding.service'
    );
    const repo = makeProgramAgreements(null);
    const service = new MarketplaceOnboardingService(repo, makeSovietPort(null), makeLogger());

    const state = await service.getOnboardingState('alice');
    expect(state.requires_gate).toBe(false);
    expect(state.source).toBe(MarketplaceOnboardingSource.NOT_CONFIGURED);
    expect(repo.findProgramSignature).not.toHaveBeenCalled();
  });

  it('подпись программы есть → requires_gate=false, source=agreement_signed, completed_at из signed_at', async () => {
    jest.dontMock('~/extensions/marketplace/constants/marketplace-agreement-ids');
    const { MarketplaceOnboardingService } = await import(
      '~/extensions/marketplace/application/onboarding/marketplace-onboarding.service'
    );
    const repo = makeProgramAgreements(makeProgram());
    const service = new MarketplaceOnboardingService(repo, makeSovietPort(COAGREEMENT), makeLogger());

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
    const repo = makeProgramAgreements(null);
    const service = new MarketplaceOnboardingService(repo, makeSovietPort(COAGREEMENT), makeLogger());

    const state = await service.getOnboardingState('alice');
    expect(state.requires_gate).toBe(true);
    expect(state.source).toBe(MarketplaceOnboardingSource.GATE_REQUIRED);
  });

  it('owner есть, но другой program_id → requires_gate=true', async () => {
    jest.dontMock('~/extensions/marketplace/constants/marketplace-agreement-ids');
    const { MarketplaceOnboardingService } = await import(
      '~/extensions/marketplace/application/onboarding/marketplace-onboarding.service'
    );
    // Подпись есть, но по другой программе (capital) — порт её не отдаёт.
    const repo = makeProgramAgreements(null);
    const service = new MarketplaceOnboardingService(repo, makeSovietPort(COAGREEMENT), makeLogger());

    const state = await service.getOnboardingState('alice');
    expect(state.requires_gate).toBe(true);
  });

  it('owner.present=false (откат форком) → подпись не засчитывается, requires_gate=true', async () => {
    jest.dontMock('~/extensions/marketplace/constants/marketplace-agreement-ids');
    const { MarketplaceOnboardingService } = await import(
      '~/extensions/marketplace/application/onboarding/marketplace-onboarding.service'
    );
    // Подпись откатило форком — порт больше её не видит.
    const repo = makeProgramAgreements(null);
    const service = new MarketplaceOnboardingService(repo, makeSovietPort(COAGREEMENT), makeLogger());

    const state = await service.getOnboardingState('alice');
    expect(state.requires_gate).toBe(true);
  });
});

/**
 * Подписание оферты ЦПП пайщиком (L3).
 *
 * Оферта подписывается через `wallet::signagree` в программу ЦПП, поэтому
 * подписание невозможно, пока у соглашения нет программного кошелька: без
 * program_id подпись некуда положить, и пайщик остался бы с гейтом навсегда,
 * не понимая причины. Отказ обязан быть внятным и до обращения к цепи.
 */
describe('MarketplaceOnboardingService.signOnboardingOffer', () => {
  const signedDocument = { hash: 'doc-hash', signatures: [{ signer: 'alice' }] } as never;

  // Программа по умолчанию несёт draft_id, ОТЛИЧНЫЙ от коагримента (1100):
  // подпись обязана уйти с шаблоном программы, и подмена источника сразу видна.
  async function loadService(
    coagreement: unknown,
    wallet = makeWalletPort(),
    programs: any[] = [{ id: PROGRAM_ID, draft_id: 1102 }]
  ) {
    jest.dontMock('~/extensions/marketplace/constants/marketplace-agreement-ids');
    const { MarketplaceOnboardingService } = await import(
      '~/extensions/marketplace/application/onboarding/marketplace-onboarding.service'
    );
    const service = new MarketplaceOnboardingService(
      makeUserAgreementRepo(null),
      makeSovietPort(coagreement, programs),
      wallet,
      makeLogger()
    );
    return { service, wallet };
  }

  it('соглашение ЦПП без программного кошелька → отказ, цепь не трогаем', async () => {
    const { service, wallet } = await loadService({ ...COAGREEMENT, program_id: 0 });

    await expect(
      service.signOnboardingOffer({ coopname: 'voskhod', username: 'alice', document: signedDocument })
    ).rejects.toThrow('не имеет программного wallet');

    expect(wallet.signProgramAgreement).not.toHaveBeenCalled();
  });

  it('соглашение ЦПП вообще не настроено → отказ с указанием, что выполнить', async () => {
    const { service, wallet } = await loadService(null);

    await expect(
      service.signOnboardingOffer({ coopname: 'voskhod', username: 'alice', document: signedDocument })
    ).rejects.toThrow('не настроено соглашение типа');

    expect(wallet.signProgramAgreement).not.toHaveBeenCalled();
  });

  it('цепь недоступна в момент подписи → ошибка наружу, состояние не меняется', async () => {
    // Подпись — единственное действие этого пути: локально фиксировать нечего,
    // поэтому отказ цепи просто поднимается вызывающему, и пайщик увидит гейт
    // при следующем заходе.
    const wallet = {
      signProgramAgreement: jest.fn().mockRejectedValue(new Error('chain timeout')),
    } as never as ReturnType<typeof makeWalletPort>;
    const { service } = await loadService(COAGREEMENT, wallet);

    await expect(
      service.signOnboardingOffer({ coopname: 'voskhod', username: 'alice', document: signedDocument })
    ).rejects.toThrow('chain timeout');
  });

  it('настроенное соглашение → подпись уходит в цепь с draft_id из программы, а не из коагримента', async () => {
    // `wallet::signagree` сверяет присланный draft_id с
    // `soviet::programs[program_id].draft_id`. После правки шаблона через
    // `soviet::editprog` коагримент остаётся со старым значением — взяли бы его,
    // подпись падала бы «draft_id соглашения не совпадает с draft_id программы».
    const wallet = {
      signProgramAgreement: jest.fn().mockResolvedValue({ transaction_id: 'tx-1' }),
    } as never as ReturnType<typeof makeWalletPort>;
    const { service } = await loadService({ ...COAGREEMENT, draft_id: 699 }, wallet);

    await service.signOnboardingOffer({
      coopname: 'voskhod',
      username: 'alice',
      document: signedDocument,
    });

    expect(wallet.signProgramAgreement).toHaveBeenCalledWith(
      expect.objectContaining({
        coopname: 'voskhod',
        username: 'alice',
        program_id: PROGRAM_ID,
        draft_id: 1102,
      })
    );
  });

  it('программа ЦПП не создана в кооперативе → отказ, подпись не отправляется', async () => {
    const { service, wallet } = await loadService(COAGREEMENT, makeWalletPort(), []);

    await expect(
      service.signOnboardingOffer({
        coopname: 'voskhod',
        username: 'alice',
        document: signedDocument,
      })
    ).rejects.toThrow(/не найдена/);

    expect(wallet.signProgramAgreement).not.toHaveBeenCalled();
  });
});
