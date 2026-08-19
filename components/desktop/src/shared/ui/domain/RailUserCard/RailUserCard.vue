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
    //- Замок вместо стрелки — только когда свёртка и правда запирает кошелёк
    //- (`lockable`): тогда одно действие делает обе вещи сразу — убирает ключ из
    //- памяти и сжимает карточку. Без заданного PIN запирать нечего, и кнопка
    //- остаётся обычной стрелкой: замок там обещал бы защиту, которой нет.
    button.rail__usercard__collapse(
      type='button',
      :class='{ "is-lock": lockable }',
      :aria-label='toggleLabel',
      :aria-pressed='lockable ? collapsed : undefined',
      :aria-expanded='lockable ? undefined : !collapsed',
      :title='toggleLabel',
      @click='toggleCollapsed'
    )
      q-icon(:name="lockable ? (collapsed ? 'lock' : 'lock_open') : 'expand_more'")

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
  lockable: false,
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

const toggleLabel = computed(() => {
  if (props.lockable) return props.collapsed ? 'Разблокировать кошелёк' : 'Заблокировать кошелёк';
  return props.collapsed ? 'Развернуть кошелёк' : 'Свернуть кошелёк';
});

const isBalanceClickable = computed(() => !!props.balanceRoute);
const balanceTag = computed(() => (props.balanceRoute ? 'router-link' : 'div'));

function toggleCollapsed(event: MouseEvent): void {
  // Диалог PIN-кода при закрытии возвращает фокус тому, кто его вызвал, и на
  // замке оставалась рамка фокуса. Убираем её сразу — но только когда нажали
  // мышью: `detail === 0` означает Enter или пробел с клавиатуры, и там фокус
  // терять нельзя, иначе человек потеряет место, откуда продолжать.
  if (event.detail > 0) (event.currentTarget as HTMLElement | null)?.blur();
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
  font-size: 16px;
  /* Строчный интерлиньяж выше самого глифа, и в низкой строке знак обрезало
     снизу. Единица приравнивает высоту строки к размеру знака. */
  line-height: 1;
  color: inherit;
  transition:
    color var(--p-dur-fast, 120ms) ease,
    transform var(--p-dur-base, 200ms) var(--p-ease-standard, ease);
}

/* Стрелка переворачивается, показывая, куда раскроется карточка. Замок вместо
   этого меняет форму (lock_open → lock), и вертеть его незачем. */
.rail__usercard.is-collapsed .rail__usercard__collapse:not(.is-lock) :deep(.q-icon) {
  transform: rotate(180deg);
}

/* Рамку фокуса показываем только при переходе с клавиатуры: после клика мышью
   она читалась как «кнопка залипла». */
.rail__usercard__collapse:focus:not(:focus-visible) {
  outline: none;
}
.rail__usercard__collapse:focus-visible {
  outline: 2px solid var(--p-primary);
  outline-offset: -2px;
}

/* Свёрнутая строка: canon отводит ей 26px, чего знаку не хватает — низ замка
   срезала граница карточки (у неё `overflow: hidden`). Даём строке высоту под
   знак целиком. */
.rail__usercard.is-collapsed .rail__usercard__collapse {
  height: 34px;
  padding: 0;
}
/* Запертое состояние — сдержанный акцент: значок заметен, но не тревожит.
   Свёрнутая без замка карточка ничего не запирает, и подсвечивать там нечего. */
.rail__usercard.is-collapsed .rail__usercard__collapse.is-lock :deep(.q-icon) {
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
/* Схлопнутая по высоте кнопка «Пополнить» продолжала занимать свою долю ширины,
   и замок стоял не в середине строки, а в середине остатка. Убираем её из
   раскладки целиком — строка достаётся замку. */
.rail__usercard.is-collapsed .rail__action--primary {
  flex: 0 0 0;
  width: 0;
  min-width: 0;
  padding-left: 0;
  padding-right: 0;
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
