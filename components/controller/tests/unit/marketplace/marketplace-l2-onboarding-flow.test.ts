/**
 * Story 1.11 — интеграционный scenario-тест L2 онбординга.
 *
 * Backend marketplace для L2 не вносит нового кода: flow держится на
 * `core registration-flow` + подписи программной оферты в
 * `wallet::users.programs[]` → MarketplaceOnboardingService. Этот тест явно
 * фиксирует контракт:
 *
 *  1. ЦПП «Стол заказов» заведена как программа — `soviet::coagreements`
 *     отдаёт program_id;
 *  2. Пайщик прошёл L2 (core registration-flow подписал оферту), и подпись
 *     лежит в `wallet::users.programs[]` с этим program_id;
 *  3. При первом входе на marketplace-стол `getOnboardingState` НЕ
 *     показывает L3 gate (`requires_gate: false`, `source: 'agreement_signed'`).
 *
 * Если фоллоуап story введёт source-маркер `'registration_flow'`, кейс
 * расширится — сейчас он эквивалентен «подпись есть» (см. Story 1.4 DTO).
 */
import { MARKETPLACE_OFFER_TEMPLATE_REGISTRY_ID } from '~/extensions/marketplace/constants/marketplace-agreement-ids';
import { MarketplaceOnboardingService } from '~/extensions/marketplace/application/onboarding/marketplace-onboarding.service';

const PROGRAM_ID = 2;
const SIGNED_AT = '2026-05-14T15:00:00Z';

/** Запись пайщика из `wallet::users` с подписанными программами. */
const makeOwner = (programs: any[] = []) =>
  ({
    present: true,
    findProgram: (program_id: number | string) =>
      programs.find((p) => Number(p.program_id) === Number(program_id)),
  } as any);

const makeRepo = (owner: any) =>
  ({
    findByUsername: jest.fn().mockResolvedValue(owner),
  } as any);

const makeLogger = () =>
  ({
    setContext: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  } as any);

// ЦПП заведена как программа: без program_id гейтить нечем и состояние
// вырождается в `not_configured` независимо от подписи.
const makeSovietPort = (coagreement: any = { program_id: PROGRAM_ID, draft_id: 1100 }) =>
  ({
    getCoagreement: jest.fn().mockResolvedValue(coagreement),
  } as any);

const makeWalletPort = () =>
  ({
    signProgramAgreement: jest.fn(),
  } as any);

describe('L2 онбординг (Story 1.11) — scenario: подпись через core registration-flow', () => {
  it('пайщик подписал marketplace_offer при вступлении → marketplace stol открывается без gate', async () => {
    const repo = makeRepo(makeOwner([{ program_id: PROGRAM_ID, signed_at: SIGNED_AT }]));
    const service = new MarketplaceOnboardingService(repo, makeSovietPort(), makeWalletPort(), makeLogger());

    const state = await service.getOnboardingState('alice');

    expect(state.requires_gate).toBe(false);
    expect(state.source).toBe('agreement_signed');
    expect(state.template_registry_id).toBe(MARKETPLACE_OFFER_TEMPLATE_REGISTRY_ID);
    expect(state.completed_at).toBe(SIGNED_AT);
  });

  it('пайщик НЕ выбрал marketplace при регистрации → L3 gate сработает при первом входе', async () => {
    const repo = makeRepo(makeOwner([])); // подписи программы нет
    const service = new MarketplaceOnboardingService(repo, makeSovietPort(), makeWalletPort(), makeLogger());

    const state = await service.getOnboardingState('bob');

    expect(state.requires_gate).toBe(true);
    expect(state.source).toBe('gate_required');
  });

  it('чужая программа не засчитывается за подпись «Стола заказов»', async () => {
    // В `programs[]` пайщика лежит подпись другой ЦПП — по program_id она не
    // совпадает с «Столом заказов», значит gate обязан сработать.
    const repo = makeRepo(makeOwner([{ program_id: PROGRAM_ID + 1, signed_at: SIGNED_AT }]));
    const service = new MarketplaceOnboardingService(repo, makeSovietPort(), makeWalletPort(), makeLogger());

    const state = await service.getOnboardingState('alice');

    expect(state.requires_gate).toBe(true);
    expect(state.source).toBe('gate_required');
  });
});
