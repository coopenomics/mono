<template lang="pug">
.wallet-programs(v-if='canonPrograms.length > 0 || minimumBalance')
  //- Минимальный неснижаемый остаток — отдельная сущность пайщика
  //- (паевой взнос). Та же canon-разметка .wallet, чтобы встать
  //- в общую сетку, но с нейтральной подсветкой иконки. Первым,
  //- т.к. это базовая защита средств пайщика — раньше кошельков.
  .wallet.wallet--minimum(v-if='minimumBalance')
    span.wallet__icon
      q-icon(name='savings')
    .wallet__main
      .wallet__title(title='Минимальный неснижаемый остаток') Минимальный неснижаемый остаток
      .wallet__sub(title='Возвращается при выходе из кооператива') Возвращается при выходе из кооператива
    .wallet__amount
      .wallet__metric
        .wallet__metric-val
          | {{ minimumBalance.amount }}
          span.ccy &nbsp;{{ minimumBalance.symbol }}
        .wallet__metric-label Зарезервировано

  WalletCard(
    v-for='entry in canonPrograms',
    :key='entry.zeusType',
    :program='entry.program',
    :balance='entry.balance',
    :symbol='entry.symbol',
    :locked-balance='entry.locked'
  )

EmptyState(
  v-else,
  title='Нет кошельков программ',
  body='У вас пока нет кошельков целевых потребительских программ.'
)
  template(#icon)
    q-icon(name='inbox', size='48px')
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { useWalletStore } from 'src/entities/Wallet';
import { useSessionStore } from 'src/entities/Session';
import { useSystemStore } from 'src/entities/System/model';
import { WalletCard } from 'src/shared/ui/domain/WalletCard';
import type { WalletProgram } from 'src/shared/ui/domain/WalletCard';
import { EmptyState } from 'src/shared/ui/base/EmptyState';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';

interface CanonProgramEntry {
  zeusType: Zeus.ProgramType;
  program: WalletProgram;
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
const { info } = useSystemStore();

// Канон-набор программ платформы: Кошелёк / Благорост / Генератор.
// MARKETPLACE и прочие — отдельные виджеты, в столе пайщика не отображаются.
const ZEUS_TO_CANON: Partial<Record<Zeus.ProgramType, WalletProgram>> = {
  [Zeus.ProgramType.MAIN]: 'wallet',
  [Zeus.ProgramType.BLAGOROST]: 'blagorost',
  [Zeus.ProgramType.GENERATOR]: 'generator',
};

function splitAsset(asset?: string | null): { amount: string; symbol: string } {
  if (!asset) return { amount: '0,00', symbol: '' };
  const formatted = formatAsset2Digits(asset);
  const parts = formatted.split(' ');
  return { amount: parts[0] || '0,00', symbol: parts[1] || '' };
}

const canonPrograms = computed<CanonProgramEntry[]>(() =>
  walletStore.program_wallets.flatMap<CanonProgramEntry>((w) => {
    const program = ZEUS_TO_CANON[w.program_type as Zeus.ProgramType];
    if (!program) return [];
    const available = splitAsset(w.available);
    const blocked = splitAsset(w.blocked);
    const hasBlocked = parseFloat(w.blocked || '0') > 0;
    return [
      {
        zeusType: w.program_type as Zeus.ProgramType,
        program,
        balance: available.amount,
        symbol:
          available.symbol || info.symbols?.root_govern_symbol || 'RUB',
        locked: hasBlocked ? blocked.amount : undefined,
      },
    ];
  }),
);

// Минимальный неснижаемый остаток — паевой взнос пайщика, возвращается
// при выходе из кооператива. Это НЕ баланс кошелька, а самостоятельная
// сущность пайщика — рендерим отдельной карточкой в общей сетке.
const minimumBalance = computed<MinimumBalance | undefined>(() => {
  const raw = session.participantAccount?.minimum_amount;
  if (!raw) return undefined;
  if (parseFloat(raw) <= 0) return undefined;
  const split = splitAsset(`${raw} ${info.symbols.root_govern_symbol}`);
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

.wallet--minimum {
  --prog-bg: var(--p-canvas-2);
  --prog-fg: var(--p-ink-2);
}
</style>
