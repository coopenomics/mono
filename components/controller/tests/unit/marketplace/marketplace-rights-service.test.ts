/**
 * Unit-тесты MarketplaceRightsService: подключение заказчика и связь с цепью.
 *
 * Состояние оферты читается с участием цепи. Чтение своих заказов и корзины от
 * связи с цепью зависеть не должно: пайщик, которого узел уже видел
 * подключённым, остаётся подключённым, пока цепь недоступна.
 */
import { MarketplaceRightsService } from '~/extensions/marketplace/application/access/marketplace-rights.service';
import { MarketplaceOnboardingSource } from '~/extensions/marketplace/application/dto/marketplace-onboarding-state.dto';

const signed = { requires_gate: false, source: MarketplaceOnboardingSource.AGREEMENT_SIGNED };

function makeService(onboarding: any, cart: any = { findByOrderer: jest.fn().mockResolvedValue({ delivery_braname: 'krg' }) }) {
  const config = { get: jest.fn().mockResolvedValue({ coopAcceptance: { accepted: true }, warehouse: {} }) } as any;
  return new MarketplaceRightsService(config, onboarding, cart);
}

describe('MarketplaceRightsService — подключение заказчика', () => {
  afterEach(() => jest.restoreAllMocks());

  // mkt.rights.side.08
  it('цепь недоступна: пайщик, которого узел видел подключённым, остаётся подключённым', async () => {
    const onboarding = {
      getOnboardingState: jest.fn().mockResolvedValueOnce(signed).mockRejectedValue(new Error('chain down')),
    };
    const service = makeService(onboarding);
    const now = jest.spyOn(Date, 'now');

    now.mockReturnValue(1_000);
    expect(await service.isOrdererOnboarded('voskhod', 'alice')).toBe(true);

    // Память о подключении истекла, цепь к этому времени недоступна.
    now.mockReturnValue(1_000 + 61_000);
    expect(await service.isOrdererOnboarded('voskhod', 'alice')).toBe(true);

    // Пайщика, которого узел подключённым не видел, недоступная цепь не подключает.
    await expect(service.isOrdererOnboarded('voskhod', 'bob')).rejects.toThrow('chain down');
  });

  it('подтверждённое подключение помнится минуту и не спрашивается на каждый вызов', async () => {
    const onboarding = { getOnboardingState: jest.fn().mockResolvedValue(signed) };
    const service = makeService(onboarding);
    await service.isOrdererOnboarded('voskhod', 'alice');
    await service.isOrdererOnboarded('voskhod', 'alice');
    expect(onboarding.getOnboardingState).toHaveBeenCalledTimes(1);
  });

  it('отказ не запоминается: подключившийся пайщик проходит сразу', async () => {
    const onboarding = {
      getOnboardingState: jest
        .fn()
        .mockResolvedValueOnce({ requires_gate: true, source: MarketplaceOnboardingSource.GATE_REQUIRED })
        .mockResolvedValue(signed),
    };
    const service = makeService(onboarding);
    expect(await service.isOrdererOnboarded('voskhod', 'alice')).toBe(false);
    expect(await service.isOrdererOnboarded('voskhod', 'alice')).toBe(true);
  });

  it('оферта подписана, пункт выдачи не выбран → не подключён', async () => {
    const service = makeService(
      { getOnboardingState: jest.fn().mockResolvedValue(signed) },
      { findByOrderer: jest.fn().mockResolvedValue(null) }
    );
    expect(await service.isOrdererOnboarded('voskhod', 'alice')).toBe(false);
  });
});
