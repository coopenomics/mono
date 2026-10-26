<template lang="pug">
//- Карточка приложения витрины — одна на встроенные и каталожные.
//- Три ответа, и ничего сверх них: что это (знак, название, две строки
//- описания), сколько стоит (одна строка цены) и в каком состоянии
//- (одна тихая пометка). Кнопок на карточке нет — вся карточка открывает
//- страницу приложения, где и живут действия.
article.app-card(
  :class='{ "app-card--clickable": clickable, "app-card--muted": muted }',
  :tabindex='clickable ? 0 : undefined',
  :role='clickable ? "link" : undefined',
  @click='clickable && emit("open")',
  @keydown.enter='clickable && emit("open")'
)
  .app-card__head
    AutoAvatar.app-card__avatar(
      :username='seed',
      :size='44',
      radius='var(--p-r-md, 12px)',
      background='var(--p-surface-2)',
      :ring-color='ringPalette',
      animated
    )
    .app-card__state(v-if='state')
      BaseBadge(:variant='state.variant') {{ state.label }}

  .app-card__body
    h3.app-card__title {{ title }}
    p.app-card__desc(v-if='description') {{ description }}

  .app-card__price {{ price }}
</template>

<script lang="ts" setup>
import { AutoAvatar } from 'src/shared/ui/domain/AutoAvatar';
import { BaseBadge } from 'src/shared/ui/base';
import type { BaseBadgeVariant } from 'src/shared/ui/base/BaseBadge/BaseBadge.types';

export interface AppCardState {
  label: string;
  variant: BaseBadgeVariant;
}

defineProps<{
  /** Имя, от которого строится генеративный знак: у каждого приложения свой. */
  seed: string;
  title: string;
  description?: string | null;
  /** Готовая подпись цены: «Бесплатно» или «360 ₽ в месяц». */
  price: string;
  /** Одна пометка состояния: «Установлено», «Пробный период до…». */
  state?: AppCardState | null;
  clickable?: boolean;
  /** Приглушённая карточка — приложение ещё не готово. */
  muted?: boolean;
}>();

const emit = defineEmits<{ open: [] }>();

// Уникальный генеративный логотип (DiceBear rings) вместо подбираемых
// вручную изображений: рисунок и цвет колец детерминированы именем
// приложения, поэтому каждое получает свой неповторимый знак.
const ringPalette = ['5b9aa0', '6f8fae', '74a08c', '9a8fb0', '8aa0a8', 'a8967e'];
</script>

<style scoped lang="scss">
.app-card {
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);
  height: 100%;
  min-height: 212px;
  padding: var(--p-5, 20px);
  background: var(--p-surface);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-lg, 14px);
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
}

.app-card--clickable {
  cursor: pointer;
  &:hover,
  &:focus-visible {
    border-color: var(--p-primary-line, var(--p-primary));
    box-shadow: var(--p-shadow-pop, 0 8px 28px rgba(0, 0, 0, 0.1));
    transform: translateY(-2px);
  }
}

.app-card--muted {
  opacity: 0.72;
}

// Анимация логотипа запускается при наведении на всю карточку, а не только
// на сам SVG. Сегменты .ring-seg живут внутри v-html, поэтому :deep.
.app-card:hover :deep(.ring-seg) {
  animation: ringSegWobble 1.3s ease-in-out;
  animation-delay: calc(var(--seg, 0) * 40ms);
}

.app-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--p-3, 12px);
}

.app-card__avatar {
  flex: none;
  // Генеративный знак держим тихим: гасим насыщенность и чуть приглушаем,
  // чтобы он читался как текстура, а не перетягивал внимание.
  filter: saturate(0.5);
  opacity: 0.85;
}

.app-card__body {
  display: flex;
  flex-direction: column;
  gap: var(--p-2, 8px);
  min-width: 0;
}

.app-card__title {
  margin: 0;
  font-size: var(--p-fs-h3);
  font-weight: 600;
  letter-spacing: var(--p-ls-h3, 0);
  line-height: 1.3;
  color: var(--p-ink);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.app-card__desc {
  margin: 0;
  font-size: var(--p-fs-body-sm);
  line-height: 1.5;
  color: var(--p-ink-2);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

// Цена — последняя строка карточки, прижата к низу: взгляд идёт от названия
// к сумме, а не ищет её среди пометок.
.app-card__price {
  margin-top: auto;
  font-size: var(--p-fs-body);
  font-weight: 600;
  color: var(--p-ink);
  white-space: nowrap;
}
</style>
