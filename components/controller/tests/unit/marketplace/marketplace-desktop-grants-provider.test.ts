/**
 * Unit-тесты MarketplaceDesktopGrantsProvider — канон видимости столов.
 *
 * Покрывают двухуровневый онбординг-гейт:
 *   (L1 кооператив) пока coopAcceptance.accepted !== true → у председателя
 *      только ['Extension:configure'], у прочих [].
 *   (L3 пайщик-заказчик) после принятия ЦПП orderer-права выдаются только
 *      если пайщик подписал персональную оферту (requires_gate=false):
 *        - не подписал → orderer-права отсутствуют, выдан маркер
 *          'Onboarding:orderer';
 *        - подписал → полный набор orderer-прав, маркера нет;
 *        - прочие роли (admin/operator/offerer) от L3-оферты не зависят.
 *   Гость / не-active → [].
 */
import { MonoAccountStatusDomainInterface } from '~/domain/account/interfaces/mono-account-domain.interface';
import { MarketplaceDesktopGrantsProvider } from '~/extensions/marketplace/application/desktop/marketplace-desktop-grants.provider';

function makeProvider(opts: {
  isOfferer?: boolean;
  isKuChairman?: boolean;
  requiresGate?: boolean;
}) {
  const registry = { register: jest.fn() } as any;
  const whitelist = {
    isOfferer: jest.fn().mockResolvedValue(opts.isOfferer ?? false),
  } as any;
  const kuChairman = {
    isKuChairman: jest.fn().mockResolvedValue(opts.isKuChairman ?? false),
  } as any;
  const onboarding = {
    getOnboardingState: jest
      .fn()
      .mockResolvedValue({ requires_gate: opts.requiresGate ?? false }),
  } as any;
  const provider = new MarketplaceDesktopGrantsProvider(
    registry,
    whitelist,
    kuChairman,
    onboarding,
  );
  return { provider, onboarding };
}

const baseCtx = {
  coopname: 'voskhod',
  username: 'alice',
  userStatus: MonoAccountStatusDomainInterface.Active,
};

describe('MarketplaceDesktopGrantsProvider', () => {
  it('гость (нет username) → []', async () => {
    const { provider } = makeProvider({});
    expect(await provider.resolveGrants({ coopname: 'voskhod' })).toEqual([]);
  });

  it('не-active пайщик → []', async () => {
    const { provider } = makeProvider({});
    const grants = await provider.resolveGrants({
      ...baseCtx,
      userRole: 'user',
      userStatus: 'pending' as any,
    });
    expect(grants).toEqual([]);
  });

  describe('L1: ЦПП ещё не принята кооперативом', () => {
    it('председатель → только Extension:configure', async () => {
      const { provider } = makeProvider({});
      const grants = await provider.resolveGrants({
        ...baseCtx,
        userRole: 'chairman',
        config: { coopAcceptance: { accepted: false } },
      });
      expect(grants).toEqual(['Extension:configure']);
    });

    it('обычный пайщик → []', async () => {
      const { provider } = makeProvider({});
      const grants = await provider.resolveGrants({
        ...baseCtx,
        userRole: 'user',
        config: {},
      });
      expect(grants).toEqual([]);
    });
  });

  describe('L3: ЦПП принята, гейт оферты заказчика', () => {
    const acceptedConfig = { coopAcceptance: { accepted: true } };

    it('пайщик НЕ подписал оферту → маркер Onboarding:orderer, без рабочих прав', async () => {
      const { provider } = makeProvider({ requiresGate: true });
      const grants = await provider.resolveGrants({
        ...baseCtx,
        userRole: 'user',
        config: acceptedConfig,
      });
      expect(grants).toContain('Onboarding:orderer');
      expect(grants).not.toContain('Offer:read');
      expect(grants).not.toContain('Order:read:own');
    });

    it('пайщик подписал оферту → полные orderer-права, без маркера', async () => {
      const { provider } = makeProvider({ requiresGate: false });
      const grants = await provider.resolveGrants({
        ...baseCtx,
        userRole: 'user',
        config: acceptedConfig,
      });
      expect(grants).not.toContain('Onboarding:orderer');
      expect(grants).toContain('Offer:read');
      expect(grants).toContain('Order:read:own');
    });

    it('председатель без подписи L3 сохраняет admin-права, заказчицкие рабочие страницы под гейтом', async () => {
      const { provider } = makeProvider({ requiresGate: true });
      const grants = await provider.resolveGrants({
        ...baseCtx,
        userRole: 'chairman',
        config: acceptedConfig,
      });
      // admin/board права не зависят от L3-оферты заказчика
      expect(grants).toContain('Order:read:all');
      expect(grants).toContain('Whitelist:manage');
      expect(grants).toContain('Extension:configure');
      // маркер онбординга выдан (orderer-роль гейтится)
      expect(grants).toContain('Onboarding:orderer');
      // orderer-эксклюзивное рабочее право (оформление заказа) под гейтом:
      // у admin/board его нет, а из orderer-набора оно не выдаётся до подписи.
      // (read-права заказчика председатель видит через разворот Order:read:all —
      // это привилегия совета, не предмет L3-гейта пайщика.)
      expect(grants).not.toContain('Order:create');
    });

    it('L3-гейт спрашивается только для orderer-роли (по username)', async () => {
      const { provider, onboarding } = makeProvider({ requiresGate: false });
      await provider.resolveGrants({
        ...baseCtx,
        userRole: 'user',
        config: acceptedConfig,
      });
      expect(onboarding.getOnboardingState).toHaveBeenCalledWith('alice');
    });
  });
});
