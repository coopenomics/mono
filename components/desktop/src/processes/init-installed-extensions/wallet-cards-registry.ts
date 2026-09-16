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
 * (`w.wal.share`) идёт ПЕРВЫМ (сразу после минимального неснижаемого
 * остатка, который рендерится отдельной карточкой виджета) — у него
 * приоритет; кошельки расширений идут после него.
 *
 * Что НЕ устанавливается на стол пайщика: Генератор (`w.cap.gen`,
 * кооперативный кошелёк без L3). Членских кошельков в паевой модели нет.
 * Минимальный неснижаемый паевой остаток — отдельная карточка виджета,
 * не через реестр.
 */
const CORE_WALLET_CARDS: DesktopWalletCard[] = [
  {
    wallet_name: 'w.wal.share',
    label: 'Главный паевой кошелёк',
    description: 'Цифровой кошелёк',
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
  // Главный паевой кошелёк ЦК — первым (приоритет), сразу за ним кошельки
  // расширений. Минимальный неснижаемый остаток рендерится ещё выше отдельной
  // карточкой виджета, мимо реестра.
  const collected: DesktopWalletCard[] = [...CORE_WALLET_CARDS];

  for (const ext of installedExtensionNames) {
    const cards = WALLET_CARDS_BY_EXTENSION[ext];
    if (cards) collected.push(...cards);
  }

  const seen = new Set<string>();
  return collected.filter((card) => {
    if (seen.has(card.wallet_name)) return false;
    seen.add(card.wallet_name);
    return true;
  });
}
