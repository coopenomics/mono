<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { useLiveReload } from 'src/shared/lib/realtime';
import { useFirstLoad } from 'src/shared/lib/composables';
import { Dialog, Notify, debounce } from 'quasar';
import { SuccessAlert, FailAlert } from 'src/shared/api';
import {
  BaseBadge,
  BaseButton,
  BaseInput,
  BaseDialog,
  BaseTable,
  EmptyState,
} from 'src/shared/ui/base';
import type { BaseTableColumn } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
import { marketLiveTables } from 'src/shared/lib/marketplace';
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
import { t } from 'src/shared/i18n';

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
// true до первого запроса: иначе первый кадр до загрузки показывает пустое
// состояние вместо скелетона, и первая загрузка неотличима от пустого списка.
const loading = ref(true);
/** Скелетон — только на первой загрузке; дочитка обновляет молча. */
const firstLoad = useFirstLoad(loading);
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

const columns: BaseTableColumn<MarketplaceCoopCategoryView>[] = [
  { key: 'name', label: t('marketplace.categoryWhitelist.column.category'), width: '320px', sortable: true, field: 'display_name' },
  { key: 'kind', label: t('marketplace.categoryWhitelist.column.kind'), width: '140px', sortable: true, field: 'mvp_baseline' },
  { key: 'enabled', label: t('marketplace.categoryWhitelist.column.available'), width: '120px' },
  { key: 'actions', label: '', width: '80px' },
];

async function load(): Promise<void> {
  loading.value = true;
  try {
    const [cats, avail] = await Promise.all([fetchCoopCategories(), fetchAvailableCategories()]);
    categories.value = [...cats].sort((a, b) => a.sort_order - b.sort_order);
    available.value = avail;
  } catch (e) {
    FailAlert(e, t('marketplace.categoryWhitelist.loadFailedError'));
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
      message: t('marketplace.categoryWhitelist.mustKeepOneError'),
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
    SuccessAlert(value ? t('marketplace.categoryWhitelist.enabledSuccess') : t('marketplace.categoryWhitelist.disabledSuccess'));
  } catch (e) {
    FailAlert(e, t('marketplace.categoryWhitelist.toggleFailedError'));
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
    SuccessAlert(t('marketplace.categoryWhitelist.addedSuccess'));
    addDialogOpen.value = false;
    await load();
  } catch (e) {
    FailAlert(e, t('marketplace.categoryWhitelist.addFailedError'));
  } finally {
    creating.value = false;
  }
}

function onRemove(cat: MarketplaceCoopCategoryView): void {
  Dialog.create({
    title: t('marketplace.categoryWhitelist.deleteConfirmTitle'),
    message: t('marketplace.categoryWhitelist.deleteConfirmMessage', { categoryName: cat.display_name }),
    cancel: { label: t('common.action.cancel'), flat: true },
    ok: { label: t('common.action.delete'), color: 'negative', unelevated: true },
    persistent: true,
  }).onOk(async () => {
    try {
      await deleteCustomCategory(cat.id);
      SuccessAlert(t('marketplace.categoryWhitelist.deletedSuccess'));
      await load();
    } catch (e) {
      FailAlert(e, t('marketplace.categoryWhitelist.deleteFailedError'));
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
useLiveReload(marketLiveTables('catalog'), () => reloadLive());

onMounted(load);
</script>

<template lang="pug">
q-page.categories(role='region', :aria-label='$t("marketplace.categoryWhitelist.pageAriaLabel")')
  PageHint(storage-key='mp:category-whitelist:banner-dismissed')
    | {{ $t('marketplace.chairmanCategoryWhitelist.intro') }}

  //- Действие страницы — в шапке (канон): добавить свою категорию.
  Teleport(to='#header-actions-host', defer)
    BaseButton(variant='primary', size='sm', @click='onAdd')
      template(#icon-left)
        q-icon(name='add', size='18px')
      | {{ $t('marketplace.categoryWhitelist.addCategoryButton') }}

  .categories__summary(v-if='!firstLoad || categories.length')
    span(v-if='isOpenCatalog') {{ $t('marketplace.categoryWhitelist.allAvailableSummary', { count: categories.length }) }}
    span(v-else) {{ $t('marketplace.categoryWhitelist.availableSummary', { enabled: enabledCount, total: categories.length }) }}

  BaseTable(
    v-if='loading || categories.length',
    :columns='columns',
    :rows='categories',
    row-key='id',
    hover,
    :loading='loading',
    :skeleton-rows='6',
    min-width='660px',
    sort-by='name'
  )
    template(#cell-name='{ row }')
      .categories__name {{ row.display_name }}
    template(#cell-kind='{ row }')
      BaseBadge(:variant='row.mvp_baseline ? "neutral" : "info"')
        | {{ row.mvp_baseline ? $t('marketplace.categoryWhitelist.kindBase') : $t('marketplace.categoryWhitelist.kindCustom') }}
    template(#cell-enabled='{ row }')
      q-toggle(
        :model-value='isEnabled(row)',
        color='primary',
        :disable='savingId === row.id',
        @update:model-value='(v) => toggle(row, v)'
      )
    template(#cell-actions='{ row }')
      //- Удалить можно только собственную категорию; базовая — без действия.
      button.icon-btn(
        v-if='!row.mvp_baseline',
        type='button',
        :aria-label='$t("marketplace.categoryWhitelist.deleteAriaLabel")',
        @click='onRemove(row)'
      )
        q-icon(name='delete', size='18px')
    template(#footer)
      span {{ $t('marketplace.categoryWhitelist.countLabel', { count: categories.length }) }}

  EmptyState(
    v-else-if='!firstLoad',
    :title='$t("marketplace.categoryWhitelist.emptyTitle")',
    :body='$t("marketplace.categoryWhitelist.emptyBody")'
  )
    template(#icon)
      q-icon(name='category', size='48px')

  BaseDialog(v-model='addDialogOpen', :title='$t("marketplace.categoryWhitelist.createDialogTitle")', size='sm')
    BaseInput(
      v-model='newName',
      :label='$t("marketplace.categoryWhitelist.nameLabel")',
      :placeholder='$t("marketplace.categoryWhitelist.namePlaceholder")',
      @keyup.enter='confirmAdd'
    )
    template(#footer)
      BaseButton(variant='ghost', @click='addDialogOpen = false') {{ $t('common.action.cancel') }}
      BaseButton(
        variant='primary',
        :loading='creating',
        :disabled='!newName.trim()',
        @click='confirmAdd'
      ) {{ $t('common.action.add') }}
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
