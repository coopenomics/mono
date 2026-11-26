<template lang="pug">
//- Зоны строки: опознание (пакет, действующая версия) → деньги (цена в месяц,
//- под ней пробный срок) → действие (назначить или изменить цену).
q-page(padding)
  .q-pa-md
    BaseBanner.q-mb-md(variant='info')
      | {{ $t('developer.pricing.intro') }}

    BaseBanner.q-mb-md(v-if='error', variant='neg') {{ error }}

    EmptyState(
      v-else-if='!firstLoad && !items.length',
      :title="$t('developer.pricing.emptyTitle')",
      :body="$t('developer.pricing.emptyBody')"
    )
      template(#icon)
        q-icon(name='currency_ruble', size='28px')

    BaseTable(
      v-else,
      :columns='columns',
      :rows='items',
      row-key='packageId',
      :loading='firstLoad',
      :skeleton-rows='3',
      min-width='560px',
      clickable-rows,
      @row-click='openEdit'
    )
      template(#cell-package='{ row }')
        .t-mono {{ row.packageId }}
        .t-sm.t-muted {{ row.lastActiveVersion ? $t('developer.pricing.activeVersion', { version: row.lastActiveVersion }) : $t('developer.pricing.noActiveRelease') }}
      template(#cell-price='{ row }')
        template(v-if='row.rubPerMonth == null')
          BaseBadge(variant='warn') {{ $t('developer.priceNotSet') }}
        template(v-else)
          .pricing__amount {{ row.rubPerMonth === 0 ? $t('developer.pricing.free') : $t('developer.perMonth', { amount: formatPrice(row.rubPerMonth) }) }}
          .t-sm.t-muted {{ row.trialDays > 0 ? $t('developer.pricing.trialDays', { days: row.trialDays }) : $t('developer.pricing.noTrial') }}
      template(#cell-actions='{ row }')
        BaseButton(variant='secondary', size='sm', @click.stop='openEdit(row)')
          | {{ row.rubPerMonth == null ? $t('developer.pricing.setPrice') : $t('developer.pricing.changePrice') }}

  BaseDialog(v-model='editDialog', :title="$t('developer.pricing.dialogTitle')", size='sm')
    p.t-sm.t-muted.q-mb-sm
      | {{ $t('developer.pricing.packageLabel') }}
      |
      span.t-mono {{ selected?.packageId }}
    AmountInput(
      v-model='form.rubPerMonth',
      symbol='₽',
      :precision='2',
      :label="$t('developer.pricing.priceLabel')",
      :hint="$t('developer.pricing.priceHint')",
      :error='formErrors.rubPerMonth'
    )
    BaseInput.q-mt-sm(
      v-model='form.trialDays',
      type='number',
      :label="$t('developer.pricing.trialLabel')",
      :hint="$t('developer.pricing.trialHint')",
      :error='formErrors.trialDays'
    )
    BaseBanner.q-mt-sm(v-if='actionError', variant='neg') {{ actionError }}
    template(#footer)
      BaseButton(variant='ghost', :disabled='isSubmitting', @click='editDialog = false') {{ $t('common.action.cancel') }}
      BaseButton(variant='primary', :loading='isSubmitting', @click='confirmEdit') {{ $t('developer.pricing.save') }}
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { BaseBadge, BaseBanner, BaseButton, BaseDialog, BaseInput, BaseTable, EmptyState } from 'src/shared/ui/base';
import type { BaseTableColumn } from 'src/shared/ui/base/BaseTable/BaseTable.types';
import { AmountInput } from 'src/shared/ui/domain';
import { useFirstLoad } from 'src/shared/lib/composables';
import { usePackagePricing, type IPackagePricing } from '../features/PackagePricing/model';
import { t } from '../i18n';

/** Верхняя граница цены, ₽ в месяц: та же, что у каталога приложений. */
const PRICE_MAX_RUB = 1_000_000;
/** Верхняя граница пробного срока, дней. */
const TRIAL_MAX_DAYS = 365;

const { items, loading, error, isSubmitting, actionError, load, setPrice } = usePackagePricing();
const firstLoad = useFirstLoad(loading);

const columns: BaseTableColumn<IPackagePricing>[] = [
  { key: 'package', label: t('developer.column.package') },
  { key: 'price', label: t('developer.column.price'), width: '200px' },
  { key: 'actions', label: t('developer.column.actions'), width: '180px', align: 'right', nowrap: true },
];

function formatPrice(rub: number): string {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(rub);
}

const editDialog = ref(false);
const selected = ref<IPackagePricing | null>(null);
const form = reactive<{ rubPerMonth: number | string | null; trialDays: number | string | null }>({
  rubPerMonth: null,
  trialDays: 0,
});
const formErrors = reactive({ rubPerMonth: '', trialDays: '' });

function openEdit(row: IPackagePricing) {
  selected.value = row;
  form.rubPerMonth = row.rubPerMonth ?? null;
  form.trialDays = row.trialDays ?? 0;
  formErrors.rubPerMonth = '';
  formErrors.trialDays = '';
  actionError.value = null;
  editDialog.value = true;
}

/** Цена из поля формы: рубли с копейками либо `null`, когда значение вне допустимого. */
function parsePrice(value: number | string | null): number | null {
  if (value === null || value === '') return null;
  const rub = Number(value);
  const kopecks = Math.round(rub * 100);
  const valid = Number.isFinite(rub) && rub >= 0 && rub <= PRICE_MAX_RUB && Math.abs(kopecks - rub * 100) < 1e-6;
  return valid ? kopecks / 100 : null;
}

/** Пробный срок из поля формы: целые дни либо `null`; пустое поле — 0. */
function parseTrialDays(value: number | string | null): number | null {
  const days = value === null || value === '' ? 0 : Number(value);
  return Number.isInteger(days) && days >= 0 && days <= TRIAL_MAX_DAYS ? days : null;
}

async function confirmEdit() {
  if (!selected.value) return;
  const rubPerMonth = parsePrice(form.rubPerMonth);
  const trialDays = parseTrialDays(form.trialDays);
  formErrors.rubPerMonth = rubPerMonth === null ? t('developer.pricing.priceRange') : '';
  formErrors.trialDays = trialDays === null ? t('developer.pricing.trialRange') : '';
  if (rubPerMonth === null || trialDays === null) return;
  const ok = await setPrice({ packageId: selected.value.packageId, rubPerMonth, trialDays });
  if (ok) editDialog.value = false;
}

// realtime: нет источника — цены хранит внешний каталог приложений, лента цепи кооператива о них не сообщает
onMounted(load);
</script>

<style scoped>
.pricing__amount {
  font-weight: 600;
}
</style>
