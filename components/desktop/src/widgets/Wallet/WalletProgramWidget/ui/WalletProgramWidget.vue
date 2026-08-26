<template lang="pug">
.wallet-programs(v-if='cardEntries.length > 0 || minimumBalance')
  //- Минимальный неснижаемый остаток — отдельная сущность пайщика
  //- (паевой взнос). Тот же WalletCard (нейтральный вариант), чтобы получить
  //- общую сетку И бегущую строку при переполнении заголовка/подписи. Первым,
  //- т.к. это базовая защита средств пайщика — раньше кошельков.
  WalletCard(
    v-if='minimumBalance',
    neutral,
    icon='savings',
    title='Минимальный неснижаемый остаток',
    subtitle='Возвращается при выходе из кооператива',
    :balance='minimumBalance.amount',
    :symbol='minimumBalance.symbol',
    balance-label='Зарезервировано'
  )

  WalletCard(
    v-for='entry in cardEntries',
    :key='entry.key',
    :program='entry.program',
    :title='entry.title',
    :subtitle='entry.subtitle',
    :icon='entry.icon',
    :balance='entry.balance',
    :symbol='entry.symbol',
    :locked-balance='entry.locked'
  )

EmptyState(
  v-else,
  title='Нет кошельков',
  body='У вас пока нет кошельков на столе пайщика.'
)
  template(#icon)
    q-icon(name='inbox', size='48px')
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { useWalletStore } from 'src/entities/Wallet';
import type { IUserWalletData } from 'src/entities/Wallet';
import { useSessionStore } from 'src/entities/Session';
import { useSystemStore } from 'src/entities/System/model';
import { useDesktopStore } from 'src/entities/Desktop/model/store';
import { collectWalletCards } from 'src/processes/init-installed-extensions/wallet-cards-registry';
import { WalletCard } from 'src/shared/ui/domain/WalletCard';
import type { WalletProgram } from 'src/shared/ui/domain/WalletCard';
import { EmptyState } from 'src/shared/ui/base/EmptyState';
import { splitAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';

interface WalletCardEntry {
  key: string;
  program: WalletProgram;
  title: string;
  subtitle?: string;
  icon?: string;
  balance: string;
  symbol: string;
  locked?: string;
}

interface MinimumBalance {
  amount: string;
  symbol: string;
}

const walletStore = useWalletStore();
const session = useSessionStore();
const desktop = useDesktopStore();
const { info } = useSystemStore();


// Установленные у кооператива расширения — по их workspace'ам с бэкенда.
// Реестр-фабрика (путь B) собирает карточки кошельков core + только этих
// расширений; кошельки неустановленных расширений на стол пайщика не попадают.
const installedExtensions = computed<string[]>(() =>
  desktop.workspaceMenus.map((menu) => menu.extensionName).filter(Boolean),
);

const walletByName = computed<Map<string, IUserWalletData>>(() => {
  const map = new Map<string, IUserWalletData>();
  for (const wallet of walletStore.user_wallets) {
    map.set(wallet.wallet_name, wallet);
  }
  return map;
});

const cardEntries = computed<WalletCardEntry[]>(() =>
  collectWalletCards(installedExtensions.value).map((card) => {
    const row = walletByName.value.get(card.wallet_name);
    const available = splitAsset2Digits(row?.available);
    const blocked = splitAsset2Digits(row?.blocked);
    const hasBlocked = parseFloat(row?.blocked || '0') > 0;
    return {
      key: card.wallet_name,
      program: card.accent ?? 'wallet',
      title: card.label,
      subtitle: card.description,
      icon: card.icon,
      balance: available.amount,
      symbol: available.symbol || info.symbols?.root_govern_symbol || 'RUB',
      locked: hasBlocked ? blocked.amount : undefined,
    };
  }),
);

// Минимальный неснижаемый остаток — паевой взнос пайщика, возвращается
// при выходе из кооператива. Это НЕ баланс кошелька, а самостоятельная
// сущность пайщика — рендерим отдельной карточкой в общей сетке.
const minimumBalance = computed<MinimumBalance | undefined>(() => {
  const raw = session.participantAccount?.minimum_amount;
  if (!raw) return undefined;
  if (parseFloat(raw) <= 0) return undefined;
  const split = splitAsset2Digits(`${raw} ${info.symbols.root_govern_symbol}`);
  return { amount: split.amount, symbol: split.symbol };
});
</script>

<style lang="scss" scoped>
/* Кошельки — список во всю ширину страницы (одна колонка), а не сетка.
   Каждая карточка-строка вмещает заголовок в одну строку; если не влезает —
   ellipsis + нативный tooltip (title) показывает целиком при наведении. */
.wallet-programs {
  display: flex;
  flex-direction: column;
  gap: var(--p-3, 12px);
}
</style>
