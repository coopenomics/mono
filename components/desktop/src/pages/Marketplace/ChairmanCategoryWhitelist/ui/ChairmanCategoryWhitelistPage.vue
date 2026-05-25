<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { Dialog, Notify } from 'quasar';
import {
  addAvailableCategories,
  fetchAvailabilityStats,
  fetchAvailableCategories,
  fetchCategories,
  removeAvailableCategories,
  type MarketplaceAvailabilityStatsView,
  type MarketplaceAvailableCategoryView,
  type MarketplaceCategoryView,
} from '../api';

/**
 * Эпик 3 / Story 3.x: «Доступные категории» — настройка whitelist'а
 * категорий товаров для кооператива (chairman-only).
 *
 * MVP: список разрешённых категорий (entire / specific type), статистика
 * и удаление. Добавление — через диалог с выбором категорий по названию
 * (marketplaceListCategories), уже добавленные исключаются из списка.
 *
 * Без whitelist'а — кооператив видит весь глобальный каталог.
 * С whitelist'ом — только перечисленные категории доступны для
 * публикации Offer'ов.
 */

const items = ref<MarketplaceAvailableCategoryView[]>([]);
const stats = ref<MarketplaceAvailabilityStatsView | null>(null);
const allCategories = ref<MarketplaceCategoryView[]>([]);
const loading = ref(false);

const addDialogOpen = ref(false);
const selectedToAdd = ref<number[]>([]);
const adding = ref(false);

const addableCategoryOptions = computed(() => {
  const whitelisted = new Set(items.value.map((i) => i.categoryId));
  return allCategories.value
    .filter((c) => !whitelisted.has(c.id))
    .map((c) => ({ label: c.display_name, value: c.id }));
});

const entireCategories = computed(() =>
  items.value.filter((i) => i.isForEntireCategory),
);
const specificTypes = computed(() => items.value.filter((i) => i.isForSpecificType));

async function load(): Promise<void> {
  loading.value = true;
  try {
    const [list, st, cats] = await Promise.all([
      fetchAvailableCategories(),
      fetchAvailabilityStats(),
      fetchCategories(),
    ]);
    items.value = list;
    stats.value = st;
    allCategories.value = cats;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    Notify.create({ type: 'negative', message });
  } finally {
    loading.value = false;
  }
}

function onAdd(): void {
  selectedToAdd.value = [];
  addDialogOpen.value = true;
}

async function confirmAdd(): Promise<void> {
  const ids = selectedToAdd.value;
  if (ids.length === 0) return;
  adding.value = true;
  try {
    await addAvailableCategories(ids);
    Notify.create({ type: 'positive', message: `Добавлено категорий: ${ids.length}` });
    addDialogOpen.value = false;
    await load();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    Notify.create({ type: 'negative', message });
  } finally {
    adding.value = false;
  }
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

  q-dialog(v-model="addDialogOpen")
    q-card(style="min-width: 420px; max-width: 90vw")
      q-card-section
        div.text-h6 Добавить категории в whitelist
        div.text-caption.text-grey-7 Выберите категории по названию. Уже добавленные в список не показываются.
      q-card-section
        q-select(
          v-model="selectedToAdd",
          :options="addableCategoryOptions",
          emit-value,
          map-options,
          multiple,
          use-chips,
          outlined,
          dense,
          label="Категории",
          :loading="loading"
        )
        div.text-caption.text-grey-6.q-mt-sm(v-if="addableCategoryOptions.length === 0")
          | Все доступные категории уже в whitelist.
      q-card-actions(align="right")
        q-btn(flat, no-caps, label="Отмена", v-close-popup)
        q-btn(
          unelevated,
          no-caps,
          color="primary",
          label="Добавить",
          :loading="adding",
          :disable="selectedToAdd.length === 0",
          @click="confirmAdd"
        )
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
