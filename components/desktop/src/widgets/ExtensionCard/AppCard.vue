<template lang="pug">
//- Карточка приложения витрины — одна на встроенные и каталожные.
//- Зоны: опознание (знак, название, состояние) → описание → цена и
//- происхождение → действие. Председателю важно «что это, сколько стоит,
//- что нажать»; встроенное оно или из каталога — пометка, а не раздел.
article.app-card(
  :class='{ "app-card--clickable": clickable }',
  @click='clickable && emit("open")'
)
  .app-card__head
    AutoAvatar.app-card__avatar(
      :username='seed',
      :size='48',
      radius='var(--p-r-md, 12px)',
      background='var(--p-surface-2)',
      :ring-color='ringPalette',
      animated
    )
    .app-card__heading
      h3.app-card__title {{ title }}
      slot(name='badges')

  p.app-card__desc(v-if='description') {{ description }}

  .app-card__meta
    span.app-card__origin
      q-icon(:name='origin === "builtin" ? "verified" : "cloud_download"', size='14px')
      | {{ origin === 'builtin' ? $t('extensionCard.extensionCard.originBuiltin') : $t('extensionCard.extensionCard.originCatalog') }}
    span.app-card__price {{ price }}

  .app-card__foot(v-if='$slots.foot')
    slot(name='foot')
</template>

<script lang="ts" setup>
import { AutoAvatar } from 'src/shared/ui/domain/AutoAvatar';

defineProps<{
  /** Имя, от которого строится генеративный знак: у каждого приложения свой. */
  seed: string;
  title: string;
  description?: string | null;
  origin: 'builtin' | 'catalog';
  /** Готовая подпись цены: «Бесплатно» или «360 ₽/мес». */
  price: string;
  clickable?: boolean;
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
  gap: var(--p-3, 12px);
  height: 100%;
  min-height: 200px;
  padding: var(--p-5, 20px);
  background: var(--p-surface, #fff);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-lg, 14px);
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
}

.app-card--clickable {
  cursor: pointer;
  &:hover {
    border-color: var(--p-primary-line, var(--p-primary));
    box-shadow: var(--p-shadow-pop, 0 8px 28px rgba(0, 0, 0, 0.1));
    transform: translateY(-2px);
  }
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
  gap: var(--p-3, 12px);
}

.app-card__avatar {
  flex: none;
  // Генеративный знак держим тихим: гасим насыщенность и чуть приглушаем,
  // чтобы он читался как текстура, а не перетягивал внимание.
  filter: saturate(0.5);
  opacity: 0.85;
}

.app-card__heading {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--p-1, 4px);
  min-width: 0;
}

.app-card__title {
  margin: 0;
  font-size: var(--p-fs-h3);
  font-weight: 600;
  letter-spacing: var(--p-ls-h3, 0);
  color: var(--p-ink);
  // Обрезаем максимум двумя строками, чтобы длинный заголовок не ломал сетку.
  line-height: 1.3;
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
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

// Цена прижата вправо и набрана крупнее — это то, что председатель ищет
// глазами; происхождение — тихая пометка слева.
.app-card__meta {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--p-3, 12px);
  margin-top: auto;
}

.app-card__origin {
  display: inline-flex;
  align-items: center;
  gap: var(--p-1, 4px);
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-3);
}

.app-card__price {
  font-size: var(--p-fs-body);
  font-weight: 600;
  color: var(--p-ink);
  white-space: nowrap;
}

.app-card__foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}
</style>
