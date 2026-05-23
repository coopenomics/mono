<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { Dialog, Notify } from 'quasar';
import {
  addAvailableCategories,
  fetchAvailabilityStats,
  fetchAvailableCategories,
  removeAvailableCategories,
  type MarketplaceAvailabilityStatsView,
  type MarketplaceAvailableCategoryView,
} from '../api';

/**
 * Эпик 3 / Story 3.x: «Доступные категории» — настройка whitelist'а
 * категорий товаров для кооператива (chairman-only).
 *
 * MVP: список разрешённых категорий (entire / specific type), статистика
 * и удаление. Добавление — через диалог с ручным вводом ID (tree-выбор
 * через `marketplaceGetCategoryTree` подключится на следующем шаге).
 *
 * Без whitelist'а — кооператив видит весь глобальный каталог.
 * С whitelist'ом — только перечисленные категории доступны для
 * публикации Offer'ов.
 */

const items = ref<MarketplaceAvailableCategoryView[]>([]);
const stats = ref<MarketplaceAvailabilityStatsView | null>(null);
const loading = ref(false);

const entireCategories = computed(() =>
  items.value.filter((i) => i.isForEntireCategory),
);
const specificTypes = computed(() => items.value.filter((i) => i.isForSpecificType));

async function load(): Promise<void> {
  loading.value = true;
  try {
    const [list, st] = await Promise.all([
      fetchAvailableCategories(),
      fetchAvailabilityStats(),
    ]);
    items.value = list;
    stats.value = st;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    Notify.create({ type: 'negative', message });
  } finally {
    loading.value = false;
  }
}

function onAdd(): void {
  Dialog.create({
    title: 'Добавить категории в whitelist',
    message:
      'Введите ID категорий через запятую (например: 1, 7, 15). Tree-выбор подключится на следующем шаге Story 3.x.',
    prompt: {
      model: '',
      type: 'text',
      isValid: (v: string) => /^\s*\d+(\s*,\s*\d+)*\s*$/.test(v),
    },
    cancel: { label: 'Отмена', flat: true },
    ok: { label: 'Добавить', color: 'primary', unelevated: true },
    persistent: true,
  }).onOk(async (raw: string) => {
    const ids = raw
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n));
    if (ids.length === 0) return;
    try {
      await addAvailableCategories(ids);
      Notify.create({ type: 'positive', message: `Добавлено категорий: ${ids.length}` });
      await load();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      Notify.create({ type: 'negative', message });
    }
  });
}

function onRemove(item: MarketplaceAvailableCategoryView): void {
  Dialog.create({
    title: 'Удалить из whitelist?',
    message: `Категория ID ${item.categoryId} будет удалена из доступных. Существующие Offer'ы не пропадут, но новые публиковать в этой категории станет нельзя.`,
    cancel: { label: 'Отмена', flat: true },
    ok: { label: 'Удалить', color: 'negative', unelevated: true },
    persistent: true,
  }).onOk(async () => {
    try {
      await removeAvailableCategories([item.categoryId]);
      Notify.create({ type: 'positive', message: 'Категория удалена из whitelist' });
      await load();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      Notify.create({ type: 'negative', message });
    }
  });
}

onMounted(load);
</script>

<template lang="pug">
q-page.mp-role-admin.mp-category-whitelist(role="region", aria-label="Доступные категории кооператива")
  div.mp-category-whitelist__header
    div
      div.text-h5 Доступные категории
      div.text-caption.mp-category-whitelist__subtitle
        | Whitelist категорий товаров, которые пайщики могут публиковать как Offer'ы. Пустой whitelist означает, что доступен весь глобальный каталог.
    q-space
    q-btn(
      unelevated,
      no-caps,
      color="primary",
      icon="fa-solid fa-plus",
      label="Добавить",
      @click="onAdd"
    )
    q-btn(flat, dense, round, icon="fa-solid fa-rotate", :loading="loading", @click="load", aria-label="Обновить")

  div.row.q-col-gutter-md(v-if="stats")
    div.col-6.col-md-3
      q-card(flat, bordered)
        q-card-section
          div.text-caption Всего записей
          div.text-h6 {{ stats.totalAvailable }}
    div.col-6.col-md-3
      q-card(flat, bordered)
        q-card-section
          div.text-caption Категорий
          div.text-h6 {{ stats.categoriesCount }}
    div.col-6.col-md-3
      q-card(flat, bordered)
        q-card-section
          div.text-caption Типов товаров
          div.text-h6 {{ stats.typesCount }}
    div.col-6.col-md-3
      q-card(flat, bordered)
        q-card-section
          div.text-caption Whitelist активен
          div.text-h6
            span(v-if="stats.hasRestrictions", class="text-positive") Да
            span(v-else, class="text-grey-7") Нет (открыт каталог)

  q-inner-loading(:showing="loading && items.length === 0")
    q-spinner(color="primary", size="2em")

  div.mp-category-whitelist__empty(v-if="!loading && items.length === 0")
    q-icon(name="fa-solid fa-folder-open", size="48px", color="grey-5")
    div.text-subtitle1.q-mt-md Whitelist пуст
    div.text-caption Пайщикам доступен весь глобальный каталог. Чтобы ограничить — нажмите «Добавить».

  q-card(v-if="entireCategories.length > 0", flat, bordered)
    q-card-section
      div.text-subtitle1.q-mb-sm Целые категории
    q-separator
    q-list(separator)
      q-item(v-for="c in entireCategories", :key="c.id")
        q-item-section
          q-item-label Категория № {{ c.categoryId }}
          q-item-label(caption) Добавлено: {{ c.addedBy }}, активна: {{ c.isActive ? 'да' : 'нет' }}
        q-item-section(side)
          q-btn(flat, dense, no-caps, color="negative", icon="fa-solid fa-trash", label="Убрать", @click="onRemove(c)")

  q-card(v-if="specificTypes.length > 0", flat, bordered)
    q-card-section
      div.text-subtitle1.q-mb-sm Конкретные типы товаров
    q-separator
    q-list(separator)
      q-item(v-for="t in specificTypes", :key="t.id")
        q-item-section
          q-item-label Категория № {{ t.categoryId }} → тип № {{ t.typeId ?? '—' }}
          q-item-label(caption) Добавлено: {{ t.addedBy }}, активна: {{ t.isActive ? 'да' : 'нет' }}
</template>

<style scoped lang="scss">
.mp-category-whitelist {
  padding: var(--mp-space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--mp-space-md);

  &__header {
    display: flex;
    align-items: flex-start;
    gap: var(--mp-space-md);
  }

  &__subtitle {
    color: var(--mp-on-surface-muted);
    max-width: 720px;
  }

  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: var(--mp-space-xl) 0;
    color: var(--mp-on-surface-muted);
  }
}
</style>
