<template>
  <div
    :class="['wallet', { 'wallet--row': compact, 'wallet--empty': empty }]"
    :style="progStyle"
  >
    <span class="wallet__icon">
      <q-icon :name="resolvedIcon" />
    </span>

    <div class="wallet__main">
      <div class="wallet__title" :title="resolvedTitle">{{ resolvedTitle }}</div>
      <div v-if="subtitle" class="wallet__sub" :title="subtitle">{{ subtitle }}</div>
    </div>

    <div class="wallet__amount">
      <div class="wallet__metric">
        <div class="wallet__metric-val">
          <template v-if="loading">—</template>
          <template v-else-if="empty">0,00<span class="ccy">{{ symbol }}</span></template>
          <template v-else>{{ balance }}<span class="ccy">{{ symbol }}</span></template>
        </div>
        <div class="wallet__metric-label">{{ balanceLabel ?? 'Доступно' }}</div>
      </div>

      <div v-if="lockedBalance !== undefined" class="wallet__locked-line">
        <q-icon name="lock" />
        {{ lockedLabel ?? 'Заблокировано' }}: <b>{{ lockedBalance }}</b>
        <span class="ccy">&nbsp;{{ symbol }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { CSSProperties } from 'vue';
import type { WalletCardProps, WalletProgram } from './WalletCard.types';

const props = withDefaults(defineProps<WalletCardProps>(), {
  loading: false,
  compact: false,
  empty: false,
});

const DEFAULT_TITLES: Record<WalletProgram, string> = {
  blagorost: 'Благорост',
  wallet: 'Главный кошелёк',
  generator: 'Генератор',
};

const DEFAULT_ICONS: Record<WalletProgram, string> = {
  blagorost: 'savings',
  wallet: 'account_balance_wallet',
  generator: 'bolt',
};

const resolvedTitle = computed(
  () => props.title ?? (props.program ? DEFAULT_TITLES[props.program] : ''),
);
const resolvedIcon = computed(
  () => props.icon ?? (props.program ? DEFAULT_ICONS[props.program] : 'savings'),
);

const progStyle = computed<CSSProperties>(() => {
  // Нейтральная карточка (или без программы) — приглушённая иконка без акцента.
  if (props.neutral || !props.program) {
    return {
      '--prog-bg': 'var(--p-canvas-2)',
      '--prog-fg': 'var(--p-ink-2)',
    } as CSSProperties;
  }
  return {
    '--prog-bg': `var(--prog-${props.program}-soft)`,
    '--prog-fg': `var(--prog-${props.program})`,
  } as CSSProperties;
});
</script>

<style scoped>
/* Заголовок и подпись не обрезаются в одну строку (canon nowrap) и не бегут
   marquee'й — переносятся максимум на две строки с «…» в конце. Полный текст
   всегда доступен в title-тултипе. */
.wallet__title,
.wallet__sub {
  white-space: normal;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
}
.wallet__title {
  line-height: var(--p-lh-h3);
}
</style>
