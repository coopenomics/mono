<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { Dialog, Notify, debounce } from 'quasar';
import { SuccessAlert, FailAlert } from 'src/shared/api';
import { BaseBadge, BaseButton, BaseInput, BaseDialog, EmptyState, TableSkeleton } from 'src/shared/ui/base';
import type { TableSkeletonColumn } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
import { useMarketplaceRealtime } from 'src/shared/lib/marketplace';
import {
  clearAvailableCategories,
  createCustomCategory,
  deleteCustomCategory,
  fetchAvailableCategories,
  fetchCoopCategories,
  replaceAvailableItems,
  type MarketplaceAvailableCategoryView,
  type MarketplaceCoopCategoryView,
} from '../api';

/**
 * Эпик 16: «Категории кооператива».
 *
 * Список = общие baseline-категории + собственные категории кооператива.
 * Доступность для публикации предложений задаётся whitelist'ом: пустой whitelist
 * = открыт весь каталог (все категории включены). Выключение категории строит
 * whitelist из оставшихся включённых; включение всех обратно = очистка whitelist'а
 * (снова открытый каталог). Собственные категории (mvp_baseline=false) можно
 * добавлять и удалять; baseline удалить нельзя, только выключить.
 */

const categories = ref<MarketplaceCoopCategoryView[]>([]);
const available = ref<MarketplaceAvailableCategoryView[]>([]);
const loading = ref(false);
const savingId = ref<number | null>(null);

const addDialogOpen = ref(false);
const newName = ref('');
const creating = ref(false);

// Множество включённых категорий по whitelist'у. Пустой whitelist = открытый
// каталог: тогда включены все категории.
const availableIds = computed(
  () => new Set(available.value.filter((a) => a.isForEntireCategory).map((a) => a.categoryId)),
);
const isOpenCatalog = computed(() => availableIds.value.size === 0);

function isEnabled(cat: MarketplaceCoopCategoryView): boolean {
  return isOpenCatalog.value || availableIds.value.has(cat.id);
}

const enabledCount = computed(() => categories.value.filter((c) => isEnabled(c)).length);

const skeletonColumns: TableSkeletonColumn[] = [
  { label: 'Категория', cell: 'text' },
  { label: 'Вид', class: 'col-kind', cell: 'badge' },
  { label: 'Доступна', class: 'col-toggle', cell: 'text', cellWidth: '64px' },
  { label: '', class: 'col-actions', cell: 'text', cellWidth: '48px' },
];

async function load(): Promise<void> {
  loading.value = true;
  try {
    const [cats, avail] = await Promise.all([fetchCoopCategories(), fetchAvailableCategories()]);
    categories.value = [...cats].sort((a, b) => a.sort_order - b.sort_order);
    available.value = avail;
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить категории');
  } finally {
    loading.value = false;
  }
}

// Включение/выключение категории. Считаем целевой набор включённых id и
// сохраняем его: если включены все — очищаем whitelist (открытый каталог),
// иначе заменяем whitelist оставшимся набором.
async function toggle(cat: MarketplaceCoopCategoryView, value: boolean): Promise<void> {
  const enabledIds = new Set(categories.value.filter((c) => isEnabled(c)).map((c) => c.id));
  if (value) enabledIds.add(cat.id);
  else enabledIds.delete(cat.id);

  if (enabledIds.size === 0) {
    Notify.create({
      type: 'warning',
      message: 'Должна остаться хотя бы одна доступная категория',
      timeout: 2200,
      position: 'top',
    });
    return;
  }

  savingId.value = cat.id;
  try {
    if (enabledIds.size === categories.value.length) {
      await clearAvailableCategories();
    } else {
      await replaceAvailableItems({ categoryIds: [...enabledIds], categoryTypes: [] });
    }
    available.value = await fetchAvailableCategories();
    SuccessAlert(value ? 'Категория включена' : 'Категория выключена');
  } catch (e) {
    FailAlert(e, 'Не удалось изменить доступность');
  } finally {
    savingId.value = null;
  }
}

function onAdd(): void {
  newName.value = '';
  addDialogOpen.value = true;
}

async function confirmAdd(): Promise<void> {
  const name = newName.value.trim();
  if (!name) return;
  creating.value = true;
  try {
    await createCustomCategory({ displayName: name });
    SuccessAlert('Категория добавлена');
    addDialogOpen.value = false;
    await load();
  } catch (e) {
    FailAlert(e, 'Не удалось добавить категорию');
  } finally {
    creating.value = false;
  }
}

function onRemove(cat: MarketplaceCoopCategoryView): void {
  Dialog.create({
    title: 'Удалить категорию?',
    message: `Категория «${cat.display_name}» будет удалена. Опубликованные в ней предложения не пропадут, но публиковать новые станет нельзя.`,
    cancel: { label: 'Отмена', flat: true },
    ok: { label: 'Удалить', color: 'negative', unelevated: true },
    persistent: true,
  }).onOk(async () => {
    try {
      await deleteCustomCategory(cat.id);
      SuccessAlert('Категория удалена');
      await load();
    } catch (e) {
      FailAlert(e, 'Не удалось удалить категорию');
    }
  });
}

// Фоновое обновление вместо кнопки: список меняет сам админ (страница
// обновляется его же действиями); правки второго администратора доезжают
// страховочным resync'ом канала (60с) и catch-up'ом на возврат вкладки.
const reloadLive = debounce(() => {
  if (loading.value) return;
  void load();
}, 400);
useMarketplaceRealtime({}, { onResync: () => reloadLive() });

onMounted(load);
</script>

<template lang="pug">
q-page.categories(role='region', aria-label='Категории кооператива')
  PageHint(storage-key='mp:category-whitelist:banner-dismissed')
    | Категории, в которых пайщики могут публиковать предложения. По умолчанию
    | доступны все. Выключите ненужные, чтобы ограничить список, — или добавьте
    | собственную категорию кооператива. Базовые категории нельзя удалить, только
    | выключить.

  //- Действие страницы — в шапке (канон): добавить свою категорию.
  Teleport(to='#header-actions-host', defer)
    BaseButton(variant='primary', size='sm', @click='onAdd')
      template(#icon-left)
        q-icon(name='add', size='18px')
      | Добавить категорию

  .categories__summary(v-if='!loading || categories.length')
    span(v-if='isOpenCatalog') Открыт весь каталог — доступны все категории ({{ categories.length }})
    span(v-else) Доступно категорий: {{ enabledCount }} из {{ categories.length }}

  TableSkeleton(
    v-if='loading && !categories.length',
    :columns='skeletonColumns',
    :rows='6',
    min-width='560px'
  )

  .table-wrap(v-else-if='categories.length')
    .table-scroll
      table.table
        thead
          tr
            th.col-name Категория
            th.col-kind Вид
            th.col-toggle Доступна
            th.col-actions
        tbody
          tr(v-for='cat in categories', :key='cat.id')
            td.col-name.categories__name {{ cat.display_name }}
            td.col-kind
              BaseBadge(:variant='cat.mvp_baseline ? "neutral" : "info"')
                | {{ cat.mvp_baseline ? 'Базовая' : 'Своя' }}
            td.col-toggle
              q-toggle(
                :model-value='isEnabled(cat)',
                color='primary',
                :disable='savingId === cat.id',
                @update:model-value='(v) => toggle(cat, v)'
              )
            td.col-actions
              //- Удалить можно только собственную категорию; базовая — без действия.
              button.icon-btn(
                v-if='!cat.mvp_baseline',
                type='button',
                aria-label='Удалить категорию',
                @click='onRemove(cat)'
              )
                q-icon(name='delete', size='18px')

    .table-foot
      span Категорий: {{ categories.length }}

  EmptyState(
    v-else-if='!loading',
    title='Категорий нет',
    body='Базовые категории не загрузились. Обновите страницу или добавьте собственную.'
  )
    template(#icon)
      q-icon(name='category', size='48px')

  BaseDialog(v-model='addDialogOpen', title='Новая категория', size='sm')
    BaseInput(
      v-model='newName',
      label='Название категории',
      placeholder='Например: Бытовая химия',
      @keyup.enter='confirmAdd'
    )
    template(#footer)
      BaseButton(variant='ghost', @click='addDialogOpen = false') Отмена
      BaseButton(
        variant='primary',
        :loading='creating',
        :disabled='!newName.trim()',
        @click='confirmAdd'
      ) Добавить
</template>

<style scoped lang="scss">
.categories {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  &__summary {
    color: var(--p-ink-2);
    font-size: var(--p-fs-body-sm);
  }

  &__name {
    font-weight: 600;
    overflow-wrap: anywhere;
  }
}

.table-scroll {
  overflow-x: auto;
}
.table {
  table-layout: fixed;
  min-width: 560px;
}

.col-name {
  width: 320px;
}
.col-kind {
  width: 120px;
}
.col-toggle {
  width: 96px;
  text-align: center;
}
.col-actions {
  width: 64px;
  text-align: right;
}

@media (max-width: 768px) {
  .categories {
    padding: var(--p-4, 16px);
  }
}
</style>
