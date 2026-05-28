<template lang="pug">
article.app-card(
  :class='{ "app-card--clickable": extension.is_available }',
  @click='open'
)
  .app-card__head
    AutoAvatar.app-card__avatar(
      :username='extension.name || extension.title',
      :size='48',
      radius='var(--p-r-md, 12px)',
      background='var(--p-surface-2)',
      :ring-color='ringPalette',
      animated
    )
    .app-card__heading
      h3.app-card__title {{ extension.title }}
      span.badge.badge--pos(v-if='isInstalled')
        q-icon(name='fa-solid fa-check' size='11px')
        | Установлено
      span.badge.badge--warn(v-else-if='!extension.is_available')
        q-icon(name='fa-solid fa-screwdriver-wrench' size='11px')
        | В разработке

  p.app-card__desc(v-if='extension.description') {{ extension.description }}

  .app-card__foot(v-if='extension.is_available')
    span.app-card__more
      | Подробнее
      q-icon(name='fa-solid fa-arrow-right' size='12px')
</template>

<script lang="ts" setup>
import type { IExtension } from 'src/entities/Extension/model/types';
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { AutoAvatar } from 'src/shared/ui/AutoAvatar';

const props = defineProps<{ extension: IExtension }>();

const router = useRouter();

const isInstalled = computed(
  () => props.extension.is_installed && props.extension.is_available,
);

// Уникальный генеративный логотип (DiceBear rings) вместо подбираемых
// вручную изображений: рисунок и цвет колец детерминированы именем
// расширения, поэтому каждое приложение получает свой неповторимый знак.
const ringPalette = ['5b9aa0', '6f8fae', '74a08c', '9a8fb0', '8aa0a8', 'a8967e'];

const open = () => {
  if (props.extension.is_available)
    router.push({ name: 'one-extension', params: { name: props.extension.name } });
};
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
  // Статус идёт сразу под заголовком (без фиксированного резерва — иначе
  // под однострочными названиями зияет дыра). Обрезаем максимум двумя
  // строками, чтобы длинный заголовок не ломал сетку.
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

.app-card__foot {
  display: flex;
  align-items: center;
  margin-top: auto;
}

.app-card__more {
  display: inline-flex;
  align-items: center;
  gap: var(--p-1, 4px);
  font-size: var(--p-fs-body-sm);
  font-weight: 600;
  color: var(--p-primary);
}
</style>
