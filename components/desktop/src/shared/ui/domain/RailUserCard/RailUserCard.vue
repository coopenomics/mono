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
    //- Замок, а не стрелка: свёрнутая карточка означает не «спрятал, чтобы не
    //- мешало», а «ключ убран из памяти». Одно действие делает обе вещи сразу —
    //- запирает кошелёк и сжимает карточку, — поэтому и значок один.
    button.rail__usercard__collapse(
      type='button',
      :aria-label="collapsed ? 'Разблокировать кошелёк' : 'Заблокировать кошелёк'",
      :aria-pressed='collapsed',
      :title="collapsed ? 'Разблокировать кошелёк' : 'Заблокировать кошелёк'",
      @click='toggleCollapsed'
    )
      q-icon(:name="collapsed ? 'lock' : 'lock_open'")

button.rail__signout(
  v-if='showSignout',
  type='button',
  @click="emit('signout')"
)
  q-icon(name='logout')
  | {{ signoutLabel ?? 'Выйти из кабинета' }}
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
/* === Значок замка ===
   canon-правила размера рассчитаны на `<svg>`, а Quasar `<q-icon>` рендерит
   `<i class="q-icon">` — canon-селектор до него не достаёт. Задаём размер здесь.
   Поворота больше нет: замок не переворачивается, он меняет форму (lock_open →
   lock), и подмену видно без движения. */
.rail__usercard__collapse :deep(.q-icon) {
  font-size: 15px;
  color: inherit;
  transition: color var(--p-dur-fast, 120ms) ease;
}
/* Запертое состояние — сдержанный акцент: значок заметен, но не тревожит. */
.rail__usercard.is-collapsed .rail__usercard__collapse :deep(.q-icon) {
  color: var(--p-primary);
}

/* === Плавное сжатие ===
   canon прячет баланс и «Пополнить» через `display: none` — карточка схлопывается
   рывком. Здесь блок сжимается: высота уходит в ноль вместе с прозрачностью.
   Селекторы те же, что в canon, но scoped-атрибут поднимает их специфичность,
   поэтому `display: none` перекрывается без `!important`.

   Ограничение высоты фиксированным значением, а не `auto`: анимировать `auto`
   браузеры не умеют, а баланс с подписями заведомо ниже. */
.rail__balance,
.rail__action--primary {
  overflow: hidden;
  max-height: 200px;
  opacity: 1;
  transition:
    max-height var(--p-dur-base, 200ms) var(--p-ease-standard, ease),
    opacity var(--p-dur-fast, 120ms) ease;
}
.rail__usercard.is-collapsed .rail__balance,
.rail__usercard.is-collapsed .rail__action--primary {
  display: block;
  max-height: 0;
  opacity: 0;
  padding-top: 0;
  padding-bottom: 0;
  border-top-width: 0;
  border-bottom-width: 0;
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
