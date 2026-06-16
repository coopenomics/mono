import type { DesktopWalletCard } from 'src/shared/lib/types/desktop-wallet';
import { walletCards as capitalWalletCards } from '../../../extensions/capital/install';
import { walletCards as marketWalletCards } from '../../../extensions/market/install';

/**
 * Реестр-фабрика кошельков стола пайщика (путь B).
 *
 * Каждое расширение объявляет свои кошельки декларацией `walletCards`
 * в своём `install.ts`. Здесь они собираются по имени расширения; core-набор
 * (паевой кошелёк программы «Цифровой Кошелёк») добавляется всегда первым.
 * `collectWalletCards` берёт только установленные у кооператива расширения,
 * объединяет их декларации с core и дедупит по `wallet_name` (первое
 * вхождение выигрывает — так пересечение нескольких расширений на один
 * кошелёк схлопывается в одну карточку). Главный паевой кошелёк ЦК
 * (`w.wal.share`) идёт ПОСЛЕ кошельков расширений — это такая же ЦПП, как
 * «Стол заказов», и стоит рядом с программными кошельками, а не первым.
 *
 * Что НЕ устанавливается на стол пайщика: главный членский (`w.wal.member`,
 * программа ЦК) и Генератор (`w.cap.gen`, кооперативный кошелёк без L3).
 * Минимальный неснижаемый паевой остаток — отдельная карточка виджета,
 * не через реестр.
 */
const CORE_WALLET_CARDS: DesktopWalletCard[] = [
  {
    wallet_name: 'w.wal.share',
    label: 'Главный кошелёк',
    description: 'Паевой взнос',
    accent: 'wallet',
    icon: 'account_balance_wallet',
  },
];

const WALLET_CARDS_BY_EXTENSION: Record<string, DesktopWalletCard[]> = {
  capital: capitalWalletCards,
  market: marketWalletCards,
};

/**
 * Собрать карточки кошельков для рендера на столе пайщика по набору
 * установленных расширений (их `extension_name`). Дедуп по `wallet_name`.
 */
export function collectWalletCards(installedExtensionNames: Iterable<string>): DesktopWalletCard[] {
  const collected: DesktopWalletCard[] = [];

  for (const ext of installedExtensionNames) {
    const cards = WALLET_CARDS_BY_EXTENSION[ext];
    if (cards) collected.push(...cards);
  }

  // Главный паевой кошелёк ЦК — после кошельков расширений (вниз списка).
  collected.push(...CORE_WALLET_CARDS);

  const seen = new Set<string>();
  return collected.filter((card) => {
    if (seen.has(card.wallet_name)) return false;
    seen.add(card.wallet_name);
    return true;
  });
}
