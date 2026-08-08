/**
 * Unit-тесты MarketplaceDesktopGrantsProvider — канон видимости столов.
 *
 * Покрывают двухуровневый онбординг-гейт:
 *   (L1 кооператив) пока coopAcceptance.accepted !== true → у председателя
 *      только ['Extension:configure'], у прочих [].
 *   (L3 пайщик-заказчик) после принятия ЦПП orderer-права выдаются только при
 *      ДВУХ независимых фактах — подписана персональная оферта
 *      (requires_gate=false, могло случиться ещё на L2 при регистрации) И
 *      выбран КУ (MarketplaceCart.delivery_braname !== null):
 *        - не выполнено хотя бы одно → orderer-права отсутствуют, выдан
 *          маркер 'Onboarding:orderer';
 *        - выполнены оба → полный набор orderer-прав, маркера нет;
 *        - прочие роли (admin/operator/offerer) от L3-гейта не зависят.
 *   Гость / не-active → [].
 */
import { MonoAccountStatusDomainInterface } from '~/domain/account/interfaces/mono-account-domain.interface';
import { MarketplaceDesktopGrantsProvider } from '~/extensions/marketplace/application/desktop/marketplace-desktop-grants.provider';

function makeProvider(opts: {
  isOfferer?: boolean;
  isKuChairman?: boolean;
  requiresGate?: boolean;
  hasDeliveryPoint?: boolean;
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
  const cart = {
    findByOrderer: jest
      .fn()
      .mockResolvedValue(
        opts.hasDeliveryPoint ? { delivery_braname: 'ku-1' } : null,
      ),
  } as any;
  const provider = new MarketplaceDesktopGrantsProvider(
    registry,
    whitelist,
    kuChairman,
    onboarding,
    cart,
  );
  return { provider, onboarding, cart };
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

    it('пайщик НЕ подписал оферту (КУ тоже не выбран) → маркер Onboarding:orderer, без рабочих прав', async () => {
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

    it('пайщик подписал оферту на регистрации (L2), но НЕ выбрал КУ → маркер Onboarding:orderer сохраняется', async () => {
      // Регрессия: раньше requires_gate=false в одиночку материализовал полные
      // orderer-права, хотя выбора КУ при регистрации не было вовсе — пайщик
      // проваливался сразу на нефильтрованный каталог, минуя выбор пункта выдачи.
      const { provider, cart } = makeProvider({
        requiresGate: false,
        hasDeliveryPoint: false,
      });
      const grants = await provider.resolveGrants({
        ...baseCtx,
        userRole: 'user',
        config: acceptedConfig,
      });
      expect(cart.findByOrderer).toHaveBeenCalledWith('voskhod', 'alice');
      expect(grants).toContain('Onboarding:orderer');
      expect(grants).not.toContain('Offer:read');
      expect(grants).not.toContain('Order:read:own');
    });

    it('пайщик подписал оферту и выбрал КУ → полные orderer-права, без маркера', async () => {
      const { provider } = makeProvider({
        requiresGate: false,
        hasDeliveryPoint: true,
      });
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
