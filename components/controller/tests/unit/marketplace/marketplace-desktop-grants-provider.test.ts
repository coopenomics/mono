/**
 * Права страниц Стола заказов из описания прав приложения — канон видимости столов.
 *
 * Покрывают двухуровневый онбординг-гейт:
 *   (L1 кооператив) пока coopAcceptance.accepted !== true → у председателя
 *      только ['Extension:configure', 'Onboarding:coop'], у прочих [].
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
import { MonoAccountStatus } from '@coopenomics/innercoop';
import { desktopGrantsOf } from '@coopenomics/extension-kit';
import { MarketplaceRightsService } from '~/extensions/marketplace/application/access/marketplace-rights.service';
import { MarketplaceOnboardingSource } from '~/extensions/marketplace/application/dto/marketplace-onboarding-state.dto';

function makeProvider(opts: {
  isOfferer?: boolean;
  isKuChairman?: boolean;
  requiresGate?: boolean;
  source?: MarketplaceOnboardingSource;
  hasDeliveryPoint?: boolean;
}) {
  const registry = { register: jest.fn() } as any;
  const whitelist = {
    isOfferer: jest.fn().mockResolvedValue(opts.isOfferer ?? false),
  } as any;
  const kuChairman = {
    isKuChairman: jest.fn().mockResolvedValue(opts.isKuChairman ?? false),
  } as any;
  const requiresGate = opts.requiresGate ?? false;
  const onboarding = {
    getOnboardingState: jest.fn().mockResolvedValue({
      requires_gate: requiresGate,
      source:
        opts.source ??
        (requiresGate
          ? MarketplaceOnboardingSource.GATE_REQUIRED
          : MarketplaceOnboardingSource.AGREEMENT_SIGNED),
    }),
  } as any;
  const cart = {
    findByOrderer: jest
      .fn()
      .mockResolvedValue(
        opts.hasDeliveryPoint ? { delivery_braname: 'ku-1' } : null,
      ),
  } as any;
  // Права считает тот же сервис, что и серверный гард: конфиг приложения
  // провайдеру передаёт платформа, поэтому чтение конфига здесь не нужно.
  const rights = new MarketplaceRightsService({ get: jest.fn() } as any, onboarding, cart, whitelist, kuChairman, {} as any, registry);
  // Права стола выдаёт общий провайдер каркаса по описанию прав Стола заказов.
  const provider = desktopGrantsOf(rights);
  return { provider, onboarding, cart };
}

const baseCtx = {
  coopname: 'voskhod',
  username: 'alice',
  userStatus: MonoAccountStatus.Active,
};

describe('права страниц Стола заказов', () => {
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

  it('председатель со статусом registered получает права по роли', async () => {
    const { provider } = makeProvider({});
    const grants = await provider.resolveGrants({
      ...baseCtx,
      userRole: 'chairman',
      userStatus: 'registered' as any,
      config: { coopAcceptance: { accepted: false } },
    });
    expect(grants).toContain('Extension:configure');
  });

  describe('L1: ЦПП ещё не принята кооперативом', () => {
    it('председатель → настройка расширения и маркер страницы подключения', async () => {
      const { provider } = makeProvider({});
      const grants = await provider.resolveGrants({
        ...baseCtx,
        userRole: 'chairman',
        config: { coopAcceptance: { accepted: false } },
      });
      expect(grants).toEqual(expect.arrayContaining(['Extension:configure', 'Onboarding:coop']));
      // До решения совета рабочих прав нет ни у кого, включая председателя.
      expect(grants).not.toContain('KU:manage');
      expect(grants).not.toContain('Offer:read');
    });

    it('обычный пайщик → только состояние приложения и свои роли, страниц нет', async () => {
      const { provider } = makeProvider({});
      const grants = await provider.resolveGrants({
        ...baseCtx,
        userRole: 'user',
        config: {},
      });
      expect([...grants].sort()).toEqual(['Extension:read', 'Membership:read:own']);
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
      // Страница подключения ЦПП после принятия исчезает: маркер её видимости
      // живёт только до подключения.
      expect(grants).not.toContain('Onboarding:coop');
      // маркер онбординга выдан (orderer-роль гейтится)
      expect(grants).toContain('Onboarding:orderer');
      // orderer-эксклюзивное рабочее право (оформление заказа) под гейтом:
      // у admin/board его нет, а из orderer-набора оно не выдаётся до подписи.
      // (read-права заказчика председатель видит через разворот Order:read:all —
      // это привилегия совета, не предмет L3-гейта пайщика.)
      expect(grants).not.toContain('Order:create');
    });

    it('ЦПП не подключена кооперативом до конца → КУ выбран, но рабочих прав нет', async () => {
      // Инцидент 2026-08-10: в цепи не было создано программы ЦПП, из-за чего
      // состояние приходило как requires_gate=false (подписывать нечем). Одного
      // выбора пункта выдачи хватало, чтобы получить полный стол заказчика без
      // единой подписи. Подпись отсутствует ⇒ прав быть не должно.
      const { provider } = makeProvider({
        requiresGate: false,
        source: MarketplaceOnboardingSource.NOT_CONFIGURED,
        hasDeliveryPoint: true,
      });
      const grants = await provider.resolveGrants({
        ...baseCtx,
        userRole: 'user',
        config: acceptedConfig,
      });
      expect(grants).toContain('Onboarding:orderer');
      expect(grants).not.toContain('Offer:read');
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
