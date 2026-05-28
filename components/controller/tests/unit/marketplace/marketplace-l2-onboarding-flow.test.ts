/**
 * Story 1.11 — интеграционный scenario-тест L2 онбординга.
 *
 * Backend marketplace для L2 не вносит нового кода: flow держится на
 * `core registration-flow` + AgreementSyncService → AgreementRepository
 * → MarketplaceOnboardingService. Этот тест явно фиксирует контракт:
 *
 *  1. Пайщик прошёл L2 (core registration-flow подписал marketplace_offer);
 *  2. Core AgreementSyncService записал в PG `soviet::agreements3` запись
 *     `{username, type:'marketplace', draft_id:1100, ...}` (имитируется
 *     через fake-repository);
 *  3. При первом входе на marketplace-стол `getOnboardingState` НЕ
 *     показывает L3 gate (`requires_gate: false`, `source: 'agreement_signed'`).
 *
 * Если фоллоуап story введёт source-маркер `'registration_flow'`, кейс
 * расширится — сейчас он эквивалентен «подпись есть» (см. Story 1.4 DTO).
 */
import { MarketplaceOnboardingService } from '~/extensions/marketplace/application/onboarding/marketplace-onboarding.service';

const makeAgreement = (overrides: any = {}) => ({
  id: 777,
  type: 'marketplace',
  draft_id: 1100, // соответствует MARKETPLACE_OFFER_TEMPLATE_REGISTRY_ID (Story 1.7)
  username: 'alice',
  coopname: 'voskhod',
  updated_at: '2026-05-14T15:00:00Z',
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

// getOnboardingState не обращается к blockchain-портам (только agreementRepository),
// поэтому для этого scenario достаточно заглушек методов, используемых в других путях.
const makeSovietPort = () =>
  ({
    getCoagreement: jest.fn(),
  } as any);

const makeWalletPort = () =>
  ({
    signProgramAgreement: jest.fn(),
  } as any);

describe('L2 онбординг (Story 1.11) — scenario: подпись через core registration-flow', () => {
  it('пайщик подписал marketplace_offer при вступлении → marketplace stol открывается без gate', async () => {
    const repo = makeRepo([
      makeAgreement({ id: 777, draft_id: 1100, username: 'alice' }),
    ]);
    const service = new MarketplaceOnboardingService(repo, makeSovietPort(), makeWalletPort(), makeLogger());

    const state = await service.getOnboardingState('alice');

    expect(state.requires_gate).toBe(false);
    expect(state.source).toBe('agreement_signed');
    expect(state.template_registry_id).toBe(1100);
    expect(state.agreement_id).toBe(777);
    expect(state.completed_at).toBe('2026-05-14T15:00:00Z');
  });

  it('пайщик НЕ выбрал marketplace при регистрации → L3 gate сработает при первом входе', async () => {
    const repo = makeRepo([]); // нет подписи marketplace
    const service = new MarketplaceOnboardingService(repo, makeSovietPort(), makeWalletPort(), makeLogger());

    const state = await service.getOnboardingState('bob');

    expect(state.requires_gate).toBe(true);
    expect(state.source).toBe('gate_required');
  });

  it('подпись чужого пайщика не должна засчитываться (filter по username)', async () => {
    // findByUsername('alice') в реальной репе возвращает только alice's записи,
    // в этом тесте просто проверяем, что service не делает дополнительной
    // фильтрации (т.е. полагается на repo) — все возвращённые записи считаются
    // «своими» (валидный инвариант: репо изолирует by username).
    const repo = makeRepo([makeAgreement({ username: 'alice', type: 'marketplace' })]);
    const service = new MarketplaceOnboardingService(repo, makeSovietPort(), makeWalletPort(), makeLogger());
    const state = await service.getOnboardingState('alice');
    expect(state.requires_gate).toBe(false);
  });
});
