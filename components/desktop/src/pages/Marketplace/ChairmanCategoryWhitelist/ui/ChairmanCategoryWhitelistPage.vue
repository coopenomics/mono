<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { Dialog, Notify } from 'quasar';
import { BaseButton, BaseCard, BaseDialog, EmptyState } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
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
q-page.whitelist(role="region", aria-label="Доступные категории кооператива")
  PageHint(storage-key="mp:category-whitelist:banner-dismissed")
    | Whitelist категорий товаров, которые пайщики могут публиковать как предложения. Пустой whitelist означает, что доступен весь глобальный каталог.

  .whitelist__toolbar
    q-space
    BaseButton(variant="primary", @click="onAdd")
      template(#icon-left)
        q-icon(name="add", size="18px")
      | Добавить
    BaseButton(variant="ghost", iconOnly, ariaLabel="Обновить", :loading="loading", @click="load")
      template(#icon-left)
        q-icon(name="refresh", size="18px")

  .whitelist__stats(v-if="stats")
    .kpi
      .kpi__head
        span.kpi__eyebrow Всего записей
      .kpi__val {{ stats.totalAvailable }}
    .kpi
      .kpi__head
        span.kpi__eyebrow Категорий
      .kpi__val {{ stats.categoriesCount }}
    .kpi
      .kpi__head
        span.kpi__eyebrow Типов товаров
      .kpi__val {{ stats.typesCount }}
    .kpi
      .kpi__head
        span.kpi__eyebrow Whitelist активен
      .kpi__val
        span(v-if="stats.hasRestrictions") Да
        span.t-muted(v-else) Нет (открыт каталог)

  q-inner-loading(:showing="loading && items.length === 0")
    q-spinner(color="primary", size="2em")

  EmptyState(
    v-if="!loading && items.length === 0",
    title="Whitelist пуст",
    body="Пайщикам доступен весь глобальный каталог. Чтобы ограничить — нажмите «Добавить»."
  )
    template(#icon)
      q-icon(name="folder_open", size="48px")

  BaseCard(v-if="entireCategories.length > 0", title="Целые категории")
    q-list(separator)
      q-item(v-for="c in entireCategories", :key="c.id")
        q-item-section
          q-item-label Категория № {{ c.categoryId }}
          q-item-label(caption) Добавлено: {{ c.addedBy }}, активна: {{ c.isActive ? 'да' : 'нет' }}
        q-item-section(side)
          BaseButton(variant="danger", size="sm", @click="onRemove(c)")
            template(#icon-left)
              q-icon(name="delete", size="16px")
            | Убрать

  BaseCard(v-if="specificTypes.length > 0", title="Конкретные типы товаров")
    q-list(separator)
      q-item(v-for="t in specificTypes", :key="t.id")
        q-item-section
          q-item-label Категория № {{ t.categoryId }} → тип № {{ t.typeId ?? '—' }}
          q-item-label(caption) Добавлено: {{ t.addedBy }}, активна: {{ t.isActive ? 'да' : 'нет' }}

  BaseDialog(v-model="addDialogOpen", title="Добавить категории в whitelist", size="md")
    .t-muted.q-mb-md Выберите категории по названию. Уже добавленные в список не показываются.
    //- Множественный выбор: BaseSelect отдаёт single value, обёртки для multiple
    //- нет — берём q-select напрямую (поле канонизирует quasar-canon.css).
    q-select(
      v-model="selectedToAdd",
      :options="addableCategoryOptions",
      emit-value,
      map-options,
      multiple,
      use-chips,
      outlined,
      label="Категории",
      :loading="loading"
    )
    .t-muted.q-mt-sm(v-if="addableCategoryOptions.length === 0")
      | Все доступные категории уже в whitelist.
    template(#footer)
      BaseButton(variant="ghost", @click="addDialogOpen = false") Отмена
      BaseButton(
        variant="primary",
        :loading="adding",
        :disabled="selectedToAdd.length === 0",
        @click="confirmAdd"
      ) Добавить
</template>

<style scoped lang="scss">
.whitelist {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  &__toolbar {
    display: flex;
    align-items: center;
    gap: var(--p-2, 8px);
  }

  &__stats {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: var(--p-3, 12px);
  }
}

@media (max-width: 768px) {
  .whitelist {
    padding: var(--p-4, 16px);
  }
}
</style>
