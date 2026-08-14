/**
 * Подпись оферты Стола заказов закрыта от посторонних.
 *
 * Оферта — соглашение пайщика с кооперативом; подписать её, не будучи
 * действующим пайщиком, нельзя. Само правило живёт в
 * `MarketplaceMembershipGuard` и проверено отдельно
 * (`marketplace-membership-guard.test.ts`: неактивный статус → 403, запрос без
 * JWT → 401). Здесь проверяется вторая половина — что guard действительно
 * навешан на мутацию подписи.
 *
 * Расходятся эти половины молча: guard можно написать безупречно и забыть
 * повесить, и тогда запрос постороннего дойдёт до сервиса и уйдёт на цепь
 * `wallet::signagree`. По отдельности обе стороны выглядят целыми.
 */
import { MarketplaceMembershipGuard } from '~/extensions/marketplace/application/guards/marketplace-membership.guard';
import { MarketplaceOnboardingResolver } from '~/extensions/marketplace/application/resolvers/marketplace-onboarding.resolver';

/** Ключ, под которым Nest хранит guard'ы метода. */
const GUARDS_METADATA = '__guards__';

function guardsOf(method: string): unknown[] {
  const proto = MarketplaceOnboardingResolver.prototype as unknown as Record<string, object>;
  return (Reflect.getMetadata(GUARDS_METADATA, proto[method]) as unknown[]) ?? [];
}

describe('доступ к онбордингу Стола заказов', () => {
  it('мутация подписи оферты закрыта guard членства', () => {
    expect(guardsOf('marketplaceSignOnboardingOffer')).toContain(MarketplaceMembershipGuard);
  });

  it('чтение состояния онбординга тоже закрыто guard членства', () => {
    // Состояние подключения показывает, что именно кооператив требует от
    // пайщика; постороннему оно тоже не адресовано.
    expect(guardsOf('marketplaceOnboardingState')).toContain(MarketplaceMembershipGuard);
  });
});
