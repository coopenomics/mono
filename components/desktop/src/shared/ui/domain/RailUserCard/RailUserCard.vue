<template lang="pug">
.rail__usercard(:class="{ 'is-collapsed': collapsed }")
  .rail__usertop
    span.rail__avatar
      img(v-if='avatarSrc', :src='avatarSrc', :alt='name')
      template(v-else) {{ initials }}
    .rail__userinfo
      b {{ name }}
      span(v-if='role') {{ role }}
    slot(name='usertop-extra')

  component(
    v-if='hasBalance',
    :is='balanceTag',
    :class="['rail__balance', { 'rail__balance--clickable': isBalanceClickable }]",
    :to='balanceRoute',
    @click='onBalanceClick'
  )
    .rail__balance-label {{ balanceLabel ?? 'Доступно' }}
    .rail__balance-val
      b {{ balance }}
      span.ccy(v-if='symbol') {{ symbol }}
    .rail__balance-locked(v-if='lockedBalance !== undefined')
      q-icon(name='lock')
      | {{ lockedLabel ?? 'Заблокировано' }}:&nbsp;
      b {{ lockedBalance }}
      span.ccy(v-if='symbol') &nbsp;{{ symbol }}

  .rail__actions
    slot(name='actions')
      button.rail__action.rail__action--primary(
        type='button',
        @click="emit('primary-action')"
      )
        q-icon(name='add')
        | {{ primaryActionLabel ?? 'Пополнить' }}
    button.rail__usercard__collapse(
      type='button',
      :aria-label="collapsed ? 'Развернуть кошелёк' : 'Свернуть кошелёк'",
      :aria-expanded='!collapsed',
      @click='toggleCollapsed'
    )
      q-icon(name='expand_more')

button.rail__signout(
  v-if='showSignout',
  type='button',
  @click="emit('signout')"
)
  q-icon(name='logout')
  | {{ signoutLabel ?? 'Выйти' }}
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { RailUserCardProps } from './RailUserCard.types';

const props = withDefaults(defineProps<RailUserCardProps>(), {
  collapsed: false,
  showSignout: false,
});

const emit = defineEmits<{
  'primary-action': [];
  'update:collapsed': [value: boolean];
  'balance-click': [event: MouseEvent];
  signout: [];
}>();

const initials = computed(() => {
  const parts = (props.name ?? '').trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('');
});

const hasBalance = computed(
  () => props.balance !== undefined && props.balance !== null && props.balance !== '',
);

const isBalanceClickable = computed(() => !!props.balanceRoute);
const balanceTag = computed(() => (props.balanceRoute ? 'router-link' : 'div'));

function toggleCollapsed(): void {
  emit('update:collapsed', !props.collapsed);
}
function onBalanceClick(event: MouseEvent): void {
  if (props.balanceRoute || event) emit('balance-click', event);
}
</script>

<style scoped>
/* === Chevron rotation ===
   canon CSS-правило `.rail__usercard__collapse svg { transform: rotate(180deg) }`
   рассчитано на `<svg>`. Quasar `<q-icon>` рендерит `<i class="q-icon">`,
   поэтому canon-селектор не срабатывает. Прокидываем поведение через :deep. */
.rail__usercard__collapse :deep(.q-icon) {
  transition: transform var(--p-dur-base, 200ms) var(--p-ease-standard, ease);
  font-size: 14px;
  color: inherit;
}
.rail__usercard.is-collapsed .rail__usercard__collapse :deep(.q-icon) {
  transform: rotate(180deg);
}

/* === Clickable balance ===
   Когда задан `balanceRoute`, оборачиваем содержимое в `<router-link>`
   и подсвечиваем кликабельность. */
.rail__balance--clickable {
  cursor: pointer;
  text-decoration: none;
  color: inherit;
  display: block;
  transition: background var(--p-dur-fast, 120ms) ease;
}
.rail__balance--clickable:hover {
  background: var(--p-primary-soft);
  filter: brightness(0.97);
}

/* === Signout reset ===
   canon `.rail__signout` рассчитан на <div>; мы рендерим <button>, поэтому
   сбрасываем браузерные дефолты, не трогая canon-границу и padding. */
.rail__signout {
  font-family: inherit;
  width: 100%;
  text-align: left;
  background: transparent;
  border-right: 0;
  border-bottom: 0;
  border-left: 0;
}
</style>
